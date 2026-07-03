// ============================================
// Admin: Usage & Billing Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

interface UsageData {
  tenants: Array<{
    tenant_id: string;
    tenant_name: string;
    slug: string;
    messages_sent: number;
    llm_tokens_input: number;
    llm_tokens_output: number;
    llm_cost_usd: number;
    plan_name: string;
    message_limit: number;
    plan_price: number;
  }>;
  totals: {
    total_messages: number;
    total_cost_usd: number;
    total_revenue: number;
    margin: number;
  };
  period: string;
}

export default function AdminUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get('/api/admin/billing/usage');
        setData(res.data);
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Usage & Billing</h1>
        </div>
        <div className="grid grid-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card"><div className="skeleton" style={{ height: 80 }} /></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usage & Billing</h1>
          <p className="page-subtitle">
            Period: {data?.period ? new Date(data.period).toLocaleDateString('en', { month: 'long', year: 'numeric' }) : ''}
          </p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-4">
        <div className="glass-card stat-card">
          <div className="stat-label">Total Messages</div>
          <div className="stat-value">{data?.totals.total_messages?.toLocaleString() || 0}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">LLM Cost</div>
          <div className="stat-value">${data?.totals.total_cost_usd?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Revenue</div>
          <div className="stat-value">₹{data?.totals.total_revenue?.toLocaleString() || 0}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Margin</div>
          <div className="stat-value" style={{ color: (data?.totals.margin || 0) >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-red)' }}>
            ₹{data?.totals.margin?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      {/* Per-Tenant Usage */}
      <div className="glass-card" style={{ marginTop: 'var(--space-lg)', overflowX: 'auto' }}>
        <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
          Per-Client Usage
        </h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Plan</th>
              <th>Messages</th>
              <th>Limit</th>
              <th>Usage %</th>
              <th>Tokens (In/Out)</th>
              <th>LLM Cost</th>
              <th>Plan Price</th>
            </tr>
          </thead>
          <tbody>
            {data?.tenants.map(t => {
              const usagePercent = t.message_limit > 0 ? Math.round((t.messages_sent / t.message_limit) * 100) : 0;
              return (
                <tr key={t.tenant_id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{t.tenant_name}</td>
                  <td><span className="badge badge-purple">{t.plan_name || 'None'}</span></td>
                  <td>{t.messages_sent}</td>
                  <td>{t.message_limit?.toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <div style={{
                        width: 60,
                        height: 6,
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.min(usagePercent, 100)}%`,
                          height: '100%',
                          background: usagePercent > 90 ? 'var(--color-accent-red)' : usagePercent > 70 ? 'var(--color-accent-yellow)' : 'var(--color-accent-green)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width var(--transition-base)',
                        }} />
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)' }}>{usagePercent}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>
                    {t.llm_tokens_input?.toLocaleString()} / {t.llm_tokens_output?.toLocaleString()}
                  </td>
                  <td>${parseFloat(String(t.llm_cost_usd)).toFixed(2)}</td>
                  <td>₹{parseFloat(String(t.plan_price || 0)).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
