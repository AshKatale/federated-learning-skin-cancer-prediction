import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ImageUploader from '../components/ImageUploader';
import PredictionResults from '../components/PredictionResults';
import { predictionService } from '../services/api';

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const TrendUpIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);

function StatCard({ label, value, meta, trend, valueClass, action, to }) {
  return (
    <div className="stat-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 4 }}>
        <span className="stat-label">{label}</span>
        {action && <span style={{fontSize:11, color:'var(--text-3)'}}>···</span>}
      </div>
      <div className={`stat-value ${valueClass || ''}`}>{value}</div>
      {meta && (
        <div className="stat-meta" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: 10 }}>
          <span>{meta}</span>
          {to && (
            <Link to={to} className="btn-arrow" style={{width:26,height:26}}>
              <ArrowIcon />
            </Link>
          )}
        </div>
      )}
      {trend && (
        <div className="stat-trend" style={{marginTop:6}}>
          <TrendUpIcon /> {trend}
        </div>
      )}
    </div>
  );
}

function RiskBadge({ level }) {
  if (level === 'Low') return <span className="badge badge-green">Low Risk</span>;
  if (level === 'Medium') return <span className="badge badge-yellow">Medium Risk</span>;
  return <span className="badge badge-red">High Risk</span>;
}

export default function Dashboard() {
  const [recentPredictions, setRecentPredictions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPrediction, setCurrentPrediction] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([
        predictionService.getPredictionHistory(1, 5),
        predictionService.getStatistics(),
      ]);
      setRecentPredictions(historyRes.data.data?.predictions || historyRes.data.predictions || []);
      setStats(statsRes.data.stats || statsRes.data);
      console.log('Data loaded successfully');
    } catch (err) {
      console.error('Failed to load data:', err);
      setRecentPredictions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePredictionSuccess = (prediction) => {
    setCurrentPrediction(prediction);
    fetchData();
  };

  return (
    <AppShell>
      <div className="page">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-subtitle">AI-powered Skin Cancer Detection &amp; Risk Assessment</div>
          </div>
          <Link to="/predictions" className="btn btn-secondary btn-sm">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 100 2"/>
            </svg>
            View History
          </Link>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="stats-grid">
            <StatCard
              label="Total Analyses"
              value={stats.totalPredictions}
              meta="Data per session"
              to="/predictions"
            />
            <StatCard
              label="Avg Confidence"
              value={`${(stats.averageConfidence * 100).toFixed(1)}%`}
              meta="Model accuracy indicator"
              valueClass="primary"
            />
            <StatCard
              label="High Risk Detected"
              value={stats.byRiskLevel?.High?.count || 0}
              meta="Require attention"
              valueClass="danger"
              to="/predictions"
            />
            <StatCard
              label="Low Risk Cases"
              value={stats.byRiskLevel?.Low?.count || 0}
              meta="Benign findings"
              valueClass="accent"
            />
          </div>
        )}

        {/* Analysis Result (if fresh prediction) */}
        {currentPrediction && (
          <div>
            <PredictionResults prediction={currentPrediction} />
          </div>
        )}

        {/* Upload + Recent History */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:20, alignItems:'start' }}>
          {/* Upload Panel */}
          <ImageUploader onSuccess={handlePredictionSuccess} />

          {/* Recent Predictions */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: '20px 24px 0' }}>
              <span className="card-title">Recent Analyses</span>
              <Link to="/predictions" style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration:'none' }}>
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <span>Loading…</span>
              </div>
            ) : recentPredictions.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 24px' }}>
                <div className="empty-icon">🔬</div>
                <h3>No analyses yet</h3>
                <p>Upload a dermatoscopic image to run your first AI analysis</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Classification</th>
                      <th>Date</th>
                      <th>Confidence</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPredictions.map((pred) => (
                      <tr key={pred._id || pred.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-1)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {pred.className}
                        </td>
                        <td style={{ color: 'var(--text-3)', whiteSpace:'nowrap' }}>
                          {new Date(pred.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {(pred.confidence * 100).toFixed(1)}%
                        </td>
                        <td><RiskBadge level={pred.riskLevel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
