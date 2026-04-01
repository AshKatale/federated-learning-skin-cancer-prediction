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
  const [panelTab,      setPanelTab]      = useState('train'); // 'train' | 'predict' | 'status' | 'evaluate'
  const [device,        setDevice]        = useState('cpu');   // NEW: 'cpu' or 'cuda'
  const [cudaStatus,    setCudaStatus]    = useState(null);    // NEW: CUDA availability info
  const [showCudaModal, setShowCudaModal] = useState(false);   // NEW: CUDA install prompt
  const [installingCuda, setInstallingCuda] = useState(false); // NEW: CUDA installation in progress
  const [cudaLogs,      setCudaLogs]      = useState([]);      // NEW: CUDA install logs
  const [testDir,       setTestDir]        = useState('');     // NEW: Test dataset path
  const [evaluating,    setEvaluating]    = useState(false);   // NEW: Evaluation in progress
  const [evalResults,   setEvalResults]   = useState(null);    // NEW: Evaluation results
  const [cudaProgress,  setCudaProgress]  = useState(null);    // NEW: CUDA download progress { downloaded, total, percentage }

  const logsEndRef = useRef(null);

  // ── Generate unique client ID on mount ─────────────────────────────────────
  useEffect(() => {
    // Generate unique ID from machine hostname + random ID
    // This ensures each desktop app instance gets a unique client ID
    const storedClientId = localStorage.getItem('fl_client_id');
    
    if (!storedClientId) {
      // Generate new unique ID: hostname + random suffix
      const hostname = window.electronAPI?.platform || 'client';
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newClientId = `${hostname}_${randomSuffix}`;
      
      localStorage.setItem('fl_client_id', newClientId);
      setClientId(newClientId);
      console.log(`[FL] Generated new client ID: ${newClientId}`);
    } else {
      setClientId(storedClientId);
      console.log(`[FL] Loaded client ID from storage: ${storedClientId}`);
    }
  }, []);

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

  // ── Subscribe to CUDA progress updates (includes logs) ────────────────────
  useEffect(() => {
    if (!api) return;
    const cleanup = api.onCudaProgress?.((progress) => {
      setCudaProgress(progress);
      
      // Extract message and add to logs (shows raw terminal output)
      if (progress?.message) {
        setCudaLogs((prev) => {
          // Avoid duplicate lines from rapid updates
          const lastLine = prev[prev.length - 1];
          if (lastLine === progress.message) {
            return prev; // Skip if same as last
          }
          return [...prev.slice(-150), progress.message];
        });
      }
    });
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  // ── Subscribe to streaming evaluation logs from main process ────────────────
  useEffect(() => {
    if (!api) return;
    const cleanup = api.onEvaluationLog?.((line) => addLog(line));
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [addLog]);

  // ── Check CUDA availability on mount ──────────────────────────────────────
  useEffect(() => {
    if (!api) return;
    const checkCuda = async () => {
      const status = await api.checkCudaStatus?.();
      if (status) {
        setCudaStatus(status);
        if (!status.cuda_available) {
          setDevice('cpu'); // Force CPU if CUDA is not available
        }
      }
    };
    checkCuda();
  }, []);

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

    // Check if user selected GPU but it's not available
    if (device === 'cuda' && !cudaStatus?.cuda_available) {
      setShowCudaModal(true);
      return;
    }

    setTraining(true);
    setPanelTab('train');
    setLogs([]);
    addLog(`[Train] Starting local training  epochs=${epochs}  client=${clientId}  device=${device}`);
    addLog(`[Train] Dataset: ${datasetPath || '(default)'}`);

    try {
      const result = await api.trainModel({
        dataDir:  datasetPath || undefined,
        clientId,
        epochs:   Number(epochs),
        device,   // NEW: Pass device selection
      });
      if (result?.killed) {
        addLog('[Train] 🛑 Training stopped by user.');
      } else {
        addLog(result.success
          ? `[Train] ✅ Completed (exit ${result.exitCode})`
          : `[Train] ❌ Failed — ${result.error || `exit ${result.exitCode}`}`);
      }
    } catch (e) {
      addLog(`[Train] ❌ Error: ${e.message}`);
    } finally {
      setTraining(false);
    }
  };

  // ── Install CUDA PyTorch ───────────────────────────────────────────────────
  const handleInstallCuda = async () => {
    if (!api || installingCuda) return;
    
    setInstallingCuda(true);
    setCudaLogs(['[Install] Starting PyTorch CUDA 12.1 installation...']);
    setCudaProgress({ status: 'started', downloaded: 0, total: 0, percentage: 0, message: '' });
    
    try {
      const result = await api.installCudaPyTorch?.();
      if (result?.success) {
        setCudaLogs((prev) => [...prev, '[Install] ✅ Installation successful!']);
        setCudaLogs((prev) => [...prev, '[Install] Checking CUDA status...']);
        
        // Re-check CUDA status
        const status = await api.checkCudaStatus?.();
        if (status) {
          setCudaStatus(status);
          setCudaLogs((prev) => [...prev, `[Install] ✅ CUDA is now available: ${status.version}`]);
        }
      } else {
        setCudaLogs((prev) => [...prev, `[Install] ❌ Installation failed: ${result?.error}`]);
      }
    } catch (e) {
      setCudaLogs((prev) => [...prev, `[Install] ❌ Error: ${e.message}`]);
    } finally {
      setInstallingCuda(false);
    }
  };

  const handleCancelCudaInstall = async () => {
    if (!api) return;
    
    try {
      const result = await api.cancelCudaInstall?.();
      if (result?.cancelled) {
        setCudaLogs((prev) => [...prev, '[Install] ❌ Installation cancelled by user']);
      }
    } catch (e) {
      setCudaLogs((prev) => [...prev, `[Install] Error cancelling: ${e.message}`]);
    } finally {
      setInstallingCuda(false);
    }
  };

  const handleStopTraining = async () => {
    if (!api) return;
    addLog('[Train] 🛑 Stopping training…');
    try {
      const res = await api.killTraining();
      addLog(res?.killed ? '[Train] 🛑 Training process terminated.' : '[Train] No active training process found.');
    } catch (e) {
      addLog(`[Train] ❌ Stop failed: ${e.message}`);
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

  const handleEvaluate = async () => {
    if (!api || evaluating || !testDir) return;
    setEvaluating(true);
    setEvalResults(null);
    addLog(`[Evaluate] Starting model evaluation…`);
    addLog(`[Evaluate] Test folder: ${testDir}`);

    try {
      const res = await api.evaluateModel({
        testDir,
        modelPath: undefined, // Use default global model
      });
      if (res.success) {
        setEvalResults(res);
        addLog(`[Evaluate] ✅ Overall accuracy: ${(res.overall_accuracy * 100).toFixed(2)}%`);
      } else {
        setEvalResults(res);
        addLog(`[Evaluate] ❌ ${res.error}`);
      }
    } catch (e) {
      setEvalResults({ success: false, error: e.message });
      addLog(`[Evaluate] ❌ ${e.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  // ── Helper: Format bytes to human-readable size ───────────────────────────
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
        {[['train', 'Train Model'], ['predict', 'Run Prediction'], ['evaluate', 'Evaluate Model'], ['status', 'Logs']].map(([tab, label]) => (
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
              Client ID <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>(Auto-generated, unique per device)</span>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="auto-generated"
                style={{
                  width: 200, padding: '7px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text-1)', fontSize: 13, fontFamily: 'monospace',
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

          {/* Device selection (NEW) */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
              ⚙️ Compute Device
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {/* CPU Option */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="device"
                  value="cpu"
                  checked={device === 'cpu'}
                  onChange={(e) => setDevice(e.target.value)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-1)' }}>CPU (slower but always works)</span>
              </label>

              {/* GPU Option */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: cudaStatus?.cuda_available ? 'pointer' : 'not-allowed',
                opacity: cudaStatus?.cuda_available ? 1 : 0.5,
              }}>
                <input
                  type="radio"
                  name="device"
                  value="cuda"
                  checked={device === 'cuda'}
                  onChange={(e) => setDevice(e.target.value)}
                  disabled={!cudaStatus?.cuda_available}
                  style={{ cursor: cudaStatus?.cuda_available ? 'pointer' : 'not-allowed' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-1)' }}>GPU (10-50x faster)</span>
              </label>
            </div>

            {/* CUDA Status message */}
            {cudaStatus && (
              <div style={{ fontSize: 12, color: cudaStatus.cuda_available ? '#22c55e' : '#ef4444', marginTop: 4 }}>
                {cudaStatus.cuda_available ? (
                  <>✅ {cudaStatus.device} — Ready for fast training</>
                ) : (
                  <>❌ GPU PyTorch not installed — <button
                    onClick={() => setShowCudaModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Install CUDA
                  </button></>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
            {training && (
              <button
                onClick={handleStopTraining}
                style={{
                  minWidth: 130, padding: '8px 18px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: '#ef4444', color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.target.style.background = '#dc2626'}
                onMouseLeave={e => e.target.style.background = '#ef4444'}
              >
                ■ Stop Training
              </button>
            )}
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

      {/* ── Evaluation tab ── */}
      {panelTab === 'evaluate' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
            📊 Evaluate Global Model
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Test the global federated learning model on a test dataset. Computes overall accuracy
            and per-class metrics.
          </p>

          {/* Test folder picker */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly
              value={testDir}
              placeholder="Test dataset folder"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13,
              }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const res = await api.selectDatasetFolder();
                if (!res.canceled) setTestDir(res.path);
              }}
            >
              Browse…
            </button>
          </div>

          {/* Evaluate button */}
          <button
            className="btn btn-primary"
            disabled={evaluating || !testDir}
            onClick={handleEvaluate}
            style={{
              opacity: evaluating || !testDir ? 0.6 : 1,
              cursor: evaluating || !testDir ? 'not-allowed' : 'pointer',
            }}
          >
            {evaluating ? '⏳ Evaluating...' : '▶ Start Evaluation'}
          </button>

          {/* Evaluation Results */}
          {evalResults && evalResults.success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Overall Accuracy */}
              <div style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderLeft: '4px solid #22c55e',
                borderRadius: 8,
                padding: '16px',
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
                  Overall Accuracy
                </div>
                <div style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#22c55e',
                }}>
                  {(evalResults.overall_accuracy * 100).toFixed(2)}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {evalResults.total_samples} test samples
                </div>
              </div>

              {/* Per-Class Metrics */}
              {evalResults.per_class_metrics && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                    Per-Class Metrics
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    {Object.entries(evalResults.per_class_metrics).map(([label, metrics]) => (
                      <div key={label} style={{
                        backgroundColor: 'var(--surface-2)',
                        borderRadius: 8,
                        padding: '12px',
                        fontSize: 12,
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                          {metrics.class_name} ({label})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, color: 'var(--text-2)' }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Accuracy</div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                              {(metrics.accuracy * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Precision</div>
                            <div style={{ fontWeight: 700 }}>{(metrics.precision * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Recall</div>
                            <div style={{ fontWeight: 700 }}>{(metrics.recall * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>F1 Score</div>
                            <div style={{ fontWeight: 700 }}>{(metrics.f1_score * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          Support: {metrics.support} samples
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {evalResults && !evalResults.success && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '4px solid #ef4444',
              borderRadius: 8,
              padding: '12px 16px',
              color: '#ef4444',
              fontSize: 13,
            }}>
              ❌ {evalResults.error || 'Evaluation failed'}
            </div>
          )}

          {/* Progress logs */}
          {(evaluating || evalResults) && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginTop: 8 }}>
                Evaluation Logs
              </div>
              <div style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: 8,
                padding: '12px',
                height: 200,
                overflowY: 'auto',
                fontSize: 11.5,
                fontFamily: 'monospace',
                color: 'var(--text-2)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {logs.filter(log => log.includes('[Eval')).join('\n') || 'No logs...'}
              </div>
            </>
          )}
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

      {/* ── CUDA Install Modal ── */}
      {showCudaModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            padding: '28px',
            maxWidth: 500,
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.15)',
          }}>
            {/* ── Header ── */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 12,
              borderBottom: '1px solid #f0f0f0',
            }}>
              <div style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                ⚙️ GPU Training Setup
              </div>
              <button
                onClick={() => {
                  if (!installingCuda) setShowCudaModal(false);
                }}
                disabled={installingCuda}
                style={{
                  background: '#f0f0f0',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 20,
                  cursor: installingCuda ? 'not-allowed' : 'pointer',
                  color: '#666',
                  opacity: installingCuda ? 0.5 : 1,
                  padding: '4px 8px',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!installingCuda) {
                    e.target.style.background = '#e5e7eb';
                    e.target.style.color = '#000';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f0f0f0';
                  e.target.style.color = '#666';
                }}
              >
                ✕
              </button>
            </div>

            {/* ── Message ── */}
            <div style={{
              fontSize: 14,
              color: '#4b5563',
              lineHeight: 1.7,
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}>
              GPU training requires PyTorch with CUDA 12.1 support. This is a one-time download
              of approximately <strong style={{ color: '#0f172a' }}>2.4 GB</strong>. Your data never leaves your device.
            </div>

            {/* ── Progress bar (during installation) ── */}
            {installingCuda && cudaProgress && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: 28,
                  background: '#f3f4f6',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${cudaProgress.percentage || 0}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
                  }}>
                    {cudaProgress.percentage > 10 && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {Math.round(cudaProgress.percentage)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Size info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#6b7280',
                  paddingX: 4,
                }}>
                  <span>
                    <strong style={{ color: '#1f2937' }}>
                      {cudaProgress.downloaded ? formatBytes(cudaProgress.downloaded) : '0 B'}
                    </strong>
                    {' / '}
                    {cudaProgress.total ? formatBytes(cudaProgress.total) : '~2.4 GB'}
                  </span>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                    {Math.round(cudaProgress.percentage || 0)}%
                  </span>
                </div>

                {/* Status message */}
                {cudaProgress.message && (
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    fontStyle: 'italic',
                    maxHeight: 40,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {cudaProgress.message}
                  </div>
                )}
              </div>
            )}

            {/* ── Log display ── */}
            {cudaLogs.length > 0 && (
              <div style={{
                background: '#f9fafb',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                padding: '14px 16px',
                maxHeight: 220,
                overflowY: 'auto',
                fontFamily: '"Fira Code", "Cascadia Code", monospace',
              }}>
                {cudaLogs.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11.5,
                      color: line.includes('✅') ? '#059669'
                           : line.includes('❌') ? '#dc2626'
                           : line.includes('[Install]') ? '#2563eb'
                           : '#4b5563',
                      lineHeight: 1.7,
                      marginBottom: i === cudaLogs.length - 1 ? 0 : 3,
                      fontWeight: line.includes('✅') || line.includes('❌') ? 600 : 400,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* ── Buttons ── */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              paddingTop: 12,
              borderTop: '1px solid #f0f0f0',
            }}>
              {installingCuda ? (
                <>
                  <button
                    onClick={handleCancelCudaInstall}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid #fecaca',
                      background: '#fee2e2',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#fca5a5';
                      e.target.style.color = '#fff';
                      e.target.style.boxShadow = '0 0 15px rgba(220, 38, 38, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#fee2e2';
                      e.target.style.color = '#dc2626';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    ✕ Cancel Download
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowCudaModal(false);
                      setDevice('cpu');
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: '#f9fafb',
                      color: '#374151',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f3f4f6';
                      e.target.style.borderColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f9fafb';
                      e.target.style.borderColor = '#e5e7eb';
                    }}
                  >
                    Use CPU Instead
                  </button>
                  <button
                    onClick={handleInstallCuda}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <>⬇️ Install CUDA (2.4 GB)</>
                  </button>
                </>
              )}
            </div>
          </div>
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
