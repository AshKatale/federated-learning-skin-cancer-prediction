import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { flService } from '../services/api';

const StatusBadge = ({ status }) => {
  if (status === 'completed') return <span className="badge badge-green">Completed</span>;
  if (status === 'active') return <span className="badge badge-blue">Active</span>;
  return <span className="badge badge-yellow">{status}</span>;
};

export default function AdminDashboard() {
  const [rounds, setRounds] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initiatingRound, setInitiatingRound] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin' && user.role !== 'doctor') navigate('/dashboard');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [roundsRes, analyticsRes] = await Promise.all([
        flService.getAllRounds(1, 10),
        flService.getAnalytics(),
      ]);
      setRounds(roundsRes.data.data.rounds);
      setAnalytics(analyticsRes.data.analytics);
    } catch (err) {
      setError('Failed to load federated learning data');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateRound = async () => {
    setInitiatingRound(true);
    try {
      await flService.initiateRound({ clientList: ['client-1', 'client-2', 'client-3'] });
      setError('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate round');
    } finally {
      setInitiatingRound(false);
    }
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

            {/* Trend Charts */}
            {analytics && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                {/* Accuracy Trend */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Accuracy Trend</span>
                  </div>
                  {analytics.accuracyTrend.length === 0 ? (
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
                  {analytics.lossTrend.length === 0 ? (
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
                        <tr key={round.id}>
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
