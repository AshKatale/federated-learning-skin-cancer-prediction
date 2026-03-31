/**
 * FLControlPanel — Federated Learning control UI
 *
 * Communicates with Electron main process ONLY via window.electronAPI.
 * Never imports Node.js / fs / child_process directly.
 *
 * IPC flow:
 *   [Button click]
 *     → window.electronAPI.trainModel(opts)
 *       → preload.js safeInvoke('train-model')
 *         → ipcMain.handle('train-model')
 *           → spawn(python, fl_client/client.py)
 *             → stdout streamed back via 'training-log' channel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Detect Electron environment ───────────────────────────────────────────────
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const api = isElectron ? window.electronAPI : null;

// ── Small icon primitives ─────────────────────────────────────────────────────
const Ico = ({ d, color = 'currentColor', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const STATUS_COLOR = { running: '#22c55e', offline: '#ef4444', unknown: '#94a3b8' };

// ── Component ─────────────────────────────────────────────────────────────────
export default function FLControlPanel() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [appStatus,     setAppStatus]     = useState(null);
  const [flStatus,      setFlStatus]      = useState(null);
  const [datasetPath,   setDatasetPath]   = useState('');
  const [imagePath,     setImagePath]     = useState('');
  const [prediction,    setPrediction]    = useState(null);
  const [logs,          setLogs]          = useState([]);
  const [training,      setTraining]      = useState(false);
  const [predicting,    setPredicting]    = useState(false);
  const [epochs,        setEpochs]        = useState(1);
  const [clientId,      setClientId]      = useState('1');
  const [panelTab,      setPanelTab]      = useState('train'); // 'train' | 'predict' | 'status'

  const logsEndRef = useRef(null);

  // ── Log helper ─────────────────────────────────────────────────────────────
  const addLog = useCallback((line) => {
    setLogs((prev) => [...prev.slice(-300), line]); // keep last 300 lines
  }, []);

  // ── Scroll logs to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Subscribe to streaming training logs from main process ─────────────────
  useEffect(() => {
    if (!api) return;
    const cleanup = api.onTrainingLog?.((line) => addLog(line));
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [addLog]);

  // ── Subscribe to menu-triggered events ─────────────────────────────────────
  useEffect(() => {
    if (!api) return;
    const c1 = api.onTriggerTrain?.(() => handleTrain());
    const c2 = api.onTriggerSync?.(() => handleSync());
    const c3 = api.onDatasetChanged?.((p) => setDatasetPath(p));
    return () => {
      [c1, c2, c3].forEach((c) => typeof c === 'function' && c());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll app/FL status every 15 s ─────────────────────────────────────────
  useEffect(() => {
    if (!api) return;
    const fetch = async () => {
      const [as, fs] = await Promise.all([
        api.getAppStatus().catch(() => null),
        api.flStatus().catch(() => null),
      ]);
      setAppStatus(as);
      setFlStatus(fs);
    };
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSelectDataset = async () => {
    if (!api) return;
    const res = await api.selectDatasetFolder();
    if (!res.canceled) {
      setDatasetPath(res.path);
      addLog(`[Dataset] Selected: ${res.path}`);
    }
  };

  const handleSelectImage = async () => {
    if (!api) return;
    const res = await api.selectFile();
    if (!res.canceled) {
      setImagePath(res.filePath);
      setPrediction(null);
      addLog(`[Image] Selected: ${res.filePath}`);
    }
  };

  const handleTrain = async () => {
    if (!api || training) return;
    setTraining(true);
    setPanelTab('train');
    setLogs([]);
    addLog(`[Train] Starting local training  epochs=${epochs}  client=${clientId}`);
    addLog(`[Train] Dataset: ${datasetPath || '(default)'}`);

    try {
      const result = await api.trainModel({
        dataDir:  datasetPath || undefined,
        clientId,
        epochs:   Number(epochs),
      });
      addLog(result.success
        ? `[Train] ✅ Completed (exit ${result.exitCode})`
        : `[Train] ❌ Failed — ${result.error || `exit ${result.exitCode}`}`);
    } catch (e) {
      addLog(`[Train] ❌ Error: ${e.message}`);
    } finally {
      setTraining(false);
    }
  };

  const handlePredict = async () => {
    if (!api || predicting || !imagePath) return;
    setPredicting(true);
    setPrediction(null);
    addLog(`[Predict] Running inference on: ${imagePath}`);

    try {
      const res = await api.runPrediction(imagePath);
      if (res.success) {
        setPrediction(res.prediction);
        addLog(`[Predict] ✅ ${JSON.stringify(res.prediction)}`);
      } else {
        addLog(`[Predict] ❌ ${res.error || res.stderr || 'Unknown error'}`);
      }
    } catch (e) {
      addLog(`[Predict] ❌ ${e.message}`);
    } finally {
      setPredicting(false);
    }
  };

  const handleSync = async () => {
    if (!api) return;
    addLog('[Sync] Syncing global model from FL server…');
    try {
      const res = await api.flSync();
      addLog(res.error
        ? `[Sync] ❌ ${res.error}`
        : `[Sync] ✅ Round ${res.synced_round} (updated=${res.updated})`);
    } catch (e) {
      addLog(`[Sync] ❌ ${e.message}`);
    }
  };

  // ── Non-Electron fallback ──────────────────────────────────────────────────
  if (!isElectron) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🖥️</div>
        <p style={{ margin: 0, fontWeight: 600 }}>Desktop Features Unavailable</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Local training and inference require the Electron desktop app.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Status bar ── */}
      <div className="card" style={{ padding: '12px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>Services</span>
        {[
          ['API Server',  appStatus?.server],
          ['FL Client',   appStatus?.fl_client],
        ].map(([label, state]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: STATUS_COLOR[state] || STATUS_COLOR.unknown,
              display: 'inline-block',
            }} />
            <span style={{ color: 'var(--text-2)' }}>{label}</span>
            <span style={{ color: STATUS_COLOR[state] || STATUS_COLOR.unknown, fontWeight: 600 }}>
              {state || 'checking…'}
            </span>
          </span>
        ))}
        {flStatus && !flStatus.error && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
            FL round: <strong>{flStatus.synced_round}</strong>
          </span>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[['train', 'Train Model'], ['predict', 'Run Prediction'], ['status', 'Logs']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setPanelTab(tab)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: panelTab === tab ? 'var(--primary)' : 'var(--surface-2)',
              color: panelTab === tab ? '#fff' : 'var(--text-2)',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Train tab ── */}
      {panelTab === 'train' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
            🧠 Local Federated Training
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Trains the EfficientNet model on your local dataset. Raw images never leave your device —
            only gradient updates are shared with the FL server.
          </p>

          {/* Dataset picker */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly
              value={datasetPath}
              placeholder="Dataset folder (optional — uses default if blank)"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13,
              }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleSelectDataset}>
              Browse…
            </button>
          </div>

          {/* Config row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
              Client ID
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{
                  width: 80, padding: '7px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text-1)', fontSize: 13,
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
              Epochs
              <input
                type="number"
                min={1} max={50}
                value={epochs}
                onChange={(e) => setEpochs(e.target.value)}
                style={{
                  width: 80, padding: '7px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text-1)', fontSize: 13,
                }}
              />
            </label>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleTrain}
              disabled={training}
              style={{ minWidth: 150 }}
            >
              {training ? (
                <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Training…</>
              ) : '▶ Start Training'}
            </button>
            <button className="btn btn-secondary" onClick={handleSync} disabled={training}>
              ↻ Sync Global Model
            </button>
          </div>

          {/* Inline log preview */}
          {logs.length > 0 && (
            <LogBox logs={logs} logsEndRef={logsEndRef} />
          )}
        </div>
      )}

      {/* ── Predict tab ── */}
      {panelTab === 'predict' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
            🔬 Local Inference
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Runs the skin cancer classifier entirely on your device — no cloud calls.
          </p>

          {/* Image picker */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly
              value={imagePath}
              placeholder="Select a skin lesion image…"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13,
              }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleSelectImage}>
              Browse…
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handlePredict}
            disabled={predicting || !imagePath}
            style={{ alignSelf: 'flex-start', minWidth: 160 }}
          >
            {predicting ? (
              <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Analyzing…</>
            ) : '🔍 Run Prediction'}
          </button>

          {/* Prediction result */}
          {prediction && <PredictionCard pred={prediction} />}
        </div>
      )}

      {/* ── Logs tab ── */}
      {panelTab === 'status' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>📋 Process Logs</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setLogs([])}>Clear</button>
          </div>
          <LogBox logs={logs.length ? logs : ['No logs yet.']} logsEndRef={logsEndRef} />

          {/* FL status detail */}
          {flStatus && !flStatus.error && (
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
              <div><strong>Client ID:</strong> {flStatus.client_id}</div>
              <div><strong>Synced round:</strong> {flStatus.synced_round}</div>
              <div><strong>FL server:</strong> {flStatus.fl_server}</div>
              <div><strong>Data dir:</strong> {flStatus.data_dir}</div>
              <div><strong>Training allowed:</strong> {String(flStatus.training_allowed)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LogBox({ logs, logsEndRef }) {
  return (
    <pre style={{
      background: '#0d1117', color: '#c9d1d9', borderRadius: 10,
      padding: '14px 16px', fontSize: 11.5, lineHeight: 1.7,
      maxHeight: 280, overflowY: 'auto', margin: 0,
      fontFamily: '"Fira Code", "Cascadia Code", monospace',
      border: '1px solid #21262d',
    }}>
      {logs.map((line, i) => (
        <div key={i} style={{
          color: line.includes('❌') || line.includes('[stderr]') ? '#f85149'
               : line.includes('✅') ? '#3fb950'
               : line.includes('[Train]') ? '#79c0ff'
               : line.includes('[Predict]') ? '#d2a8ff'
               : '#c9d1d9',
        }}>{line}</div>
      ))}
      <div ref={logsEndRef} />
    </pre>
  );
}

function PredictionCard({ pred }) {
  const cls  = pred.class_name || pred.className || pred.predicted_class || 'Unknown';
  const conf = pred.confidence != null ? (pred.confidence * 100).toFixed(1) : null;
  const risk = pred.risk_level || pred.riskLevel || 'N/A';

  const riskColor = risk === 'High' ? '#ef4444' : risk === 'Medium' ? '#f59e0b' : '#22c55e';

  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: 12, padding: '16px 20px',
      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{cls}</div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
        {conf && (
          <span style={{ color: 'var(--text-2)' }}>
            Confidence: <strong style={{ color: 'var(--primary)' }}>{conf}%</strong>
          </span>
        )}
        <span style={{ color: 'var(--text-2)' }}>
          Risk: <strong style={{ color: riskColor }}>{risk}</strong>
        </span>
      </div>
      {pred.top_predictions && (
        <div style={{ marginTop: 4 }}>
          {pred.top_predictions.slice(0, 5).map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 3 }}>
              <span style={{ minWidth: 180, display: 'inline-block' }}>{p.class}</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {(p.confidence * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
