// ============================================
// WhatsApp Webhook Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { Queue } from 'bullmq';
import { config } from '../../config/index.js';
import { query } from '../../db/client.js';
import { MetaCloudApiProvider } from '../../services/whatsapp/providers/metaCloudApi.js';
import { ragPipeline } from '../../services/ai/rag.js';
import { decryptPII } from '../../utils/encryption.js';
import { webhookLimiter } from '../../middleware/rateLimit.js';
import { logger } from '../../utils/logger.js';
import type { Tenant, Message } from '@chatbot/shared';

const router = Router();
const metaProvider = new MetaCloudApiProvider();

// Redis connection for deduplication & queue
const redisUrl = new URL(config.redis.url);
const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
};

// Simple in-memory dedup (use Redis in production)
const processedMessages = new Set<string>();

// GET /api/webhooks/whatsapp — Webhook verification (Meta handshake)
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// POST /api/webhooks/whatsapp — Receive messages
router.post(
  '/',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    // IMMEDIATELY respond 200 to Meta
    res.sendStatus(200);

    try {
      // Verify HMAC signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (signature && config.whatsapp.appSecret) {
        const rawBody = typeof req.body === 'string' ? Buffer.from(req.body) : req.body;
        const valid = metaProvider.verifyWebhookSignature(rawBody, signature, config.whatsapp.appSecret);
        if (!valid) {
          logger.warn('WhatsApp webhook signature verification failed');
          return;
        }
      }

      // Parse the payload
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const messages = metaProvider.parseWebhookPayload(payload);

      for (const msg of messages) {
        // Deduplication
        if (processedMessages.has(msg.messageId)) continue;
        processedMessages.add(msg.messageId);

        // Clean up old entries (keep last 10000)
        if (processedMessages.size > 10000) {
          const iterator = processedMessages.values();
          for (let i = 0; i < 5000; i++) {
            processedMessages.delete(iterator.next().value!);
          }
        }

        // Only process text messages for now
        if (msg.type !== 'text' || !msg.text) continue;

        await processWhatsAppMessage(msg.phoneNumberId, msg.from, msg.text);
      }
    } catch (error) {
      logger.error('WhatsApp webhook processing error', { error: String(error) });
    }
  }
);

/**
 * Process an incoming WhatsApp message through the RAG pipeline
 */
async function processWhatsAppMessage(phoneNumberId: string, from: string, text: string) {
  try {
    // 1. Find the tenant by WhatsApp phone number ID
    const waResult = await query(
      `SELECT wc.*, t.* FROM whatsapp_connections wc
       JOIN tenants t ON t.id = wc.tenant_id
       WHERE wc.phone_number_id = $1 AND wc.status = 'connected' AND t.status = 'active'`,
      [phoneNumberId]
    );

    if (waResult.rows.length === 0) {
      logger.warn(`No tenant found for WhatsApp number ID: ${phoneNumberId}`);
      return;
    }

    const row = waResult.rows[0];
    const tenant: Tenant = {
      id: row.tenant_id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      website_url: row.website_url,
      bot_persona: row.bot_persona,
      fallback_message: row.fallback_message,
      handoff_trigger: row.handoff_trigger,
      business_hours: row.business_hours,
      llm_provider: row.llm_provider,
      llm_model: row.llm_model,
      embedding_provider: row.embedding_provider,
      embedding_model: row.embedding_model,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const accessToken = decryptPII(row.access_token_encrypted);

    // Check usage limits
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const usageCheck = await query(
      `SELECT COALESCE(ur.messages_sent, 0) as messages_sent, bp.message_limit
       FROM tenants t
       LEFT JOIN billing_subscriptions bs ON bs.tenant_id = t.id AND bs.status = 'active'
       LEFT JOIN billing_plans bp ON bp.id = bs.plan_id
       LEFT JOIN usage_records ur ON ur.tenant_id = t.id AND ur.period = $1
       WHERE t.id = $2`,
      [currentMonth, tenant.id]
    );

    if (usageCheck.rows.length > 0) {
      const { messages_sent, message_limit } = usageCheck.rows[0];
      if (message_limit !== null && messages_sent >= message_limit) {
        await metaProvider.sendTextMessage(
          phoneNumberId,
          from,
          'Sorry, this service has exceeded its monthly message limit. Please check back later.',
          accessToken
        );
        logger.info('WhatsApp message blocked: limit exceeded', { tenantId: tenant.id });
        return;
      }
    }

    // 2. Get or create conversation for this phone number
    let convResult = await query(
      `SELECT * FROM conversations WHERE tenant_id = $1 AND channel = 'whatsapp' AND customer_identifier = $2 AND status = 'active'`,
      [tenant.id, from]
    );

    let conversationId: string;
    if (convResult.rows.length === 0) {
      const newConv = await query(
        `INSERT INTO conversations (tenant_id, channel, customer_identifier, status)
         VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
        [tenant.id, from]
      );
      conversationId = newConv.rows[0].id;
    } else {
      conversationId = convResult.rows[0].id;
    }

    // 3. Store incoming message
    await query(
      `INSERT INTO messages (conversation_id, tenant_id, role, content)
       VALUES ($1, $2, 'customer', $3)`,
      [conversationId, tenant.id, text]
    );

    await query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    // 4. Get conversation history
    const historyResult = await query<Message>(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20`,
      [conversationId]
    );

    // 5. Run RAG pipeline
    const ragResult = await ragPipeline(tenant, text, historyResult.rows, conversationId);

    // 6. Store bot response
    await query(
      `INSERT INTO messages (conversation_id, tenant_id, role, content, citations, token_count)
       VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [conversationId, tenant.id, ragResult.response, JSON.stringify(ragResult.citations), ragResult.usage.total_tokens]
    );

    // 7. Update usage
    await query(
      `INSERT INTO usage_records (tenant_id, period, messages_sent, llm_tokens_input, llm_tokens_output)
       VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT (tenant_id, period)
       DO UPDATE SET messages_sent = usage_records.messages_sent + 1,
         llm_tokens_input = usage_records.llm_tokens_input + $3,
         llm_tokens_output = usage_records.llm_tokens_output + $4`,
      [tenant.id, currentMonth, ragResult.usage.prompt_tokens, ragResult.usage.completion_tokens]
    );

    // 8. Send response back via WhatsApp
    await metaProvider.sendTextMessage(phoneNumberId, from, ragResult.response, accessToken);

    logger.info('WhatsApp message processed', { tenantId: tenant.id, from, conversationId });

  } catch (error) {
    logger.error('Failed to process WhatsApp message', { error: String(error), phoneNumberId, from });
  }
}

export default router;
