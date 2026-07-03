// ============================================
// Admin: Tenants Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  website_url: string;
  source_count: number;
  conversation_count: number;
  lead_count: number;
  created_at: string;
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    website_url: '',
    client_email: '',
    client_password: '',
  });

  useEffect(() => {
    fetchTenants();
  }, [search]);

  async function fetchTenants() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/api/admin/tenants?${params}`);
      setTenants(res.data);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createTenant() {
    try {
      const res = await api.post('/api/admin/tenants', form);
      alert(`Tenant created!\nClient login: ${form.client_email}\nPassword: ${res.data.generated_password}`);
      setShowCreate(false);
      setForm({ name: '', slug: '', website_url: '', client_email: '', client_password: '' });
      fetchTenants();
    } catch (error: any) {
      alert(error.message || 'Failed to create tenant');
    }
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage all tenant businesses</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          ➕ Create Client
        </button>
      </div>

      {/* Create Client Form */}
      {showCreate && (
        <div className="glass-card animate-slide-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            🏢 New Client Wizard
          </h3>
          <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="label">Business Name *</label>
              <input
                className="input"
                placeholder="Acme Corp"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="label">Slug *</label>
              <input
                className="input"
                placeholder="acme-corp"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="label">Website URL</label>
              <input
                className="input"
                placeholder="https://acmecorp.com"
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="label">Client Email *</label>
              <input
                className="input"
                type="email"
                placeholder="owner@acmecorp.com"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createTenant}>Create & Generate Login</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <input
          className="input"
          placeholder="Search clients by name or slug..."
          style={{ maxWidth: 360 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tenants Table */}
      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Sources</th>
                <th>Conversations</th>
                <th>Leads</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{t.name}</td>
                  <td><code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-secondary)' }}>{t.slug}</code></td>
                  <td>
                    <span className={`badge ${t.status === 'active' ? 'badge-green' : t.status === 'suspended' ? 'badge-yellow' : 'badge-red'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>{t.source_count}</td>
                  <td>{t.conversation_count}</td>
                  <td>{t.lead_count}</td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" title="Impersonate">👤</button>
                      <button className="btn btn-ghost btn-sm" title="Edit">✏️</button>
                    </div>
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
