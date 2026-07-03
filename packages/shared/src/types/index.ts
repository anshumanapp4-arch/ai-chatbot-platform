// ============================================
// TypeScript Interfaces — Data Model
// ============================================

import type {
  UserRole, TenantStatus, UserStatus, SourceType, SourceStatus,
  Channel, ConversationStatus, MessageRole, LeadOrderType,
  LeadOrderStatus, PaymentStatus, WhatsAppConnectionStatus,
  BillingSubscriptionStatus, LLMProvider,
} from '../constants/index.js';

// ---- Tenant ----
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  website_url: string | null;
  bot_persona: string | null;
  fallback_message: string | null;
  handoff_trigger: string | null;
  business_hours: BusinessHours | null;
  llm_provider: LLMProvider;
  llm_model: string;
  embedding_provider: LLMProvider;
  embedding_model: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  timezone: string;
  schedule: Record<string, { open: string; close: string } | null>;
}

// ---- User ----
export interface User {
  id: string;
  tenant_id: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

// ---- Source ----
export interface Source {
  id: string;
  tenant_id: string;
  type: SourceType;
  origin: string;
  storage_path: string | null;
  status: SourceStatus;
  error_detail: string | null;
  config: SourceConfig | null;
  pages_crawled: number;
  chunks_created: number;
  created_at: string;
  updated_at: string;
}

export interface SourceConfig {
  crawl_depth?: number;
  page_limit?: number;
}

// ---- Chunk ----
export interface Chunk {
  id: string;
  tenant_id: string;
  source_id: string;
  content: string;
  metadata: ChunkMetadata;
  created_at: string;
}

export interface ChunkMetadata {
  page_number?: number;
  source_url?: string;
  heading?: string;
  char_offset?: number;
  filename?: string;
}

// ---- Conversation ----
export interface Conversation {
  id: string;
  tenant_id: string;
  channel: Channel;
  customer_identifier: string;
  status: ConversationStatus;
  started_at: string;
  last_message_at: string;
  metadata: Record<string, unknown>;
}

// ---- Message ----
export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[] | null;
  token_count: number;
  created_at: string;
}

export interface Citation {
  source_id: string;
  chunk_id: string;
  snippet: string;
}

// ---- Lead/Order ----
export interface LeadOrder {
  id: string;
  tenant_id: string;
  conversation_id: string;
  type: LeadOrderType;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  request_details: string | null;
  quantity: number | null;
  notes: string | null;
  status: LeadOrderStatus;
  source_channel: Channel;
  payment_status: PaymentStatus;
  payment_link: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Payment ----
export interface Payment {
  id: string;
  tenant_id: string;
  lead_order_id: string;
  gateway: string;
  gateway_payment_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  webhook_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ---- WhatsApp Connection ----
export interface WhatsAppConnection {
  id: string;
  tenant_id: string;
  provider: string;
  phone_number: string;
  phone_number_id: string;
  waba_id: string;
  status: WhatsAppConnectionStatus;
  health_checked_at: string | null;
  created_at: string;
}

// ---- Billing ----
export interface BillingPlan {
  id: string;
  name: string;
  message_limit: number;
  price: number;
  currency: string;
  overage_rate: number;
  features: Record<string, boolean>;
  is_active: boolean;
}

export interface BillingSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  gateway: string;
  gateway_subscription_id: string | null;
  status: BillingSubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
}

export interface UsageRecord {
  id: string;
  tenant_id: string;
  period: string;
  messages_sent: number;
  llm_tokens_input: number;
  llm_tokens_output: number;
  llm_cost_usd: number;
  embedding_tokens: number;
}

// ---- Audit Log ----
export interface AuditLog {
  id: string;
  user_id: string;
  tenant_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

// ---- API Response Types ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ---- Auth Types ----
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface JWTPayload {
  user_id: string;
  tenant_id: string | null;
  role: UserRole;
  email: string;
}

// ---- Chat Types ----
export interface ChatRequest {
  message: string;
  conversation_id?: string;
  tenant_slug: string;
  customer_identifier?: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  citations: Citation[];
  lead_captured?: LeadOrder;
}
