import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import './Login.css';

/* ── Icons ─────────────────────────────────────────── */
const EyeIcon = ({ off }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 017 4.5v1a2 2 0 01-2 2H4a2 2 0 00-2 2v1c0 1.1.9 2 2 2h1a2 2 0 012 2v1A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v-1a2 2 0 012-2h1a2 2 0 002-2v-1a2 2 0 00-2-2h-1a2 2 0 01-2-2v-1A2.5 2.5 0 0014.5 2h-5z"/>
  </svg>
);

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
    <path d="M12 7v4M5 17l7-6M19 17l-7-6" />
  </svg>
);


/* ── Animated floating orbs ────────────────────────── */
function Orbs() {
  return (
    <div className="login-orbs" aria-hidden="true">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
    </div>
  );
}

/* ── Scan animation ────────────────────────────────── */
function ScanDemo() {
  const [scanPos, setScanPos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setScanPos(p => (p >= 100 ? 0 : p + 0.8)), 30);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="login-scan-demo">
      <div className="lsd-frame">
        {/* Corner brackets */}
        <div className="lsd-corner lsd-tl" /><div className="lsd-corner lsd-tr" />
        <div className="lsd-corner lsd-bl" /><div className="lsd-corner lsd-br" />
        {/* Scan line */}
        <div className="lsd-scanline" style={{ top: `${scanPos}%` }} />
        {/* Center icon */}
        <div className="lsd-icon">
          <ScanIcon />
        </div>
        {/* Probability bars */}
        <div className="lsd-results">
          {[
            { label: 'Melanocytic Nevi', pct: 87, color: '#34d399' },
            { label: 'Dermatofibroma',    pct: 8,  color: '#60a5fa' },
            { label: 'Melanoma',          pct: 5,  color: '#f59e0b' },
          ].map(r => (
            <div key={r.label} className="lsd-row">
              <span>{r.label}</span>
              <div className="lsd-bar-track">
                <div className="lsd-bar-fill" style={{ width: `${r.pct}%`, background: r.color }} />
              </div>
              <span style={{ color: r.color, fontWeight: 700 }}>{r.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="lsd-badge lsd-badge-safe">🟢 Low Risk · 87% Confidence</div>
    </div>
  );
}

/* ── Main Login Component ─────────────────────────── */
export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.login({ email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setTimeout(() => navigate('/dashboard'), 100);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <Orbs />

        {/* Brand */}
        <div className="login-left-brand">
          <div className="login-left-logo">
            <ScanIcon />
          </div>
          <span className="login-left-appname">DermaAI</span>
        </div>

        {/* Hero copy */}
        <div className="login-left-hero">
          <div className="login-left-tag">AI-Powered Detection</div>
          <h2 className="login-left-title">
            Detect skin cancer
            <br />
            with clinical-grade AI
          </h2>
          <p className="login-left-desc">
            Federated learning across hospitals — no patient data ever shared.
            Accurate, private, and built for clinicians.
          </p>
        </div>

        {/* Live scan demo */}
        <ScanDemo />

        {/* Feature chips */}
        <div className="login-left-features">
          {[
            { icon: <ShieldIcon />,  text: 'HIPAA Compliant' },
            { icon: <BrainIcon />,   text: 'EfficientNet-B0' },
            { icon: <NetworkIcon />, text: 'Federated Learning' },
          ].map(f => (
            <div key={f.text} className="login-feature-chip">
              {f.icon}
              <span>{f.text}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="login-form-box">

          {/* Header */}
          <div className="login-form-header">
            <h1>Welcome back</h1>
            <p>Sign in to your DermaAI account to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form" noValidate>

            <div className="lf-group">
              <label htmlFor="login-email" className="lf-label">Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="lf-input"
                placeholder="doctor@hospital.com"
                autoComplete="email"
              />
            </div>

            <div className="lf-group">
              <div className="lf-label-row">
                <label htmlFor="login-password" className="lf-label">Password</label>
                <a href="#" className="lf-forgot">Forgot password?</a>
              </div>
              <div className="lf-input-wrap">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="lf-input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="lf-eye" onClick={() => setShowPwd(v => !v)} aria-label="Toggle password">
                  <EyeIcon off={showPwd} />
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="lf-submit"
            >
              {loading ? (
                <><span className="lf-spinner" /> Signing in…</>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="login-form-footer">
            Don't have an account?{' '}
            <Link to="/signup">Create account</Link>
          </p>
        </div>
      </div>

    </div>
  );
}
