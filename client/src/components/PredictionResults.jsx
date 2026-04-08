import React, { useState, useEffect } from 'react';

// Numeric ID to class abbreviation mapping (HAM10000 dataset)
const NUMERIC_CLASS_MAP = {
  '0': 'nv',
  '1': 'mel',
  '2': 'bkl',
  '3': 'bcc',
  '4': 'akiec',
  '5': 'vasc',
  '6': 'df'
};

const CLASS_NAMES_MAP = {
  'akiec': 'Actinic Keratosis',
  'bcc': 'Basal Cell Carcinoma',
  'bkl': 'Benign Keratosis',
  'df': 'Dermatofibroma',
  'mel': 'Melanoma',
  'nv': 'Nevus (Mole)',
  'vasc': 'Vascular Lesion'
};

// Convert numeric ID to abbreviation, then to full name
const normalizeClassId = (classId) => {
  const id = String(classId);
  const abbrev = NUMERIC_CLASS_MAP[id] || id;
  return abbrev;
};

const getFullClassName = (classId) => {
  const normalized = normalizeClassId(classId);
  return CLASS_NAMES_MAP[normalized] || normalized;
};

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

const CONDITION_DESCRIPTIONS = {
  'akiec': 'Actinic Keratosis (Solar Keratosis) - A precancerous growth caused by sun exposure. Early detection and treatment are important to prevent progression to squamous cell carcinoma.',
  'bcc': 'Basal Cell Carcinoma (BCC) - The most common type of skin cancer. It typically grows slowly and rarely spreads, but requires prompt treatment.',
  'bkl': 'Benign Keratosis - A common, non-cancerous growth on the skin. Usually harmless and requires no treatment unless for cosmetic reasons.',
  'df': 'Dermatofibroma - A benign skin growth, usually small and firm. Common on the lower legs and arms. Non-cancerous and typically does not require treatment.',
  'mel': 'Melanoma - The most serious type of skin cancer. Early detection significantly improves treatment outcomes. Should be evaluated by a dermatologist immediately.',
  'nv': 'Nevus (Mole) - A common, benign skin growth. Most nevi are harmless, but changes in size, shape, or color should be monitored.',
  'vasc': 'Vascular Lesion - A growth of blood vessels on the skin. Benign but may be removed for cosmetic or medical reasons.'
};

const getConditionDescription = (classId) => {
  const normalized = normalizeClassId(classId);
  return CONDITION_DESCRIPTIONS[normalized] || 'Unable to determine condition. Consult a dermatologist for diagnosis.';
};

export default function PredictionResults({ prediction }) {
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [activeTab, setActiveTab] = useState('model'); // 'model' or 'analysis'

  if (!prediction) return null;

  const confidence = prediction.confidence;
  const confidencePct = (confidence * 100).toFixed(1);
  const risk = getRiskLevel(confidence);
  const sortedProbs = Object.entries(prediction.all_probabilities || {})
    .sort(([, a], [, b]) => b - a);

  // Fetch Gemini analysis
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        if (!window.electronAPI || !window.electronAPI.analyzePrediction) {
          setLoadingAnalysis(false);
          return;
        }

        const result = await window.electronAPI.analyzePrediction({
          predictedClass: normalizeClassId(prediction.class_id || prediction.classId || 'bkl'),
          confidence: confidence,
          allProbabilities: prediction.all_probabilities || {}
        });

        setAnalysis(result);
      } catch (err) {
        console.error('Error fetching AI analysis:', err);
      } finally {
        setLoadingAnalysis(false);
      }
    };

    fetchAnalysis();
  }, [prediction]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Analysis Complete
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            {getFullClassName(prediction.class_id || prediction.classId)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            Detected: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{normalizeClassId(prediction.class_id || prediction.classId)}</span>
          </div>
        </div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>

      {/* Condition Description */}
      <div style={{ backgroundColor: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px 16px', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>What This Means</div>
        <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: '1.5' }}>
          {getConditionDescription(prediction.class_id || prediction.classId)}
        </div>
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

      {/* Tabs for Model Details vs AI Analysis */}
      {analysis && analysis.success && (
        <div style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 12
        }}>
          <button
            onClick={() => setActiveTab('model')}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              background: activeTab === 'model' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'model' ? 'white' : 'var(--text-2)',
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'all 0.2s'
            }}
          >
            Model Details
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              background: activeTab === 'analysis' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'analysis' ? 'white' : 'var(--text-2)',
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'all 0.2s'
            }}
          >
            AI Analysis
          </button>
        </div>
      )}

      {/* MODEL DETAILS TAB */}
      {activeTab === 'model' && (
        <>
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
                    <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${getFullClassName(cls)} (${cls})`}>
                      {getFullClassName(cls)}
                    </span>
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
              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{getFullClassName(prediction.class_id || prediction.classId)}</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Class ID</span>
              <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>{normalizeClassId(prediction.class_id)} (ID: {prediction.class_id})</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Confidence</span>
              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{confidencePct}%</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Score</span>
              <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>{confidence.toFixed(4)}</span>
            </div>
          </div>
        </>
      )}

      {/* AI ANALYSIS TAB */}
      {activeTab === 'analysis' && (
        <>
          {loadingAnalysis ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              gap: 12
            }}>
              <div style={{
                width: 40,
                height: 40,
                border: '3px solid var(--border)',
                borderTop: '3px solid var(--accent)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Getting AI analysis...</span>
            </div>
          ) : analysis && analysis.success ? (
            <>
              {/* Diagnosis Box */}
              <div style={{
                backgroundColor: 'var(--accent)',
                color: 'white',
                borderRadius: 'var(--radius)',
                padding: '16px',
                marginBottom: 8
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, marginBottom: 4, textTransform: 'uppercase' }}>
                  Diagnosis
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {analysis.diagnosis || 'Skin condition detected'}
                </div>
              </div>

              {/* Explanation */}
              <div style={{ backgroundColor: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                  What is this condition?
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: '1.6' }}>
                  {analysis.explanation || 'See details below'}
                </div>
              </div>

              {/* Characteristics */}
              {analysis.characteristics && analysis.characteristics.length > 0 && (
                <div style={{ backgroundColor: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                    Visible Characteristics
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysis.characteristics.map((char, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, color: 'var(--text-1)', fontSize: 13 }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>•</span>
                        <span>{char}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Level */}
              <div style={{
                backgroundColor: analysis.risk_level === 'High' ? 'rgba(220, 53, 69, 0.1)' :
                                analysis.risk_level === 'Medium' ? 'rgba(255, 193, 7, 0.1)' :
                                'rgba(40, 167, 69, 0.1)',
                borderLeft: `4px solid ${analysis.risk_level === 'High' ? '#dc3545' :
                                          analysis.risk_level === 'Medium' ? '#ffc107' :
                                          '#28a745'}`,
                borderRadius: 'var(--radius)',
                padding: '12px 14px'
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                  Risk Level
                </div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: analysis.risk_level === 'High' ? '#dc3545' :
                         analysis.risk_level === 'Medium' ? '#ffc107' :
                         '#28a745'
                }}>
                  {analysis.risk_level}
                </div>
              </div>

              {/* Recommendations */}
              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div style={{ backgroundColor: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
                    Recommendations
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysis.recommendations.map((rec, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, color: 'var(--text-1)', fontSize: 13 }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {analysis.next_steps && (
                <div style={{
                  backgroundColor: 'var(--warn)',
                  color: 'white',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.95, textTransform: 'uppercase' }}>
                    Next Steps
                  </div>
                  <div style={{ fontSize: 13, lineHeight: '1.6' }}>
                    {analysis.next_steps}
                  </div>
                </div>
              )}

              {/* Confidence Note */}
              {analysis.confidence_note && (
                <div style={{
                  backgroundColor: 'rgba(23, 162, 184, 0.1)',
                  borderLeft: '4px solid #17a2b8',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  fontSize: 12,
                  color: 'var(--text-1)'
                }}>
                  {analysis.confidence_note}
                </div>
              )}

              {/* AI Source */}
              <div style={{
                fontSize: 11,
                color: 'var(--text-3)',
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                Analysis provided by Google Gemini AI
              </div>
            </>
          ) : (
            <div style={{
              backgroundColor: 'var(--bg)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-2)',
              fontSize: 13
            }}>
              <div style={{ marginBottom: 8 }}>⚠ AI analysis not available</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Set GEMINI_API_KEY environment variable to enable detailed analysis
              </div>
            </div>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div className="disclaimer-box">
        <strong>⚠ Important Notice:</strong> This AI analysis is for informational purposes only
        and is not a medical diagnosis. Always consult a qualified dermatologist for professional
        evaluation, diagnosis, and treatment recommendations.
      </div>
    </div>
  );
}
