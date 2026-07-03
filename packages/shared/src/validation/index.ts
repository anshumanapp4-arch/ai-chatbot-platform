// ============================================
// Zod Validation Schemas — Shared FE & BE
// ============================================

import { z } from 'zod';

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
});

// ---- Tenant ----
export const createTenantSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(255),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  website_url: z.string().url('Invalid URL').or(z.literal('')).optional().nullable(),
  llm_provider: z.enum(['openai', 'gemini', 'claude']).default('gemini'),
  llm_model: z.string().default('gemini-1.5-flash'),
  embedding_provider: z.enum(['openai', 'gemini', 'claude']).default('gemini'),
  embedding_model: z.string().default('text-embedding-004'),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  bot_persona: z.string().max(5000).optional().nullable(),
  fallback_message: z.string().max(1000).optional().nullable(),
  handoff_trigger: z.string().max(2000).optional().nullable(),
  business_hours: z.object({
    timezone: z.string(),
    schedule: z.record(
      z.object({
        open: z.string(),
        close: z.string(),
      }).nullable()
    ),
  }).optional().nullable(),
});

// ---- Source ----
export const createWebsiteSourceSchema = z.object({
  url: z.string().url('Invalid URL'),
  crawl_depth: z.number().int().min(1).max(10).default(3),
  page_limit: z.number().int().min(1).max(500).default(50),
});

export const createFileSourceSchema = z.object({
  type: z.enum(['pdf', 'docx', 'txt', 'audio', 'video', 'image']),
});

// ---- Lead/Order ----
export const updateLeadOrderSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'cancelled']).optional(),
  notes: z.string().max(5000).optional(),
  customer_name: z.string().max(255).optional(),
  customer_phone: z.string().max(50).optional(),
  customer_email: z.string().email().optional(),
});

// ---- Chat ----
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000),
  conversation_id: z.string().uuid().optional().nullable(),
  tenant_slug: z.string().min(1),
  customer_identifier: z.string().optional(),
});

// ---- Bot Settings ----
export const botSettingsSchema = z.object({
  bot_persona: z.string().max(5000, 'Persona must be under 5000 characters'),
  fallback_message: z.string().max(1000).default("I'm sorry, I don't have information about that. Would you like to speak with a human?"),
  handoff_trigger: z.string().max(2000).optional(),
  business_hours: z.object({
    timezone: z.string(),
    schedule: z.record(
      z.object({
        open: z.string(),
        close: z.string(),
      }).nullable()
    ),
  }).optional(),
});

// ---- Billing Plan ----
export const createBillingPlanSchema = z.object({
  name: z.string().min(1).max(100),
  message_limit: z.number().int().min(0),
  price: z.number().min(0),
  currency: z.string().length(3).default('INR'),
  overage_rate: z.number().min(0).default(0),
  features: z.record(z.boolean()).default({}),
});

// ---- Pagination ----
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

// Export types inferred from schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateWebsiteSourceInput = z.infer<typeof createWebsiteSourceSchema>;
export type UpdateLeadOrderInput = z.infer<typeof updateLeadOrderSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type BotSettingsInput = z.infer<typeof botSettingsSchema>;
export type CreateBillingPlanInput = z.infer<typeof createBillingPlanSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
