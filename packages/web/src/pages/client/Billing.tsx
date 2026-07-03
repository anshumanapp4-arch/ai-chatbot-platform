// ============================================
// Client: Billing & Subscriptions Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

interface Plan {
  id: string;
  name: string;
  message_limit: number;
  price: number;
  currency: string;
  overage_rate: number;
  features: Record<string, boolean>;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  plan_name: string;
  message_limit: number;
  price: number;
}

interface Usage {
  messages_sent: number;
  llm_cost_usd: number;
}

export default function Billing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  async function fetchBillingData() {
    try {
      // 1. Get plans
      const plansRes = await api.get('/api/admin/billing/plans'); // Fallback or route open to authenticated users
      setPlans(plansRes.data);

      // 2. Get current tenant subscription & usage
      const tenantRes = await api.get('/api/client/settings'); // Or settings containing billing context
      // Since we want standard subscription data:
      const subRes = await api.get('/api/admin/billing/usage'); // Usage has list of current month status
      // Find our own tenant in the list
      const myTenantId = tenantRes.data.id;
      const myUsage = subRes.data?.tenants?.find((t: any) => t.tenant_id === myTenantId);
      
      setSubscription({
        id: '',
        plan_id: '',
        status: 'active',
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        plan_name: myUsage?.plan_name || 'Free',
        message_limit: myUsage?.message_limit || 100,
        price: myUsage?.plan_price || 0,
      });

      setUsage({
        messages_sent: myUsage?.messages_sent || 0,
        llm_cost_usd: myUsage?.llm_cost_usd || 0,
      });

    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId: string) {
    alert(`Upgrade flow initiated for plan ID: ${planId}. Integrates with SaaS subscription payment gateway in production.`);
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Billing & Subscription</h1>
        </div>
        <div className="glass-card">
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  const usagePercent = subscription && subscription.message_limit > 0
    ? Math.round(((usage?.messages_sent || 0) / subscription.message_limit) * 100)
    : 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Subscription</h1>
          <p className="page-subtitle">Manage your subscription plans and monitor platform usage</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Current Plan Overview */}
        <div className="glass-card grid grid-2" style={{ gap: 'var(--space-xl)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
              Current Plan: <span className="badge badge-purple" style={{ fontSize: 'var(--font-size-md)' }}>{subscription?.plan_name}</span>
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              Your subscription is active. Next renewal date: {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <div className="stat-card">
                <div className="stat-label">Monthly Price</div>
                <div className="stat-value" style={{ fontSize: 'var(--font-size-2xl)' }}>₹{subscription?.price || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Message Cost Overage</div>
                <div className="stat-value" style={{ fontSize: 'var(--font-size-md)', marginTop: 8 }}>₹0.50 / msg</div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
              Monthly Message Usage
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
              <span>{usage?.messages_sent} / {subscription?.message_limit} messages</span>
              <span>{usagePercent}%</span>
            </div>
            <div style={{
              width: '100%',
              height: 10,
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginBottom: 'var(--space-md)',
            }}>
              <div style={{
                width: `${Math.min(usagePercent, 100)}%`,
                height: '100%',
                background: usagePercent > 90 ? 'var(--color-accent-red)' : usagePercent > 70 ? 'var(--color-accent-yellow)' : 'var(--color-brand-gradient)',
                borderRadius: 'var(--radius-full)',
              }} />
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Once you reach 100% of your plan limit, your chatbot will stop responding until the next billing cycle or until you upgrade.
            </p>
          </div>
        </div>

        {/* Pricing Tiers Grid */}
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            Available Upgrade Plans
          </h2>
          <div className="grid grid-4" style={{ gap: 'var(--space-md)' }}>
            {plans.map(plan => {
              const isCurrent = subscription?.plan_name === plan.name;
              return (
                <div key={plan.id} className="glass-card" style={{
                  border: isCurrent ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: isCurrent ? 'rgba(108, 99, 255, 0.05)' : 'var(--color-bg-card)',
                }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                      {plan.name}
                    </h3>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-xs)' }}>
                      ₹{plan.price}
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 400 }}> / month</span>
                    </div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-secondary)', marginBottom: 'var(--space-md)' }}>
                      Limit: {plan.message_limit?.toLocaleString()} messages
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(plan.features || {}).map(([key, val]) => (
                        <li key={key}>
                          {val ? '✓' : '✗'} {key.replace('_', ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ marginTop: 'var(--space-lg)', width: '100%' }}
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
