// ============================================
// Lead/Order Capture — Structured Extraction
// ============================================

import { query } from '../../db/client.js';
import { encryptPII } from '../../utils/encryption.js';
import { logger } from '../../utils/logger.js';
import type { LLMProviderInterface } from './providers/interface.js';
import type { Tenant, Message } from '@chatbot/shared';

interface ExtractedLead {
  is_lead_or_order: boolean;
  type: 'lead' | 'order';
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  request_details: string | null;
  quantity: number | null;
  notes: string | null;
}

/**
 * Use the LLM to determine if the conversation contains a lead/order
 * and extract structured fields if so.
 */
export async function extractLeadOrder(
  llm: LLMProviderInterface,
  tenant: Tenant,
  history: Message[],
  userMessage: string,
  botResponse: string,
  conversationId: string
): Promise<any | null> {
  // Only check for lead extraction every few messages to save tokens
  const totalMessages = history.length + 2; // +2 for current exchange
  if (totalMessages < 3) return null; // Need at least a few exchanges

  // Check if we already captured a lead for this conversation recently
  const existingLead = await query(
    `SELECT id FROM leads_orders WHERE conversation_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
    [conversationId]
  );
  if (existingLead.rows.length > 0) return null; // Already captured recently

  const extractionPrompt = `Analyze the following conversation and determine if it contains a lead or order.

A "lead" is when a customer expresses interest in a product/service or shares contact information.
An "order" is when a customer explicitly wants to purchase/book something.

Conversation:
${history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}
customer: ${userMessage}
assistant: ${botResponse}

Respond in JSON format:
{
  "is_lead_or_order": true/false,
  "type": "lead" or "order",
  "customer_name": "extracted name or null",
  "customer_phone": "extracted phone or null",
  "customer_email": "extracted email or null",
  "request_details": "what they're looking for",
  "quantity": number or null,
  "notes": "any additional details"
}

If no lead or order is detected, respond with: {"is_lead_or_order": false}`;

  try {
    const response = await llm.chatCompletion(
      [{ role: 'system', content: 'You are a data extraction assistant. Extract structured lead/order data from conversations. Always respond with valid JSON.' },
       { role: 'user', content: extractionPrompt }],
      { temperature: 0, response_format: { type: 'json_object' } }
    );

    const extracted: ExtractedLead = JSON.parse(response.content);

    if (!extracted.is_lead_or_order) return null;

    // Store the lead/order with encrypted PII
    const result = await query(
      `INSERT INTO leads_orders (tenant_id, conversation_id, type, customer_name, customer_phone, customer_email, request_details, quantity, notes, source_channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         (SELECT channel FROM conversations WHERE id = $2))
       RETURNING *`,
      [
        tenant.id,
        conversationId,
        extracted.type || 'lead',
        extracted.customer_name ? encryptPII(extracted.customer_name) : null,
        extracted.customer_phone ? encryptPII(extracted.customer_phone) : null,
        extracted.customer_email ? encryptPII(extracted.customer_email) : null,
        extracted.request_details || null,
        extracted.quantity || null,
        extracted.notes || null,
      ]
    );

    logger.info('Lead/order captured', { leadId: result.rows[0].id, type: extracted.type, tenantId: tenant.id });
    return result.rows[0];
  } catch (error) {
    logger.error('Lead extraction JSON parse failed', { error: String(error) });
    return null;
  }
}
