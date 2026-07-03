// ============================================
// API Client — Fetch wrapper with auth
// ============================================

import { useAuthStore } from '../stores/authStore.js';

const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${BASE_URL}${path}`;

    const res = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle token refresh on 401
    if (res.status === 401) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            useAuthStore.getState().setTokens(data.data.access_token, data.data.refresh_token);

            // Retry original request with new token
            const retryRes = await fetch(url, {
              method,
              headers: {
                ...this.getHeaders(),
                Authorization: `Bearer ${data.data.access_token}`,
              },
              body: body ? JSON.stringify(body) : undefined,
            });
            const retryData = await retryRes.json();
            if (!retryRes.ok) throw new Error(retryData.error || 'Request failed');
            return retryData;
          }
        } catch {
          // Refresh failed — force logout
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      }
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  }

  get(path: string) { return this.request('GET', path); }
  post(path: string, body?: unknown) { return this.request('POST', path, body); }
  put(path: string, body?: unknown) { return this.request('PUT', path, body); }
  patch(path: string, body?: unknown) { return this.request('PATCH', path, body); }
  delete(path: string) { return this.request('DELETE', path); }

  // Special method for file upload
  async upload(path: string, formData: FormData): Promise<any> {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  // Download file
  async download(path: string, filename: string): Promise<void> {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();
