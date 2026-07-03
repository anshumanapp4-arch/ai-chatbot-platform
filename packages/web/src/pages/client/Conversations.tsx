// ============================================
// Client: Conversations Page
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

interface Conversation {
  id: string;
  channel: string;
  customer_identifier: string;
  status: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  last_message: string;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [filter, setFilter] = useState({ channel: '', status: '', search: '' });

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  async function fetchConversations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.channel) params.set('channel', filter.channel);
      if (filter.status) params.set('status', filter.status);
      if (filter.search) params.set('search', filter.search);
      const res = await api.get(`/api/client/conversations?${params}`);
      setConversations(res.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function viewConversation(id: string) {
    setSelected(id);
    const res = await api.get(`/api/client/conversations/${id}`);
    setMessages(res.data.messages);
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">View and manage customer conversations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Search by customer..."
          style={{ maxWidth: 240 }}
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        />
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={filter.channel}
          onChange={(e) => setFilter({ ...filter, channel: e.target.value })}
        >
          <option value="">All Channels</option>
          <option value="web">Web</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="handled">Handled</option>
          <option value="handoff">Handoff</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
        {/* Conversation List */}
        <div className="glass-card" style={{ flex: '0 0 400px', maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-lg)' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <div className="empty-title">No conversations yet</div>
              <p>Conversations will appear here when customers start chatting.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => viewConversation(conv.id)}
                style={{
                  padding: '12px var(--space-md)',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  background: selected === conv.id ? 'var(--color-bg-glass)' : 'transparent',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-glass)'}
                onMouseLeave={(e) => e.currentTarget.style.background = selected === conv.id ? 'var(--color-bg-glass)' : 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {conv.customer_identifier?.slice(0, 20) || 'Anonymous'}
                  </span>
                  <span className={`badge ${conv.channel === 'whatsapp' ? 'badge-green' : 'badge-blue'}`}>
                    {conv.channel}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message?.slice(0, 60) || 'No messages'}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {new Date(conv.last_message_at).toLocaleString()} · {conv.message_count} msgs
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Thread */}
        <div className="glass-card" style={{ flex: 1, maxHeight: '70vh', overflowY: 'auto' }}>
          {!selected ? (
            <div className="empty-state">
              <div className="empty-icon">👈</div>
              <div className="empty-title">Select a conversation</div>
              <p>Click on a conversation to view the message thread.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    maxWidth: '80%',
                    alignSelf: msg.role === 'customer' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'customer'
                      ? 'var(--color-brand-primary)'
                      : 'var(--color-bg-tertiary)',
                    color: msg.role === 'customer' ? 'white' : 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    lineHeight: 1.5,
                  }}
                >
                  <div>{msg.content}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.6, marginTop: 4 }}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
