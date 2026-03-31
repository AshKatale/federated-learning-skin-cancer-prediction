import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

/* SVG icon primitives */
const Icon = ({ d, ...rest }) => (
  <svg viewBox="0 0 24 24" {...rest}>
    <path d={d} />
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" strokeDasharray="none" />
    <path d="M15 15l3 3" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8v4l3 3" />
    <path d="M3.05 11a9 9 0 1 0 .49-2.62" />
    <path d="M3 4v5h5" />
  </svg>
);

const AdminIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    <path d="M19 11l2 2-4 4-2-2" />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// FL / brain icon — shown only in Electron desktop app
const FLIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.6 2.8-1.6 3.8" />
    <path d="M7 7a5 5 0 0 0 3.4 9.4" />
    <circle cx="12" cy="17" r="3" />
    <path d="M12 14v-3" />
    <path d="M9 17H6a2 2 0 0 1 0-4h1" />
    <path d="M15 17h3a2 2 0 0 0 0-4h-1" />
  </svg>
);

const DnaLogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" strokeWidth="0">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26A7 7 0 0019 9c0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 1.64-.79 3.09-2 4V15h-6v-2c-1.21-.91-2-2.36-2-4 0-2.76 2.24-5 5-5zm-1 16h2v2h-2zM8 22h8v-1H8z"/>
  </svg>
);

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'doctor';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <DnaLogoIcon />
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Dashboard"
          >
            <HomeIcon />
          </NavLink>

          <NavLink
            to="/predictions"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Prediction History"
          >
            <HistoryIcon />
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title="Profile"
          >
            <ProfileIcon />
          </NavLink>

          {/* FL Dashboard — only visible in Electron desktop app */}
          {typeof window !== 'undefined' && window.electronAPI && (
            <NavLink
              to="/fl"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title="Federated Learning"
            >
              <FLIcon />
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title="Admin / FL Dashboard"
            >
              <AdminIcon />
            </NavLink>
          )}
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-bottom">
          <button className="sidebar-link" title="Help">
            <HelpIcon />
          </button>
          <button className="sidebar-link" title="Logout" onClick={handleLogout}>
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-welcome">
            <span>👋</span>
            <span>Welcome Back, <strong>{user.firstName || 'User'}</strong>!</span>
            <span className="role-badge">{user.role === 'admin' ? 'Admin' : user.role === 'doctor' ? 'Doctor' : 'Patient'}</span>
          </div>
          <div className="topbar-right">
            <NavLink to="/profile" className="topbar-avatar">
              <div className="avatar-circle">{initials}</div>
              <span className="avatar-name">{user.firstName} {user.lastName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-3)', marginLeft:2}}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </NavLink>
          </div>
        </header>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
