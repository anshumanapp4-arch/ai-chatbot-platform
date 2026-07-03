// ============================================
// Enums & Constants
// ============================================

export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  CLIENT_OWNER: 'client_owner',
  CLIENT_STAFF: 'client_staff',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TenantStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const UserStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const SourceType = {
  WEBSITE: 'website',
  PDF: 'pdf',
  DOCX: 'docx',
  TXT: 'txt',
  AUDIO: 'audio',
  VIDEO: 'video',
  IMAGE: 'image',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const SourceStatus = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
} as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

export const Channel = {
  WEB: 'web',
  WHATSAPP: 'whatsapp',
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const ConversationStatus = {
  ACTIVE: 'active',
  HANDLED: 'handled',
  HANDOFF: 'handoff',
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const MessageRole = {
  CUSTOMER: 'customer',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const LeadOrderType = {
  LEAD: 'lead',
  ORDER: 'order',
} as const;
export type LeadOrderType = (typeof LeadOrderType)[keyof typeof LeadOrderType];

export const LeadOrderStatus = {
  NEW: 'new',
  CONTACTED: 'contacted',
  CONVERTED: 'converted',
  CANCELLED: 'cancelled',
} as const;
export type LeadOrderStatus = (typeof LeadOrderStatus)[keyof typeof LeadOrderStatus];

export const PaymentStatus = {
  NONE: 'none',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const WhatsAppConnectionStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
} as const;
export type WhatsAppConnectionStatus = (typeof WhatsAppConnectionStatus)[keyof typeof WhatsAppConnectionStatus];

export const BillingSubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
} as const;
export type BillingSubscriptionStatus = (typeof BillingSubscriptionStatus)[keyof typeof BillingSubscriptionStatus];

export const LLMProvider = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  CLAUDE: 'claude',
} as const;
export type LLMProvider = (typeof LLMProvider)[keyof typeof LLMProvider];
