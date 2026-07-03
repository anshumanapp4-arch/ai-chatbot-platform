// ============================================
// Client: Knowledge Base Manager Page
// ============================================

import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api/client.js';

interface Source {
  id: string;
  type: string;
  origin: string;
  status: string;
  error_detail: string | null;
  pages_crawled: number;
  chunks_created: number;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  website: '🌐',
  pdf: '📄',
  docx: '📝',
  txt: '📃',
  audio: '🎵',
  video: '🎬',
  image: '🖼️',
};

const statusBadge: Record<string, string> = {
  queued: 'badge-blue',
  processing: 'badge-yellow',
  done: 'badge-green',
  failed: 'badge-red',
};

export default function KnowledgeBase() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [pageLimit, setPageLimit] = useState(50);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources();
    // Auto-refresh every 10s for status updates
    const interval = setInterval(fetchSources, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSources() {
    try {
      const res = await api.get('/api/client/sources?per_page=100');
      setSources(res.data);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addWebsite() {
    if (!url) return;
    try {
      await api.post('/api/client/sources/website', {
        url,
        crawl_depth: crawlDepth,
        page_limit: pageLimit,
      });
      setUrl('');
      setShowAddUrl(false);
      fetchSources();
    } catch (error: any) {
      alert(error.message || 'Failed to add website');
    }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.upload('/api/client/sources/upload', formData);
      fetchSources();
    } catch (error: any) {
      alert(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function reingest(id: string) {
    try {
      await api.post(`/api/client/sources/${id}/reingest`);
      fetchSources();
    } catch (error: any) {
      alert(error.message || 'Re-ingestion failed');
    }
  }

  async function deleteSource(id: string) {
    if (!confirm('Delete this source and all its indexed content?')) return;
    try {
      await api.delete(`/api/client/sources/${id}`);
      fetchSources();
    } catch (error: any) {
      alert(error.message || 'Delete failed');
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Knowledge Base</h1>
          <p className="page-subtitle">Manage your AI agent's data sources</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" onClick={() => setShowAddUrl(!showAddUrl)}>
            🌐 Add Website
          </button>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            📁 Upload File
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.mp3,.wav,.mp4,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={uploadFile}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Add Website Form */}
      {showAddUrl && (
        <div className="glass-card animate-slide-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-md)' }}>Add Website</h3>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 250, marginBottom: 0 }}>
              <label className="label">Website URL</label>
              <input
                className="input"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Crawl Depth</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={crawlDepth}
                onChange={(e) => setCrawlDepth(parseInt(e.target.value))}
                style={{ width: 80 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Page Limit</label>
              <input
                className="input"
                type="number"
                min={1}
                max={500}
                value={pageLimit}
                onChange={(e) => setPageLimit(parseInt(e.target.value))}
                style={{ width: 80 }}
              />
            </div>
            <button className="btn btn-primary" onClick={addWebsite}>
              Start Crawl
            </button>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8 }} />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <div className="empty-title">No sources added yet</div>
            <p>Add a website URL or upload files to build your AI agent's knowledge base.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Source</th>
                <th>Status</th>
                <th>Chunks</th>
                <th>Pages</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(source => (
                <tr key={source.id}>
                  <td>
                    <span style={{ fontSize: 20 }}>{typeIcons[source.type] || '📄'}</span>
                  </td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>
                    {source.origin}
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[source.status]}`}>{source.status}</span>
                    {source.status === 'failed' && source.error_detail && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-red)', marginTop: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {source.error_detail}
                      </div>
                    )}
                  </td>
                  <td>{source.chunks_created}</td>
                  <td>{source.type === 'website' ? source.pages_crawled : '—'}</td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>
                    {new Date(source.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => reingest(source.id)}
                        title="Re-ingest"
                      >
                        🔄
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteSource(source.id)}
                        title="Delete"
                        style={{ color: 'var(--color-accent-red)' }}
                      >
                        🗑️
                      </button>
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
