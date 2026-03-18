import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { authService } from '../services/api';

const TABS = ['profile', 'password'];

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', age: '', gender: 'M', phone: '', organization: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const response = await authService.getProfile();
        const u = response.data.user;
        setUser(u);
        setFormData({
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          age: u.age || '',
          gender: u.gender || 'M',
          phone: u.phone || '',
          organization: u.organization || '',
        });
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setUpdating(true);
    try {
      await authService.updateProfile(formData);
      setSuccess('Profile updated successfully');
      // update localStorage cache
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...formData }));
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally { setUpdating(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match'); return;
    }
    setUpdating(true);
    try {
      await authService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });
      setSuccess('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Password change failed');
    } finally { setUpdating(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  if (loading) {
    return (
      <AppShell>
        <div className="page">
          <div className="loading-state"><div className="spinner" /><span>Loading profile…</span></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Profile</div>
            <div className="page-subtitle">Manage your account information</div>
          </div>
          <button onClick={handleLogout} className="btn btn-danger btn-sm">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems:'start' }}>
          {/* Profile Card */}
          <div className="card" style={{ textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, margin:'0 auto 14px' }}>
              {initials}
            </div>
            <div style={{ fontWeight:700, fontSize:17, color:'var(--text-1)' }}>{user?.firstName} {user?.lastName}</div>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>{user?.email}</div>
            <div style={{ marginTop:10 }}>
              <span className="badge badge-blue">{user?.role || 'user'}</span>
            </div>

            <div style={{ marginTop:20, padding:'16px 0', borderTop:'1px solid var(--border)' }}>
              {[
                ['Gender', user?.gender === 'M' ? 'Male' : user?.gender === 'F' ? 'Female' : 'Other'],
                ['Age', user?.age || '—'],
                ['Phone', user?.phone || '—'],
                ['Organization', user?.organization || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13 }}>
                  <span style={{ color:'var(--text-3)' }}>{k}</span>
                  <span style={{ fontWeight:500, color:'var(--text-1)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Panel */}
          <div className="card">
            {/* Tabs */}
            <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:22 }}>
              {[['profile','Edit Profile'],['password','Change Password']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setError(''); setSuccess(''); }}
                  style={{
                    padding:'10px 20px',
                    border:'none',
                    background:'transparent',
                    cursor:'pointer',
                    fontFamily:'var(--font)',
                    fontSize:13.5,
                    fontWeight:600,
                    color: activeTab === id ? 'var(--primary)' : 'var(--text-3)',
                    borderBottom: activeTab === id ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom:-1,
                    transition:'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Alerts */}
            {error && <div className="alert alert-error mb-4">{error}</div>}
            {success && <div className="alert alert-success mb-4">{success}</div>}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleProfileChange} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleProfileChange} className="form-input" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleProfileChange} className="form-input" placeholder="+1 (555) 000-0000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Organization / Hospital</label>
                  <input type="text" name="organization" value={formData.organization} onChange={handleProfileChange} className="form-input" placeholder="e.g. City General Hospital" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Age</label>
                    <input type="number" name="age" value={formData.age} onChange={handleProfileChange} className="form-input" min="1" max="150" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleProfileChange} className="form-select">
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={updating} className="btn btn-primary" style={{ marginTop:4, alignSelf:'flex-start' }}>
                  {updating ? 'Updating…' : 'Update Profile'}
                </button>
              </form>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <form onSubmit={handleChangePassword} style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:360 }}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required className="form-input" />
                </div>
                <button type="submit" disabled={updating} className="btn btn-primary" style={{ marginTop:4, alignSelf:'flex-start' }}>
                  {updating ? 'Changing…' : 'Change Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
