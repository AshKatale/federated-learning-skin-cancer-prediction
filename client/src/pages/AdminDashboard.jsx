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

  const handleInitiateRound = async () => {
    setInitiatingRound(true);
    try {
      await flService.initiateRound({ clientList: ['desktop_client_1'] });
      setError('');
      // Refresh data immediately
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate round');
    } finally {
      setInitiatingRound(false);
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
            onClick={handleInitiateRound}
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
              <div className="stats-grid">
                {[
                  { label: 'Total Rounds', value: analytics.totalRounds },
                  { label: 'Best Accuracy', value: `${(analytics.bestAccuracy * 100).toFixed(1)}%`, valueClass: 'accent' },
                  { label: 'Avg Accuracy', value: `${(analytics.averageAccuracy * 100).toFixed(1)}%`, valueClass: 'primary' },
                  { label: 'Participants', value: analytics.totalClientsParticipated },
                ].map(({ label, value, valueClass }) => (
                  <div key={label} className="stat-card">
                    <div className="stat-label">{label}</div>
                    <div className={`stat-value ${valueClass || ''}`}>{value}</div>
                  </div>
                ))}
              </div>
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
      </div>
    </AppShell>
  );
}
