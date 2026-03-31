import React from 'react';

const getConfidenceColor = (c) => {
  if (c > 0.8) return 'var(--accent)';
  if (c > 0.6) return 'var(--warn)';
  return 'var(--danger)';
};

const getRiskLevel = (c) => {
  if (c > 0.8) return { label: '✓ Low Risk', cls: 'low' };
  if (c > 0.6) return { label: '⚠ Moderate Risk', cls: 'medium' };
  return { label: '✕ High Risk', cls: 'high' };
};

export default function PredictionResults({ prediction }) {
  if (!prediction) return null;

  const confidence = prediction.confidence;
  const confidencePct = (confidence * 100).toFixed(1);
  const risk = getRiskLevel(confidence);
  const sortedProbs = Object.entries(prediction.all_probabilities || {})
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Analysis Complete
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            {prediction.class_name || prediction.className}
          </div>
        </div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>

      {/* Risk Banner */}
      <div className={`risk-banner ${risk.cls}`}>
        {risk.label}
      </div>

      {/* Confidence */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Confidence Score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: getConfidenceColor(confidence) }}>{confidencePct}%</span>
        </div>
        <div className="prob-bar-wrap" style={{ height: 10 }}>
          <div
            className="prob-bar-fill"
            style={{ width: `${confidencePct}%`, background: getConfidenceColor(confidence) }}
          />
        </div>
      </div>

      {/* Grad-CAM Visualization */}
      {(prediction.gradcamData || prediction.gradcamUrl) && (
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            Model Attention Heatmap
          </div>
          <div style={{ padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240, backgroundColor: 'var(--bg)' }}>
            <img
              src={prediction.gradcamData || prediction.gradcamUrl}
              alt="Grad-CAM Heatmap"
              style={{
                maxWidth: '100%',
                maxHeight: 240,
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                objectFit: 'contain'
              }}
            />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '0 16px 12px', fontStyle: 'italic' }}>
            Shows the regions of the image that influenced the prediction
          </div>
        </div>
      )}

      {/* All Probabilities */}
      {sortedProbs.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
            Classification Probabilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedProbs.map(([cls, prob]) => (
              <div key={cls} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 52px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls}</span>
                <div className="prob-bar-wrap">
                  <div className="prob-bar-fill" style={{ width: `${(prob * 100).toFixed(1)}%`, background: getConfidenceColor(prob) }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', textAlign: 'right' }}>{(prob * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div style={{ backgroundColor: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Prediction Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 12px', fontSize: 13 }}>
          <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Classification</span>
          <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{prediction.class_name || prediction.className}</span>
          <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Class ID</span>
          <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>{prediction.class_id}</span>
          <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Confidence</span>
          <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{confidencePct}%</span>
          <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Score</span>
          <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>{confidence.toFixed(4)}</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer-box">
        <strong>⚠ Important Notice:</strong> This AI analysis is for informational purposes only
        and is not a medical diagnosis. Always consult a qualified dermatologist for professional
        evaluation, diagnosis, and treatment recommendations.
      </div>
    </div>
  );
}
