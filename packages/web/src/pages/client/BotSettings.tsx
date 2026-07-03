// ============================================
// Client: Bot Settings Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function BotSettings() {
  const [settings, setSettings] = useState({
    bot_persona: '',
    fallback_message: '',
    handoff_trigger: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get('/api/client/settings');
        setSettings({
          bot_persona: res.data.bot_persona || '',
          fallback_message: res.data.fallback_message || '',
          handoff_trigger: res.data.handoff_trigger || '',
        });
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/client/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      alert(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handlePurgeData() {
    const confirmation = prompt('WARNING: This will permanently delete all your knowledge base files, scraped links, conversation history, and captured customer leads. This action CANNOT be undone.\n\nType "PURGE ALL" to confirm:');
    if (confirmation !== 'PURGE ALL') {
      alert('Confirmation failed. Data was not purged.');
      return;
    }

    setPurging(true);
    try {
      await api.delete('/api/client/settings/purge');
      alert('All tenant data, chunks, and customer PII have been purged successfully.');
    } catch (error: any) {
      alert(error.message || 'Purge failed');
    } finally {
      setPurging(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Bot Settings</h1>
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
          <h1 className="page-title">Bot Settings</h1>
          <p className="page-subtitle">Configure your AI agent's behavior and personality</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {saved && (
            <span style={{ color: 'var(--color-accent-green)', fontSize: 'var(--font-size-sm)' }}>
              ✓ Saved successfully
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Persona/System Prompt */}
        <div className="glass-card">
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            🤖 Bot Persona
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            Define your AI agent's personality, tone, and business rules. This is the system prompt that guides all responses.
          </p>
          <textarea
            className="input"
            rows={8}
            placeholder={`Example: You are a friendly and professional customer support agent for Acme Corp, a premium electronics retailer. Always be helpful, maintain a warm tone, and prioritize customer satisfaction. When a customer asks about pricing, always collect their phone number first.`}
            value={settings.bot_persona}
            onChange={(e) => setSettings({ ...settings, bot_persona: e.target.value })}
            style={{ fontFamily: 'var(--font-family)', resize: 'vertical' }}
          />
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
            {settings.bot_persona.length}/5000 characters
          </div>
        </div>

        {/* Fallback Message */}
        <div className="glass-card">
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            🚫 Fallback Message
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            This message is sent when the bot doesn't have relevant information in its knowledge base.
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder="I'm sorry, I don't have information about that. Would you like to speak with a human?"
            value={settings.fallback_message}
            onChange={(e) => setSettings({ ...settings, fallback_message: e.target.value })}
          />
        </div>

        {/* Handoff Rules */}
        <div className="glass-card">
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            🤝 Human Handoff Trigger
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            Define rules for when the bot should hand off to a human agent. Leave empty for default behavior (customer explicitly asks for a human).
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder="Example: If the customer mentions 'complaint', 'refund', or 'cancel', immediately offer to connect them with a human representative."
            value={settings.handoff_trigger}
            onChange={(e) => setSettings({ ...settings, handoff_trigger: e.target.value })}
          />
        </div>

        {/* Danger Zone */}
        <div className="glass-card" style={{ border: '1px solid rgba(248, 113, 113, 0.3)', background: 'rgba(248, 113, 113, 0.03)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-accent-red)', marginBottom: 'var(--space-sm)' }}>
            ⚠️ Danger Zone
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Permanently delete all custom configurations, RAG files, scrapers, chat history, and captured customer leads. This action cannot be undone.
          </p>
          <button className="btn btn-danger" onClick={handlePurgeData} disabled={purging}>
            {purging ? 'Purging Data...' : 'Purge All My Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
