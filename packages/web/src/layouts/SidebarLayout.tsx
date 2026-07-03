// ============================================
// Sidebar Layout — Shared between Admin & Client
// ============================================

import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import './SidebarLayout.css';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface SidebarLayoutProps {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
}

export default function SidebarLayout({ title, subtitle, navItems }: SidebarLayoutProps) {
  const { user, tenant, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <span className="sidebar__logo">⚡</span>
            {!collapsed && <span className="sidebar__title">{title}</span>}
          </div>
          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
            >
              <span className="sidebar__icon">{item.icon}</span>
              {!collapsed && <span className="sidebar__label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          {!collapsed && (
            <div className="sidebar__user">
              <div className="sidebar__user-avatar">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="sidebar__user-info">
                <div className="sidebar__user-email">{user?.email}</div>
                <div className="sidebar__user-role">
                  {user?.role === 'super_admin' ? 'Admin' : tenant?.name || 'Client'}
                </div>
              </div>
            </div>
          )}
          <button className="sidebar__logout" onClick={handleLogout}>
            {collapsed ? '🚪' : '← Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
