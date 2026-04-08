import React, { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';
import { predictionService } from '../services/api';

function RiskBadge({ level }) {
  if (level === 'Low') return <span className="badge badge-green">Low</span>;
  if (level === 'Medium') return <span className="badge badge-yellow">Medium</span>;
  return <span className="badge badge-red">High</span>;
}

function DetailModal({ pred, onClose }) {
  if (!pred) return null;
  const probs = pred.allProbabilities || pred.all_probabilities || {};
  const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a);
  const getColor = (c) => c > 0.8 ? 'var(--accent)' : c > 0.6 ? 'var(--warn)' : 'var(--danger)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Prediction Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>{pred.className}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <RiskBadge level={pred.riskLevel} />
              <span style={{ fontSize: 13, fontWeight: 700, color: getColor(pred.confidence) }}>
                {(pred.confidence * 100).toFixed(1)}% Confidence
              </span>
            </div>
          </div>

          {/* Grad-CAM Visualization */}
          {(pred.gradcamData || pred.gradcamUrl) && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                Model Attention Heatmap
              </div>
              <div style={{ padding: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                <img
                  src={pred.gradcamData || pred.gradcamUrl}
                  alt="Grad-CAM Heatmap"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 6,
                    objectFit: 'contain'
                  }}
                />
              </div>
            </div>
          )}

          {/* Probabilities */}
          {sorted.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                All Probabilities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map(([cls, prob]) => (
                  <div key={cls} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 52px', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{cls}</span>
                    <div className="prob-bar-wrap">
                      <div className="prob-bar-fill" style={{ width: `${(prob * 100).toFixed(1)}%`, background: getColor(prob) }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{(prob * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Date', new Date(pred.createdAt).toLocaleString()],
              ['Risk Level', pred.riskLevel],
              ['Confidence', `${(pred.confidence * 100).toFixed(2)}%`],
              ['Class', pred.className],
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ['', 'Low', 'Medium', 'High'];

export default function PredictionHistory() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [riskFilter, setRiskFilter] = useState('');
  const [selectedPrediction, setSelectedPrediction] = useState(null);

  useEffect(() => { fetchPredictions(); }, [page, riskFilter]);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const filters = riskFilter ? { riskLevel: riskFilter } : {};
      const response = await predictionService.getPredictionHistory(page, 10, filters);
      setPredictions(response.data.data.predictions);
      setTotalPages(response.data.data.pages);
    } catch (err) {
      console.error('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="page">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Prediction History</div>
            <div className="page-subtitle">All your past skin cancer predictions &amp; assessments</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card" style={{ padding: '14px 20px', flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Filter by Risk:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map(f => (
              <button
                key={f || 'all'}
                onClick={() => { setRiskFilter(f); setPage(1); }}
                className={`btn btn-sm ${riskFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minWidth: 52 }}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Table / States */}
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>Loading predictions…</span>
            </div>
          ) : predictions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔬</div>
              <h3>No predictions found</h3>
              <p>{riskFilter ? `No ${riskFilter.toLowerCase()} risk analyses yet` : 'Run your first analysis from the Dashboard'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Classification</th>
                    <th>Date</th>
                    <th>Confidence</th>
                    <th>Risk</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((pred, i) => (
                    <tr key={pred.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPrediction(pred)}>
                      <td style={{ color: 'var(--text-4)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                        {(page - 1) * 10 + i + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{pred.className}</td>
                      <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                        {new Date(pred.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="prob-bar-wrap" style={{ width: 60 }}>
                            <div className="prob-bar-fill" style={{
                              width: `${(pred.confidence * 100).toFixed(0)}%`,
                              background: pred.confidence > 0.8 ? 'var(--accent)' : pred.confidence > 0.6 ? 'var(--warn)' : 'var(--danger)'
                            }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{(pred.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td><RiskBadge level={pred.riskLevel} /></td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={e => { e.stopPropagation(); setSelectedPrediction(pred); }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && predictions.length > 0 && (
          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              ← Previous
            </button>
            <span className="page-info">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary btn-sm"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPrediction && (
        <DetailModal pred={selectedPrediction} onClose={() => setSelectedPrediction(null)} />
      )}
    </AppShell>
  );
}
