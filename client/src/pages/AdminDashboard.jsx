import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { flService } from '../services/api';
import { useFLContext } from '../context/FLContext';

const StatusBadge = ({ status }) => {
  if (status === 'completed') return <span className="badge badge-green">Completed</span>;
  if (status === 'active') return <span className="badge badge-blue">Active</span>;
  return <span className="badge badge-yellow">{status}</span>;
};

export default function AdminDashboard() {
  // Get global state from context
  const flContext = useFLContext();
  const { rounds, analytics, setRounds, setAnalytics } = flContext;
  
  // Local UI state
  const [loading, setLoading] = useState(true);
  const [initiatingRound, setInitiatingRound] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState([]);
  const [stoppingRound, setStoppingRound] = useState(false);
  const [error, setError] = useState('');
  const [localNode, setLocalNode] = useState(null);
  const [isElectron] = useState(!!window.electronAPI);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin' && user.role !== 'doctor') navigate('/dashboard');
    fetchData();
    
    // Poll for updates every 30 seconds (less aggressive than before)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [roundsRes, analyticsRes] = await Promise.all([
        flService.getAllRounds(1, 10),
        flService.getAnalytics(),
      ]);
      
      // Update global state
      setRounds(roundsRes.data?.data?.rounds || roundsRes.data?.rounds || []);
      
      const raw = analyticsRes.data?.analytics || analyticsRes.data || null;
      if (raw) {
        raw.accuracyTrend = raw.accuracyTrend || [];
        raw.lossTrend     = raw.lossTrend     || [];
      }
      setAnalytics(raw);

      if (window.electronAPI) {
        const status = await window.electronAPI.flStatus();
        if (!status.error) setLocalNode(status);
      }
    } catch (err) {
      setError('Failed to load federated learning data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique clients from round history
  const getAvailableClients = () => {
    const clients = new Set();
    rounds.forEach(round => {
      if (round.clients && Array.isArray(round.clients)) {
        round.clients.forEach(client => {
          if (typeof client === 'string') {
            clients.add(client);
          } else if (client.id) {
            clients.add(client.id);
          } else if (client.clientId) {
            clients.add(client.clientId);
          }
        });
      }
    });
    return Array.from(clients).sort();
  };

  // Calculate the next round number based on active round or highest round
  const getNextRoundNumber = () => {
    let nextRound = 1;
    
    // Check active round from analytics
    if (analytics?.activeRound?.roundNumber) {
      nextRound = Math.max(nextRound, analytics.activeRound.roundNumber + 1);
    }
    
    // Check total rounds from analytics
    if (analytics?.totalRounds) {
      nextRound = Math.max(nextRound, analytics.totalRounds + 1);
    }
    
    // Check all rounds in the array to find max
    if (rounds.length > 0) {
      const maxRound = Math.max(...rounds.map(r => r.roundNumber || 0));
      nextRound = Math.max(nextRound, maxRound + 1);
    }
    
    return nextRound;
  };

  const handleInitiateRound = async () => {
    setInitiatingRound(true);
    try {
      const clientList = selectedClients.length > 0 ? selectedClients : [];
      
      await flService.initiateRound({ clientList });
      setError('');
      setSelectedClients([]); // Clear selection
      setShowClientModal(false);
      // Refresh data immediately
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate round');
    } finally {
      setInitiatingRound(false);
    }
  };

  const handleSelectAllClients = () => {
    const allClients = getAvailableClients();
    if (selectedClients.length === allClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(allClients);
    }
  };

  const toggleClientSelection = (clientId) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleStopRound = async () => {
    if (!analytics?.activeRound) return;
    if (!window.confirm(`Stop round ${analytics.activeRound.roundNumber}? This cannot be undone.`)) return;
    
    setStoppingRound(true);
    try {
      const response = await flService.stopRound({ roundNumber: analytics.activeRound.roundNumber });
      setError('');
      if (response.data?.success) {
        alert('Round stopped successfully');
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to stop round');
    } finally {
      setStoppingRound(false);
    }
  };

  const handleChangeDataset = async () => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.selectDatasetFolder();
    if (!res.canceled && !res.error) {
      fetchData(); // refresh status
    }
  };

  const handleForceTrain = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.flTrain();
    alert('Training started locally (see terminal).');
  };

  return (
    <AppShell>
      <div className="page">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Federated Learning Dashboard</div>
            <div className="page-subtitle">Monitor and manage distributed model training rounds</div>
          </div>
          <button
            onClick={() => setShowClientModal(true)}
            disabled={initiatingRound}
            className="btn btn-primary"
          >
            {initiatingRound ? (
              <><span className="spinner" style={{width:14,height:14,borderWidth:2}} /> Initiating…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start New Round
              </>
            )}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-state"><div className="spinner" /><span>Loading FL data…</span></div>
        ) : (
          <>
            {/* Analytics Stats */}
            {analytics && (
              <>
                <div className="stats-grid">
                  {[
                    { label: 'Total Rounds', value: analytics.totalRounds },
                    { label: 'Completed Rounds', value: analytics.completedRounds, valueClass: 'accent' },
                    { label: 'Best Accuracy', value: `${analytics.bestAccuracy}%`, valueClass: 'accent' },
                    { label: 'Avg Accuracy', value: `${analytics.averageAccuracy}%`, valueClass: 'primary' },
                    { label: 'Active Clients', value: analytics.activeClientsCount },
                  ].map(({ label, value, valueClass }) => (
                    <div key={label} className="stat-card">
                      <div className="stat-label">{label}</div>
                      <div className={`stat-value ${valueClass || ''}`}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Active Round Status */}
                {analytics.activeRound && (
                  <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div className="card-title" style={{ marginBottom: 4 }}>
                          🔄 Active Round #{analytics.activeRound.roundNumber}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                          Status: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{analytics.activeRound.status.toUpperCase()}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleStopRound}
                        disabled={stoppingRound}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: stoppingRound ? 'not-allowed' : 'pointer',
                          opacity: stoppingRound ? 0.6 : 1,
                        }}
                      >
                        {stoppingRound ? '⏹ Stopping…' : '⏹ Stop Round'}
                      </button>
                    </div>

                    {/* Client Progress */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Client Progress</span>
                        <span style={{ color: 'var(--text-3)' }}>
                          {analytics.activeRound.completedClients} / {analytics.activeRound.totalClients} completed
                        </span>
                      </div>
                      <div style={{
                        height: 24,
                        background: 'var(--surface-2)',
                        borderRadius: 6,
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${analytics.activeRound.totalClients > 0 ? (analytics.activeRound.completedClients / analytics.activeRound.totalClients * 100) : 0}%`,
                          background: 'linear-gradient(90deg, #10b981, #059669)',
                          transition: 'width 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingRight: 8,
                        }}>
                          {analytics.activeRound.totalClients > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                              {Math.round((analytics.activeRound.completedClients / analytics.activeRound.totalClients * 100))}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Client List */}
                    {analytics.activeRound.clients && analytics.activeRound.clients.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                          Clients in this Round
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                          {analytics.activeRound.clients.map((client) => (
                            <div key={client.clientId} style={{
                              padding: 12,
                              background: 'var(--surface-2)',
                              borderRadius: 6,
                              border: `1px solid var(--border)`,
                              fontSize: 12,
                            }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                                {client.clientId}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)' }}>
                                <span>Status:</span>
                                <span style={{
                                  fontWeight: 600,
                                  color: client.status === 'submitted' || client.status === 'trained' ? '#10b981' : '#f59e0b',
                                }}>
                                  {client.status}
                                </span>
                              </div>
                              {client.samplesUsed && (
                                <div style={{ marginTop: 4, color: 'var(--text-3)' }}>
                                  Samples: <strong>{client.samplesUsed}</strong>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Desktop Node Controls */}
            {isElectron && localNode && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="card-title">Local Training Node (Desktop)</span>
                  <StatusBadge status="active" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>Dataset Directory</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <code style={{ fontSize: 13, flex: 1, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {localNode.data_dir || 'Not Selected'}
                      </code>
                      <button onClick={handleChangeDataset} className="btn btn-secondary btn-sm" style={{ padding: '0 12px' }}>Browse</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Actions</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleForceTrain} className="btn btn-primary btn-sm">Force Local Training</button>
                      <button onClick={async () => { await window.electronAPI?.flSync(); fetchData(); }} className="btn btn-secondary btn-sm">Sync Global Model</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trend Charts */}
            {analytics && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                {/* Accuracy Trend */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Accuracy Trend</span>
                  </div>
                  {(analytics.accuracyTrend?.length ?? 0) === 0 ? (
                    <div className="empty-state" style={{ padding: '24px 0' }}>
                      <p>No trend data yet</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:250, overflowY:'auto' }}>
                      {analytics.accuracyTrend.map((item) => (
                        <div key={item.round} className="accuracy-bar-wrap">
                          <span style={{ minWidth:36, fontSize:12, fontWeight:600, color:'var(--text-3)' }}>R{item.round}</span>
                          <div className="accuracy-bar-track">
                            <div className="accuracy-bar-fill" style={{ width: `${item.accuracy * 100}%` }} />
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', minWidth:44, textAlign:'right' }}>
                            {(item.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Loss Trend */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Loss Trend</span>
                  </div>
                  {(analytics.lossTrend?.length ?? 0) === 0 ? (
                    <div className="empty-state" style={{ padding: '24px 0' }}>
                      <p>No trend data yet</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:250, overflowY:'auto' }}>
                      {analytics.lossTrend.map((item) => (
                        <div key={item.round} style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <span style={{ minWidth:36, fontSize:12, fontWeight:600, color:'var(--text-3)' }}>R{item.round}</span>
                          <div style={{ background:'var(--bg)', borderRadius:6, padding:'4px 10px', flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div className="accuracy-bar-track" style={{ flex:1, marginRight:8 }}>
                                <div className="accuracy-bar-fill" style={{ width: `${Math.min(item.loss * 100, 100)}%`, background:'var(--danger)' }} />
                              </div>
                              <span style={{ fontSize:12.5, fontWeight:700, color:'var(--text-1)', whiteSpace:'nowrap', fontFamily:'var(--mono)' }}>
                                {item.loss.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rounds Table */}
            <div className="card" style={{ padding:0 }}>
              <div className="card-header" style={{ padding:'20px 24px 0' }}>
                <span className="card-title">Recent Training Rounds</span>
              </div>
              {rounds.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🤖</div>
                  <h3>No rounds yet</h3>
                  <p>Start a new training round to begin federated learning</p>
                </div>
              ) : (
                <div className="table-wrap" style={{ marginTop:16 }}>
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Round</th>
                        <th>Status</th>
                        <th>Accuracy</th>
                        <th>Clients</th>
                        <th>Duration</th>
                        <th>Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rounds.map((round) => (
                        <tr key={round._id || round.id}>
                          <td style={{ fontWeight:700, fontFamily:'var(--mono)', color:'var(--text-1)' }}>#{round.roundNumber}</td>
                          <td><StatusBadge status={round.status} /></td>
                          <td style={{ fontWeight:600 }}>
                            {round.globalModel?.accuracy
                              ? (
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div className="accuracy-bar-track" style={{ width:60 }}>
                                    <div className="accuracy-bar-fill" style={{ width:`${round.globalModel.accuracy * 100}%` }} />
                                  </div>
                                  <span>{(round.globalModel.accuracy * 100).toFixed(1)}%</span>
                                </div>
                              ) : '—'}
                          </td>
                          <td>{round.clientCount || '—'}</td>
                          <td>{round.duration ? `${Math.floor(round.duration / 60)}m ${round.duration % 60}s` : '—'}</td>
                          <td style={{ color:'var(--text-3)', fontSize:12.5 }}>
                            {round.createdAt ? new Date(round.createdAt).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Client Selection Modal */}
        {showClientModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowClientModal(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: 24,
                maxWidth: 550,
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>
                  🤖 Round #{getNextRoundNumber()}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                  Select clients to participate in this training round. Leave empty to auto-discover from previous rounds.
                </p>
              </div>

              {getAvailableClients().length > 0 ? (
                <>
                  <div style={{
                    background: '#f9fafb',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    border: '1px solid #e5e7eb',
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#111827',
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedClients.length === getAvailableClients().length && getAvailableClients().length > 0}
                        onChange={handleSelectAllClients}
                        style={{ cursor: 'pointer', width: 18, height: 18 }}
                      />
                      ✓ Select All ({selectedClients.length}/{getAvailableClients().length})
                    </label>
                  </div>

                  <div style={{
                    background: '#f9fafb',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    padding: 12,
                    maxHeight: 300,
                    overflowY: 'auto',
                    marginBottom: 16,
                  }}>
                    {getAvailableClients().map((client) => (
                      <label key={client} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 8px',
                        cursor: 'pointer',
                        borderRadius: 6,
                        transition: 'background 0.2s',
                        background: selectedClients.includes(client) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        color: '#111827',
                        fontSize: 13,
                        fontFamily: 'var(--mono)',
                      }}
                      onMouseEnter={(e) => !selectedClients.includes(client) && (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)')}
                      onMouseLeave={(e) => !selectedClients.includes(client) && (e.currentTarget.style.background = 'transparent')}
                      >
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client)}
                          onChange={() => toggleClientSelection(client)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                        {client}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{
                  background: '#f9fafb',
                  borderRadius: 8,
                  padding: 24,
                  textAlign: 'center',
                  marginBottom: 16,
                  color: '#6b7280',
                  fontSize: 13,
                  border: '1px solid #e5e7eb',
                }}>
                  No clients available yet. Round will auto-discover from previous data.
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => {
                    setShowClientModal(false);
                    setSelectedClients([]);
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#374151',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiateRound}
                  disabled={initiatingRound}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#3b82f6',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: initiatingRound ? 'not-allowed' : 'pointer',
                    opacity: initiatingRound ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => !initiatingRound && (e.currentTarget.style.background = '#2563eb')}
                  onMouseLeave={(e) => !initiatingRound && (e.currentTarget.style.background = '#3b82f6')}
                >
                  {initiatingRound ? '⏳ Initiating…' : `▶ Start Round #${getNextRoundNumber()}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
