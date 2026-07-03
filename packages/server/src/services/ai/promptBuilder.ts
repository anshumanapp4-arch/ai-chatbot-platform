// ============================================
// System Prompt Builder
// ============================================

import type { Tenant } from '@chatbot/shared';

/**
 * Build the system prompt for the conversational agent.
 * Combines the tenant's persona, business rules, and retrieved context.
 */
export function buildSystemPrompt(tenant: Tenant, contextText: string): string {
  const persona = tenant.bot_persona || `You are a helpful AI assistant for ${tenant.name}. Answer questions about the business accurately and helpfully.`;
  const fallback = tenant.fallback_message || "I'm sorry, I don't have information about that. Would you like to speak with a human representative?";
  const handoffRules = tenant.handoff_trigger || '';

  return `${persona}

## Rules
1. ONLY answer questions using the provided knowledge base context below. Do NOT make up information.
2. If the context does not contain relevant information to answer the question, respond with: "${fallback}"
3. When referencing information, mention the source naturally (e.g., "According to our website..." or "Based on our documentation...").
4. Be conversational, friendly, and professional.
5. If the user seems frustrated or explicitly asks for a human, respond with: "I'll connect you with a human representative right away. Please hold on."
${handoffRules ? `6. Additional handoff rules: ${handoffRules}` : ''}

## Lead/Order Capture
When the conversation indicates the customer wants to:
- Request a quote, book a service, place an order, or make an inquiry
- Share their contact details (name, phone, email)

Capture this information naturally in the conversation. Always try to collect:
- Customer name
- Phone number
- What they're looking for (product/service)
- Any specific requirements or quantities

${tenant.business_hours ? `## Business Hours\nTimezone: ${tenant.business_hours.timezone}\nSchedule: ${JSON.stringify(tenant.business_hours.schedule)}` : ''}

## Knowledge Base Context
${contextText}`;
}
