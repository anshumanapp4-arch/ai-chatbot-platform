// ============================================
// Client Dashboard — Overview Page
// ============================================

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { api } from '../../api/client.js';
import './Dashboard.css';

interface Stats {
  conversations: { total: number; active: number };
  leads: { total: number; new: number };
  sources: { total: number; processing: number };
  messages: { total: number };
}

interface VolumeData {
  date: string;
  conversations: number;
  web_count: number;
  whatsapp_count: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [volume, setVolume] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, volumeRes] = await Promise.all([
          api.get('/api/client/analytics/overview'),
          api.get('/api/client/analytics/volume?days=30'),
        ]);
        setStats(statsRes.data);
        setVolume(volumeRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Overview of your AI chatbot performance</p>
          </div>
        </div>
        <div className="grid grid-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card">
              <div className="skeleton" style={{ height: 80 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your AI chatbot performance</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-4">
        <div className="glass-card stat-card">
          <div className="stat-label">Total Conversations</div>
          <div className="stat-value">{stats?.conversations.total || 0}</div>
          <div className="stat-sub">
            <span className="badge badge-green">{stats?.conversations.active || 0} active</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-label">Leads Captured</div>
          <div className="stat-value">{stats?.leads.total || 0}</div>
          <div className="stat-sub">
            <span className="badge badge-yellow">{stats?.leads.new || 0} new</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-label">Knowledge Sources</div>
          <div className="stat-value">{stats?.sources.total || 0}</div>
          <div className="stat-sub">
            {(stats?.sources.processing || 0) > 0 && (
              <span className="badge badge-blue">{stats?.sources.processing} processing</span>
            )}
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-label">Total Messages</div>
          <div className="stat-value">{stats?.messages.total || 0}</div>
        </div>
      </div>

      {/* Conversation Volume Chart */}
      <div className="glass-card dashboard-chart" style={{ marginTop: 'var(--space-lg)' }}>
        <h2 className="chart-title">Conversation Volume (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={volume}>
            <defs>
              <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorWeb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v) => new Date(v).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#f1f5f9',
                fontSize: '13px',
              }}
            />
            <Area type="monotone" dataKey="conversations" stroke="#6c63ff" fill="url(#colorConv)" strokeWidth={2} name="Total" />
            <Area type="monotone" dataKey="web_count" stroke="#60a5fa" fill="url(#colorWeb)" strokeWidth={2} name="Web" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
