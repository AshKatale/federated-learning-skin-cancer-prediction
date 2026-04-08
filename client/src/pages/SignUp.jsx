import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import './Login.css'; /* reuses the same split-panel CSS */

/* ── Icons ─────────────────────────────────────────── */
const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
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
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
    <path d="M12 7v4M5 17l7-6M19 17l-7-6" />
  </svg>
);

/* ── Orbs (reused animation) ───────────────────────── */
function Orbs() {
  return (
    <div className="login-orbs" aria-hidden="true">
      <div className="login-orb login-orb-1" style={{ background: 'rgba(52,211,153,0.22)' }} />
      <div className="login-orb login-orb-2" style={{ background: 'rgba(37,99,235,0.28)' }} />
      <div className="login-orb login-orb-3" style={{ background: 'rgba(124,58,237,0.18)' }} />
    </div>
  );
}

/* ── Left panel info blocks ────────────────────────── */
function InfoSteps() {
  const steps = [
    { icon: <UserIcon />,    title: 'Create your account',      desc: 'Give us your name, email and role — takes 30 seconds.' },
    { icon: <ScanIcon />,    title: 'Upload a skin lesion image', desc: 'Our AI analyses it across 7 cancer classes instantly.' },
    { icon: <ShieldIcon />,  title: 'Get a private result',      desc: 'Predictions stay on your device. Nothing is stored in the cloud.' },
    { icon: <NetworkIcon />, title: 'Contribute to FL training',  desc: 'Optionally help improve the global model without sharing patient data.' },
  ];
  return (
    <div className="su-steps">
      {steps.map((s, i) => (
        <div key={i} className="su-step">
          <div className="su-step-icon">{s.icon}</div>
          <div>
            <div className="su-step-title">{s.title}</div>
            <div className="su-step-desc">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────── */
export default function SignUp() {
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', age: '',
    gender: 'male', role: 'user',
  });
  const [showPwd,  setShowPwd]  = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      const { confirmPassword, ...submitData } = formData;
      const response = await authService.register(submitData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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

        {/* Hero text */}
        <div className="login-left-hero">
          <div className="login-left-tag">Join the Platform</div>
          <h2 className="login-left-title">
            Clinical AI, built
            <br />for every clinician
          </h2>
        </div>

        {/* Step list */}
        <InfoSteps />

      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="login-form-box" style={{ maxWidth: 440 }}>

          <div className="login-form-header">
            <h1>Create account</h1>
            <p>Join DermaAI and start detecting skin conditions with AI</p>
          </div>

          {error && (
            <div className="login-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>

            {/* Name row */}
            <div className="lf-row-2">
              <div className="lf-group">
                <label htmlFor="su-first" className="lf-label">First name</label>
                <input id="su-first" type="text" name="firstName" value={formData.firstName}
                  onChange={handleChange} required className="lf-input" placeholder="John" />
              </div>
              <div className="lf-group">
                <label htmlFor="su-last" className="lf-label">Last name</label>
                <input id="su-last" type="text" name="lastName" value={formData.lastName}
                  onChange={handleChange} required className="lf-input" placeholder="Doe" />
              </div>
            </div>

            {/* Email */}
            <div className="lf-group">
              <label htmlFor="su-email" className="lf-label">Email address</label>
              <input id="su-email" type="email" name="email" value={formData.email}
                onChange={handleChange} required className="lf-input"
                placeholder="doctor@hospital.com" autoComplete="email" />
            </div>

            {/* Age + Gender row */}
            <div className="lf-row-2">
              <div className="lf-group">
                <label htmlFor="su-age" className="lf-label">Age</label>
                <input id="su-age" type="number" name="age" value={formData.age}
                  onChange={handleChange} min="1" max="150" className="lf-input" placeholder="30" />
              </div>
              <div className="lf-group">
                <label htmlFor="su-gender" className="lf-label">Gender</label>
                <select id="su-gender" name="gender" value={formData.gender}
                  onChange={handleChange} className="lf-input lf-select">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Role */}
            <div className="lf-group">
              <label htmlFor="su-role" className="lf-label">Role</label>
              <select id="su-role" name="role" value={formData.role}
                onChange={handleChange} className="lf-input lf-select">
                <option value="user">Patient</option>
                <option value="doctor">Doctor / Clinician</option>
              </select>
            </div>

            {/* Password row */}
            <div className="lf-row-2">
              <div className="lf-group">
                <label htmlFor="su-pwd" className="lf-label">Password</label>
                <div className="lf-input-wrap">
                  <input id="su-pwd" type={showPwd ? 'text' : 'password'} name="password"
                    value={formData.password} onChange={handleChange} required
                    className="lf-input" placeholder="Min 6 chars" />
                  <button type="button" className="lf-eye" onClick={() => setShowPwd(v => !v)}>
                    <EyeIcon off={showPwd} />
                  </button>
                </div>
              </div>
              <div className="lf-group">
                <label htmlFor="su-cpwd" className="lf-label">Confirm</label>
                <div className="lf-input-wrap">
                  <input id="su-cpwd" type={showCPwd ? 'text' : 'password'} name="confirmPassword"
                    value={formData.confirmPassword} onChange={handleChange} required
                    className="lf-input" placeholder="••••••••" />
                  <button type="button" className="lf-eye" onClick={() => setShowCPwd(v => !v)}>
                    <EyeIcon off={showCPwd} />
                  </button>
                </div>
              </div>
            </div>

            <button id="signup-submit-btn" type="submit" disabled={loading} className="lf-submit">
              {loading ? (
                <><span className="lf-spinner" /> Creating account…</>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="login-form-footer">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>

    </div>
  );
}
