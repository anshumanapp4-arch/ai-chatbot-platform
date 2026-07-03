// ============================================
// Client: Leads & Orders Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

interface LeadOrder {
  id: string;
  type: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  request_details: string;
  quantity: number;
  notes: string;
  status: string;
  source_channel: string;
  payment_status: string;
  payment_amount: number;
  payment_link?: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: 'badge-yellow',
  contacted: 'badge-blue',
  converted: 'badge-green',
  cancelled: 'badge-red',
};

const paymentColors: Record<string, string> = {
  none: '',
  pending: 'badge-yellow',
  paid: 'badge-green',
  failed: 'badge-red',
};

export default function Leads() {
  const [leads, setLeads] = useState<LeadOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ status: '', type: '', channel: '' });

  useEffect(() => {
    fetchLeads();
  }, [filter]);

  async function fetchLeads() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set('status', filter.status);
      if (filter.type) params.set('type', filter.type);
      if (filter.channel) params.set('channel', filter.channel);
      const res = await api.get(`/api/client/leads?${params}`);
      setLeads(res.data);
      setTotal(res.total);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/api/client/leads/${id}`, { status });
      fetchLeads();
    } catch (error) {
      console.error('Failed to update lead:', error);
    }
  }

  async function handleExport(format: string) {
    const params = new URLSearchParams();
    params.set('format', format);
    if (filter.status) params.set('status', filter.status);
    await api.download(
      `/api/client/exports/leads?${params}`,
      `leads_${new Date().toISOString().slice(0, 10)}.${format}`
    );
  }

  async function handleCreatePaymentLink(id: string) {
    const amountStr = prompt('Enter payment amount in INR:');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount entered');
      return;
    }

    try {
      await api.post(`/api/client/leads/${id}/payment-link`, { amount });
      alert('Payment link generated successfully!');
      fetchLeads();
    } catch (error: any) {
      alert(error.message || 'Failed to create payment link');
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads & Orders</h1>
          <p className="page-subtitle">{total} total leads captured by your AI agent</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" onClick={() => handleExport('csv')}>
            📄 Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => handleExport('xlsx')}>
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 160 }} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
          <option value="">All Types</option>
          <option value="lead">Lead</option>
          <option value="order">Order</option>
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={filter.channel} onChange={(e) => setFilter({ ...filter, channel: e.target.value })}>
          <option value="">All Channels</option>
          <option value="web">Web</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No leads yet</div>
            <p>Leads will appear here when customers express interest through your chatbot.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Request</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td>
                    <span className={`badge ${lead.type === 'order' ? 'badge-purple' : 'badge-blue'}`}>
                      {lead.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {lead.customer_name || '—'}
                  </td>
                  <td>
                    <div>{lead.customer_phone || '—'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {lead.customer_email || ''}
                    </div>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.request_details || '—'}
                  </td>
                  <td>
                    <span className={`badge ${lead.source_channel === 'whatsapp' ? 'badge-green' : 'badge-blue'}`}>
                      {lead.source_channel}
                    </span>
                  </td>
                  <td>
                    <select
                      className="input"
                      style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', width: 120 }}
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    {lead.payment_status !== 'none' && (
                      <span className={`badge ${paymentColors[lead.payment_status] || ''}`}>
                        {lead.payment_status}
                      </span>
                    )}
                    {lead.payment_amount && (
                      <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 2 }}>₹{lead.payment_amount}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm">View</button>
                    {lead.type === 'order' && lead.payment_status === 'none' && (
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleCreatePaymentLink(lead.id)}
                        style={{ marginLeft: 4 }}
                      >
                        💳 Pay Link
                      </button>
                    )}
                    {lead.payment_status !== 'none' && lead.payment_status !== 'paid' && lead.payment_link && (
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => {
                          navigator.clipboard.writeText(lead.payment_link!);
                          alert('Payment link copied to clipboard!');
                        }}
                        style={{ marginLeft: 4 }}
                        title="Copy payment link"
                      >
                        📋 Copy Link
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
