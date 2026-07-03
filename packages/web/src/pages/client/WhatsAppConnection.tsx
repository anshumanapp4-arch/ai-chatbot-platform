// ============================================
// Client: WhatsApp Connection Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

interface WhatsAppData {
  id: string;
  provider: string;
  phone_number: string;
  phone_number_id: string;
  waba_id: string;
  status: string;
  health_checked_at: string | null;
}

export default function WhatsAppConnection() {
  const [connection, setConnection] = useState<WhatsAppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    phone_number: '',
    phone_number_id: '',
    waba_id: '',
    access_token: '',
  });

  useEffect(() => {
    fetchConnection();
  }, []);

  async function fetchConnection() {
    try {
      const res = await api.get('/api/client/whatsapp');
      setConnection(res.data);
    } catch (error) {
      console.error('Failed to fetch WhatsApp connection:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/api/client/whatsapp', form);
      setConnection(res.data);
      setForm({ phone_number: '', phone_number_id: '', waba_id: '', access_token: '' });
    } catch (error: any) {
      alert(error.message || 'Failed to connect WhatsApp');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect WhatsApp? Your chatbot will stop responding on this channel.')) return;
    setSubmitting(true);
    try {
      await api.delete('/api/client/whatsapp');
      setConnection(null);
    } catch (error: any) {
      alert(error.message || 'Failed to disconnect');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">WhatsApp Integration</h1>
        </div>
        <div className="glass-card">
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Integration</h1>
          <p className="page-subtitle">Connect your chatbot to your WhatsApp Business number</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Connection Status Card */}
        <div className="glass-card">
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Connection Status
          </h2>
          {connection ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <span className="badge badge-green">Connected</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  Number: <strong>{connection.phone_number}</strong>
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
                <p>Phone Number ID: <code>{connection.phone_number_id}</code></p>
                <p>WABA Account ID: <code>{connection.waba_id}</code></p>
                {connection.health_checked_at && (
                  <p>Last checked: {new Date(connection.health_checked_at).toLocaleString()}</p>
                )}
              </div>
              <button className="btn btn-danger" onClick={handleDisconnect} disabled={submitting}>
                Disconnect Number
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <span className="badge badge-red">Disconnected</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>Not receiving messages</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                Configure your Meta Cloud API credentials below to connect your WhatsApp Business Account.
              </p>
            </div>
          )}
        </div>

        {/* Configuration Form (Only if disconnected) */}
        {!connection && (
          <div className="glass-card">
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
              Setup Credentials
            </h2>
            <form onSubmit={handleConnect}>
              <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="label">WhatsApp Phone Number</label>
                  <input
                    className="input"
                    placeholder="+1234567890"
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Phone Number ID</label>
                  <input
                    className="input"
                    placeholder="e.g. 10987654321"
                    value={form.phone_number_id}
                    onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">WhatsApp Business Account (WABA) ID</label>
                  <input
                    className="input"
                    placeholder="e.g. 123456789098765"
                    value={form.waba_id}
                    onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Permanent Access Token</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="EAAG..."
                    value={form.access_token}
                    onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--space-md)' }} disabled={submitting}>
                {submitting ? 'Connecting...' : 'Connect WhatsApp Number'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
