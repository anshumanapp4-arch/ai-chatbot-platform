// ============================================
// Database Seed Script
// ============================================

import bcrypt from 'bcryptjs';
import { pool, query } from './client.js';
import { config } from '../config/index.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create default billing plans
  const plans = [
    { name: 'Free', message_limit: 100, price: 0, currency: 'INR', overage_rate: 0, features: { web_widget: true } },
    { name: 'Starter', message_limit: 1000, price: 999, currency: 'INR', overage_rate: 0.5, features: { web_widget: true, whatsapp: true } },
    { name: 'Pro', message_limit: 5000, price: 2999, currency: 'INR', overage_rate: 0.3, features: { web_widget: true, whatsapp: true, exports: true, analytics: true } },
    { name: 'Enterprise', message_limit: 50000, price: 9999, currency: 'INR', overage_rate: 0.1, features: { web_widget: true, whatsapp: true, exports: true, analytics: true, priority_support: true } },
  ];

  for (const plan of plans) {
    await query(
      `INSERT INTO billing_plans (name, message_limit, price, currency, overage_rate, features)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [plan.name, plan.message_limit, plan.price, plan.currency, plan.overage_rate, JSON.stringify(plan.features)]
    );
  }
  console.log('  ✅ Billing plans created');

  // 2. Create super admin user
  const passwordHash = await bcrypt.hash(config.admin.password, 12);
  await query(
    `INSERT INTO users (email, password_hash, role, tenant_id)
     VALUES ($1, $2, 'super_admin', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [config.admin.email, passwordHash]
  );
  console.log(`  ✅ Super admin created: ${config.admin.email}`);

  // 3. Create default demo tenant
  await query(
    `INSERT INTO tenants (id, name, slug, status, bot_persona, llm_provider, llm_model, embedding_provider, embedding_model)
     VALUES ($1, $2, $3, 'active', $4, 'gemini', 'gemini-1.5-flash', 'gemini', 'text-embedding-004')
     ON CONFLICT DO NOTHING`,
    [
      'd3b07384-d113-4ec6-a5d9-48248bc8fc0f',
      'Demo Company',
      'demo',
      'You are a helpful customer support bot for Demo Company.'
    ]
  );
  console.log('  ✅ Default demo tenant created (slug: demo)');

  // 4. Force all tenants to use Gemini to bypass OpenAI API quota failures
  await query(
    `UPDATE tenants SET 
       llm_provider = 'gemini', 
       llm_model = 'gemini-1.5-flash', 
       embedding_provider = 'gemini', 
       embedding_model = 'text-embedding-004'`
  );
  console.log('  ✅ All existing tenants updated to use Google Gemini');

  console.log('✅ Seeding complete.');
  await pool.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
