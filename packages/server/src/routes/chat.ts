// ============================================
// Chat Route — Web Widget & API
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../db/client.js';
import { chatRequestSchema } from '@chatbot/shared';
import { ragPipeline } from '../services/ai/rag.js';
import { chatLimiter } from '../middleware/rateLimit.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Tenant, Message } from '@chatbot/shared';

const router = Router();

// POST /api/chat — Handle chat message (public endpoint — no auth required)
router.post('/', chatLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const { message, conversation_id, tenant_slug, customer_identifier } = parsed.data;

    // 1. Resolve tenant by slug
    const tenantResult = await query<Tenant>(
      'SELECT * FROM tenants WHERE slug = $1 AND status = $2',
      [tenant_slug, 'active']
    );

    if (tenantResult.rows.length === 0) {
      throw new NotFoundError('Tenant', tenant_slug);
    }

    const tenant = tenantResult.rows[0];

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
        return res.status(403).json({
          success: false,
          error: 'Message limit exceeded for the current billing cycle. Please upgrade your plan.',
        });
      }
    }

    // 2. Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const convResult = await query(
        `INSERT INTO conversations (tenant_id, channel, customer_identifier)
         VALUES ($1, 'web', $2) RETURNING id`,
        [tenant.id, customer_identifier || `web-${uuidv4().slice(0, 8)}`]
      );
      conversationId = convResult.rows[0].id;
    }

    // 3. Store user message
    await query(
      `INSERT INTO messages (conversation_id, tenant_id, role, content)
       VALUES ($1, $2, 'customer', $3)`,
      [conversationId, tenant.id, message]
    );

    // Update conversation last_message_at
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
    const ragResult = await ragPipeline(tenant, message, historyResult.rows, conversationId!);

    // 6. Store bot response
    await query(
      `INSERT INTO messages (conversation_id, tenant_id, role, content, citations, token_count)
       VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [
        conversationId,
        tenant.id,
        ragResult.response,
        JSON.stringify(ragResult.citations),
        ragResult.usage.total_tokens,
      ]
    );

    // 7. Update usage records
    await query(
      `INSERT INTO usage_records (tenant_id, period, messages_sent, llm_tokens_input, llm_tokens_output)
       VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT (tenant_id, period)
       DO UPDATE SET
         messages_sent = usage_records.messages_sent + 1,
         llm_tokens_input = usage_records.llm_tokens_input + $3,
         llm_tokens_output = usage_records.llm_tokens_output + $4`,
      [tenant.id, currentMonth, ragResult.usage.prompt_tokens, ragResult.usage.completion_tokens]
    );

    res.json({
      success: true,
      data: {
        message: ragResult.response,
        conversation_id: conversationId,
        citations: ragResult.citations,
        lead_captured: ragResult.leadCaptured ? { id: ragResult.leadCaptured.id, type: ragResult.leadCaptured.type } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
