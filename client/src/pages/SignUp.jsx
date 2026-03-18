import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function SignUp() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    age: '',
    gender: 'male',
    role: 'user',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...submitData } = formData;
      const response = await authService.register(submitData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <ScanIcon />
          </div>
          <h1>Create Account</h1>
          <p>Join the DermaAI platform</p>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email address</label>
            <input id="signup-email" type="email" name="email" value={formData.email} onChange={handleChange} required className="form-input" placeholder="you@example.com" />
          </div>

          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-first">First name</label>
              <input id="signup-first" type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="form-input" placeholder="John" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-last">Last name</label>
              <input id="signup-last" type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="form-input" placeholder="Doe" />
            </div>
          </div>

          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-age">Age</label>
              <input id="signup-age" type="number" name="age" value={formData.age} onChange={handleChange} min="1" max="150" className="form-input" placeholder="30" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-gender">Gender</label>
              <select id="signup-gender" name="gender" value={formData.gender} onChange={handleChange} className="form-select">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-role">Role</label>
            <select id="signup-role" name="role" value={formData.role} onChange={handleChange} className="form-select">
              <option value="user">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>

          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-pwd">Password</label>
              <input id="signup-pwd" type="password" name="password" value={formData.password} onChange={handleChange} required className="form-input" placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-cpwd">Confirm</label>
              <input id="signup-cpwd" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="form-input" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-wide btn-lg" style={{ marginTop: 6 }}>
            {loading ? (
              <><span className="spinner" style={{width:16,height:16,borderWidth:2}} /> Creating Account…</>
            ) : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
