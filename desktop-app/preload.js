/**
 * Preload Script — Secure IPC Bridge
 *
 * Runs in a privileged context BEFORE the renderer loads.
 * Uses contextBridge to expose a minimal, typed API surface
 * (window.electronAPI) to the React app.
 *
 * Security rules enforced here:
 *   - nodeIntegration: false  (renderer has no direct Node access)
 *   - contextIsolation: true  (renderer JS cannot access this scope)
 *   - Only explicitly whitelisted channels are forwarded
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ── Whitelisted IPC send channels (renderer → main) ──────────────────────────
const VALID_INVOKE = new Set([
  'app-status',
  'train-model',
  'kill-training',
  'run-prediction',
  'select-file',
  'select-dataset-folder',
  'fl-sync',
  'fl-train',
  'fl-status',
  'open-devtools',
  'read-file',
  'list-dataset',
  'check-cuda-status',
  'install-cuda-pytorch',
  'cancel-cuda-install',
  'evaluate-model',
  'analyze-prediction',
  'check-fl-round-status',
  'start-auto-training',
  'stop-auto-training',
]);

// ── Whitelisted listener channels (main → renderer) ──────────────────────────
const VALID_ON = new Set([
  'training-log',
  'prediction-log',
  'evaluation-log',
  'trigger-sync',
  'trigger-train',
  'dataset-changed',
  'cuda-install-log',
  'cuda-progress',
]);

/** Safe invoke — rejects unknown channels immediately. */
function safeInvoke(channel, ...args) {
  if (!VALID_INVOKE.has(channel)) {
    return Promise.reject(new Error(`[preload] Blocked unknown channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

/** Safe listener — ignores unknown channels. */
function safeOn(channel, callback) {
  if (!VALID_ON.has(channel)) return;
  // Wrap to strip the internal 'event' argument before calling user callback
  const handler = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, handler);
  // Return cleanup function so React can unsubscribe in useEffect cleanup
  return () => ipcRenderer.removeListener(channel, handler);
}

// ── Exposed API ───────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {

  // ── App info ──────────────────────────────────────────────────────────────
  platform:       process.platform,
  electronVersion: process.versions.electron,
  getAppStatus:   () => safeInvoke('app-status'),

  // ── Direct Python execution ───────────────────────────────────────────────

  /**
   * Train the local FL model by spawning the Python training script.
   * @param {object} opts - { dataDir, clientId, epochs, server }
   * @returns {Promise<{ success, logs, exitCode }>}
   */
  trainModel: (opts = {}) => safeInvoke('train-model', opts),

  /** Kill the currently running training process. */
  killTraining: () => safeInvoke('kill-training'),

  /**
   * Run local inference on an image file.
   * @param {string} imagePath - Absolute path to image
   * @returns {Promise<{ success, prediction }>}
   */
  runPrediction: (imagePath) => safeInvoke('run-prediction', imagePath),

  // ── File / folder dialogs ─────────────────────────────────────────────────

  /** Open native file picker for an image. Returns { canceled, filePath } */
  selectFile: () => safeInvoke('select-file'),

  /** Open native directory picker for dataset. Returns { canceled, path } */
  selectDatasetFolder: () => safeInvoke('select-dataset-folder'),

  // ── Filesystem helpers ────────────────────────────────────────────────────

  /** Read a file as base64. Returns { success, data, size } */
  readFile: (filePath) => safeInvoke('read-file', filePath),

  /** List image files in a directory. Returns { success, files, count } */
  listDataset: (dir) => safeInvoke('list-dataset', dir),

  // ── FL-client HTTP proxy (Flask :7000) ────────────────────────────────────

  /** Force sync with FL server — downloads latest global model. */
  flSync:   () => safeInvoke('fl-sync'),

  /** Start background local training via Flask FL client. */
  flTrain:  () => safeInvoke('fl-train'),

  /** Get FL client status. */
  flStatus: () => safeInvoke('fl-status'),

  // ── Auto-training monitor ────────────────────────────────────────────────

  /** Start monitoring for new FL rounds and auto-train when detected. */
  startAutoTraining: (opts = {}) => safeInvoke('start-auto-training', opts),

  /** Stop auto-training monitor. */
  stopAutoTraining: () => safeInvoke('stop-auto-training'),

  /** Check FL server for new rounds. Returns { success, hasNewRound, currentRound, ... } */
  checkFlRoundStatus: (opts = {}) => safeInvoke('check-fl-round-status', opts),

  // ── Event listeners (main → renderer) ────────────────────────────────────

  /** Stream training log lines from Python process. Returns cleanup fn. */
  onTrainingLog:   (cb) => safeOn('training-log', cb),

  /** Stream prediction log lines from Python process. Returns cleanup fn. */
  onPredictionLog: (cb) => safeOn('prediction-log', cb),

  /** Menu: "Sync Global Model" was clicked. */
  onTriggerSync:   (cb) => safeOn('trigger-sync', cb),

  /** Menu: "Start Training" was clicked. */
  onTriggerTrain:  (cb) => safeOn('trigger-train', cb),

  /** Menu: dataset folder was changed. */
  onDatasetChanged:(cb) => safeOn('dataset-changed', cb),

  // ── GPU / CUDA management ────────────────────────────────────────────────

  /** Check if CUDA PyTorch is installed. Returns { cuda_available, version, device } */
  checkCudaStatus: () => safeInvoke('check-cuda-status'),

  /** Install PyTorch with CUDA 12.1 support. Returns { success, error } */
  installCudaPyTorch: () => safeInvoke('install-cuda-pytorch'),

  /** Stream CUDA installation logs. Returns cleanup fn. */
  onCudaInstallLog: (cb) => safeOn('cuda-install-log', cb),
  /** Stream CUDA progress updates (status, percentage, downloaded, total, message). Returns cleanup fn. */
  onCudaProgress: (cb) => safeOn('cuda-progress', cb),

  /** Cancel ongoing CUDA installation. Returns { cancelled: boolean } */
  cancelCudaInstall: () => safeInvoke('cancel-cuda-install'),

  // ── Model Evaluation ─────────────────────────────────────────────────────

  /**
   * Evaluate global model on test dataset.
   * @param {object} opts - { modelPath, testDir }
   * @returns {Promise<{ success, overall_accuracy, per_class_metrics, ... }>}
   */
  evaluateModel: (opts = {}) => safeInvoke('evaluate-model', opts),

  /** Stream evaluation progress logs. Returns cleanup fn. */
  onEvaluationLog: (cb) => safeOn('evaluation-log', cb),

  // ── AI Analysis ──────────────────────────────────────────────────────────

  /**
   * Get Gemini AI analysis for a prediction.
   * @param {object} opts - { predictedClass, confidence, allProbabilities }
   * @returns {Promise<{ diagnosis, explanation, recommendations, ... }>}
   */
  analyzePrediction: (opts = {}) => safeInvoke('analyze-prediction', opts),

  // ── Dev tools ────────────────────────────────────────────────────────────
  openDevTools: () => safeInvoke('open-devtools'),
});
