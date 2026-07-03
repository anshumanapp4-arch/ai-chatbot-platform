// ============================================
// App — Root Component with Routing
// ============================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.js';

// Layouts
import SidebarLayout from './layouts/SidebarLayout.js';

// Pages
import Login from './pages/auth/Login.js';
import Dashboard from './pages/client/Dashboard.js';
import Conversations from './pages/client/Conversations.js';
import Leads from './pages/client/Leads.js';
import KnowledgeBase from './pages/client/KnowledgeBase.js';
import BotSettings from './pages/client/BotSettings.js';
import WhatsAppConnection from './pages/client/WhatsAppConnection.js';
import Billing from './pages/client/Billing.js';
import AdminTenants from './pages/admin/AdminTenants.js';
import AdminUsage from './pages/admin/AdminUsage.js';

// Protected Route wrapper
function ProtectedRoute({ children, requireRole }: { children: React.ReactNode; requireRole?: string }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to={user?.role === 'super_admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

// Client Dashboard nav items
const clientNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/dashboard/conversations', label: 'Conversations', icon: '💬' },
  { path: '/dashboard/leads', label: 'Leads & Orders', icon: '📋' },
  { path: '/dashboard/knowledge', label: 'Knowledge Base', icon: '📚' },
  { path: '/dashboard/whatsapp', label: 'WhatsApp', icon: '📞' },
  { path: '/dashboard/billing', label: 'Billing', icon: '💳' },
  { path: '/dashboard/settings', label: 'Bot Settings', icon: '⚙️' },
];

// Admin Panel nav items
const adminNavItems = [
  { path: '/admin', label: 'Clients', icon: '🏢' },
  { path: '/admin/usage', label: 'Usage & Billing', icon: '📈' },
];

export default function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={
        isAuthenticated
          ? <Navigate to={user?.role === 'super_admin' ? '/admin' : '/dashboard'} replace />
          : <Login />
      } />

      {/* Client Dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <SidebarLayout title="ChatBot AI" navItems={clientNavItems} />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="leads" element={<Leads />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="whatsapp" element={<WhatsAppConnection />} />
        <Route path="billing" element={<Billing />} />
        <Route path="settings" element={<BotSettings />} />
      </Route>

      {/* Admin Panel */}
      <Route path="/admin" element={
        <ProtectedRoute requireRole="super_admin">
          <SidebarLayout title="Admin Panel" subtitle="Agency Control" navItems={adminNavItems} />
        </ProtectedRoute>
      }>
        <Route index element={<AdminTenants />} />
        <Route path="usage" element={<AdminUsage />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
