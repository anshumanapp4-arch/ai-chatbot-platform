-- ============================================
-- Migration 001: Initial Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Custom ENUM Types
-- ============================================

CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE user_role AS ENUM ('super_admin', 'client_owner', 'client_staff');
CREATE TYPE user_status AS ENUM ('active', 'suspended');
CREATE TYPE source_type AS ENUM ('website', 'pdf', 'docx', 'txt', 'audio', 'video', 'image');
CREATE TYPE source_status AS ENUM ('queued', 'processing', 'done', 'failed');
CREATE TYPE channel_type AS ENUM ('web', 'whatsapp');
CREATE TYPE conversation_status AS ENUM ('active', 'handled', 'handoff');
CREATE TYPE message_role AS ENUM ('customer', 'assistant', 'system');
CREATE TYPE lead_order_type AS ENUM ('lead', 'order');
CREATE TYPE lead_order_status AS ENUM ('new', 'contacted', 'converted', 'cancelled');
CREATE TYPE payment_status AS ENUM ('none', 'pending', 'paid', 'failed', 'refunded');
CREATE TYPE whatsapp_connection_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE billing_subscription_status AS ENUM ('active', 'past_due', 'cancelled');

-- ============================================
-- Tables
-- ============================================

-- Tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status tenant_status NOT NULL DEFAULT 'active',
    website_url TEXT,
    bot_persona TEXT,
    fallback_message TEXT DEFAULT 'I''m sorry, I don''t have information about that. Would you like to speak with a human?',
    handoff_trigger TEXT,
    business_hours JSONB,
    llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    llm_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    embedding_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'client_owner',
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sources (ingestion jobs)
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type source_type NOT NULL,
    origin TEXT NOT NULL,
    storage_path TEXT,
    status source_status NOT NULL DEFAULT 'queued',
    error_detail TEXT,
    config JSONB,
    pages_crawled INT NOT NULL DEFAULT 0,
    chunks_created INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chunks (vector embeddings)
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel channel_type NOT NULL DEFAULT 'web',
    customer_identifier VARCHAR(255),
    status conversation_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    citations JSONB,
    token_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads & Orders
CREATE TABLE leads_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    type lead_order_type NOT NULL DEFAULT 'lead',
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    request_details TEXT,
    quantity INT,
    notes TEXT,
    status lead_order_status NOT NULL DEFAULT 'new',
    source_channel channel_type NOT NULL DEFAULT 'web',
    payment_status payment_status NOT NULL DEFAULT 'none',
    payment_link TEXT,
    payment_amount DECIMAL(12,2),
    payment_currency VARCHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_order_id UUID NOT NULL REFERENCES leads_orders(id) ON DELETE CASCADE,
    gateway VARCHAR(50) NOT NULL,
    gateway_payment_id VARCHAR(255),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'pending',
    webhook_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Connections
CREATE TABLE whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'meta_cloud_api',
    phone_number VARCHAR(20) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    waba_id VARCHAR(100) NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    status whatsapp_connection_status NOT NULL DEFAULT 'disconnected',
    health_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Billing Plans
CREATE TABLE billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    message_limit INT NOT NULL DEFAULT 1000,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    overage_rate DECIMAL(10,4) NOT NULL DEFAULT 0,
    features JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Billing Subscriptions
CREATE TABLE billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES billing_plans(id),
    gateway VARCHAR(50) NOT NULL DEFAULT 'manual',
    gateway_subscription_id VARCHAR(255),
    status billing_subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Usage Records
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period DATE NOT NULL,
    messages_sent INT NOT NULL DEFAULT 0,
    llm_tokens_input INT NOT NULL DEFAULT 0,
    llm_tokens_output INT NOT NULL DEFAULT 0,
    llm_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
    embedding_tokens INT NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, period)
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Tenant-scoped lookups (most frequent query pattern)
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_sources_tenant_id ON sources(tenant_id);
CREATE INDEX idx_sources_tenant_status ON sources(tenant_id, status);
CREATE INDEX idx_chunks_tenant_id ON chunks(tenant_id);
CREATE INDEX idx_chunks_source_id ON chunks(source_id);
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_tenant_channel ON conversations(tenant_id, channel);
CREATE INDEX idx_conversations_last_message ON conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX idx_leads_orders_tenant_id ON leads_orders(tenant_id);
CREATE INDEX idx_leads_orders_tenant_status ON leads_orders(tenant_id, status);
CREATE INDEX idx_leads_orders_tenant_created ON leads_orders(tenant_id, created_at DESC);
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_lead_order_id ON payments(lead_order_id);
CREATE INDEX idx_usage_records_tenant_period ON usage_records(tenant_id, period);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- Vector similarity search (IVFFlat) — tenant-scoped via WHERE clause
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search on conversations
CREATE INDEX idx_messages_content_search ON messages USING gin (to_tsvector('english', content));

-- ============================================
-- Row-Level Security Policies
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- RLS policies — enforced via current_setting('app.current_tenant')
-- The application sets this at the start of each tenant-scoped request

CREATE POLICY tenant_isolation_tenants ON tenants
    USING (id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_sources ON sources
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_chunks ON chunks
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_conversations ON conversations
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_messages ON messages
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_leads_orders ON leads_orders
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_payments ON payments
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_whatsapp ON whatsapp_connections
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_billing_subs ON billing_subscriptions
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

CREATE POLICY tenant_isolation_usage ON usage_records
    USING (tenant_id::text = current_setting('app.current_tenant', true) OR current_setting('app.current_role', true) = 'super_admin');

-- ============================================
-- Updated-at Trigger
-- ============================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_tenants BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_sources BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_leads_orders BEFORE UPDATE ON leads_orders FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
