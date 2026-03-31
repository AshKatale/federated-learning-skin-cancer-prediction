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
  'run-prediction',
  'select-file',
  'select-dataset-folder',
  'fl-sync',
  'fl-train',
  'fl-status',
  'open-devtools',
  'read-file',
  'list-dataset',
]);

// ── Whitelisted listener channels (main → renderer) ──────────────────────────
const VALID_ON = new Set([
  'training-log',
  'trigger-sync',
  'trigger-train',
  'dataset-changed',
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

  // ── Event listeners (main → renderer) ────────────────────────────────────

  /** Stream training log lines from Python process. Returns cleanup fn. */
  onTrainingLog:   (cb) => safeOn('training-log', cb),

  /** Menu: "Sync Global Model" was clicked. */
  onTriggerSync:   (cb) => safeOn('trigger-sync', cb),

  /** Menu: "Start Training" was clicked. */
  onTriggerTrain:  (cb) => safeOn('trigger-train', cb),

  /** Menu: dataset folder was changed. */
  onDatasetChanged:(cb) => safeOn('dataset-changed', cb),

  // ── Dev tools ────────────────────────────────────────────────────────────
  openDevTools: () => safeInvoke('open-devtools'),
});
