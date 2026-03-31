/**
 * Electron Main Process — Skin Cancer FL Desktop App
 *
 * Architecture:
 *   React (Renderer) ──IPC──► Preload ──► Main Process ──► Python / FL-Client HTTP
 *
 * Two Python execution paths:
 *   A) Direct spawn: trainModel, runPrediction  (child_process.spawn)
 *   B) HTTP proxy:   fl-sync, fl-status etc.   (axios → Flask FL client on :7000)
 */

'use strict';

const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const { spawn, exec } = require('child_process');

// Optional axios — only used for FL-client HTTP proxying
let axios;
try { axios = require('axios'); } catch { axios = null; }

// ── Constants ────────────────────────────────────────────────────────────────

const REACT_PORT     = 3000;
const FL_CLIENT_PORT = 7000;
const SERVER_PORT    = 3001;

// Root of the mono-repo (one level above desktop-app/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CLIENT_DIST  = path.join(PROJECT_ROOT, 'client', 'dist', 'index.html');
const FL_DIR       = path.join(PROJECT_ROOT, 'federated-learning');
const FL_CLIENT_DIR= path.join(__dirname, 'fl_client');

// Dev mode: dist not built yet
const isDev = !fs.existsSync(CLIENT_DIST);

let mainWindow   = null;
let flClientProc = null;  // Flask FL client child process
let trainProc    = null;  // Active training Python process

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for a TCP port to become reachable (handles IPv4/IPv6 on Windows). */
function waitForPort(port, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tryIPs   = ['127.0.0.1', '::1'];

    const attempt = () => {
      let ok = false, checked = 0;
      tryIPs.forEach((ip) => {
        const req = http.get({ hostname: ip, port, path: '/' }, (res) => {
          res.resume();
          if (!ok) { ok = true; resolve(ip); }
        });
        req.on('error', () => {
          checked++;
          if (checked === tryIPs.length && !ok) {
            Date.now() < deadline ? setTimeout(attempt, 500) : resolve(null);
          }
        });
        req.setTimeout(400, () => req.destroy());
      });
    };
    attempt();
  });
}

/** Send a log line to the renderer (shown in UI log panel). */
function sendLog(channel, line) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, line);
  }
}

/** Resolve python executable (venv → system). Logs which one is chosen. */
function getPython() {
  const candidates = [
    path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe'), // Windows venv
    path.join(PROJECT_ROOT, 'venv', 'bin', 'python3'),         // Unix/Mac venv
    path.join(PROJECT_ROOT, 'venv', 'bin', 'python'),          // Unix venv alt
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[Electron] Using venv Python: ${p}`);
      return p;
    }
  }
  // Fallback to system python — warn loudly
  console.warn('[Electron] WARNING: venv not found. Falling back to system Python.');
  console.warn(`[Electron] Expected venv at: ${path.join(PROJECT_ROOT, 'venv')}`);
  return 'python';
}

/**
 * Build the environment for spawned Python processes.
 * Adds venv site-packages and all needed source dirs to PYTHONPATH
 * so `import torch`, `from skin_cancer_model import ...` etc. all work.
 */
function getPythonEnv() {
  const venvRoot    = path.join(PROJECT_ROOT, 'venv');
  const sitePackWin = path.join(venvRoot, 'Lib', 'site-packages');
  const sitePackUnix= path.join(venvRoot, 'lib', 'python3.11', 'site-packages'); // adjust if needed

  // Dirs that contain importable Python source for this project
  const srcDirs = [
    FL_DIR,           // skin_cancer_model.py, fl_data_loader.py etc.
    FL_CLIENT_DIR,    // model.py, trainer.py etc.
  ];

  // Build PYTHONPATH: existing system path + venv site-packages + project src dirs
  const existingPP = process.env.PYTHONPATH || '';
  const newPP = [
    existingPP,
    sitePackWin,
    sitePackUnix,
    ...srcDirs,
  ].filter(Boolean).join(path.delimiter);

  // Also add venv Scripts/bin to PATH so pip-installed CLIs work
  const venvBin = process.platform === 'win32'
    ? path.join(venvRoot, 'Scripts')
    : path.join(venvRoot, 'bin');

  return {
    ...process.env,
    PYTHONUNBUFFERED: '1',     // real-time stdout streaming
    PYTHONPATH: newPP,
    PATH: `${venvBin}${path.delimiter}${process.env.PATH || ''}`,
    VIRTUAL_ENV: venvRoot,
  };
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow(ip) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,   // security: keep Node out of renderer
      contextIsolation: true,   // security: isolate contexts
      sandbox: false,           // needed for preload require()
    },
  });

  const host     = ip || 'localhost';
  const startUrl = isDev
    ? `http://${host}:${REACT_PORT}`
    : `file://${CLIENT_DIST}`;

  console.log(`[Electron] Mode: ${isDev ? 'DEV' : 'PROD'} — Loading: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Retry once on load failure (Vite still warming up)
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code === -3) return; // navigation aborted — ignore
    console.warn(`[Electron] Load failed (${code}: ${desc}) — retrying in 1.5s`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(startUrl);
    }, 1500);
  });

  // Open external links in OS browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', async () => {
  if (isDev) {
    console.log(`[Electron] Waiting for React dev server on :${REACT_PORT}…`);
    const ip = await waitForPort(REACT_PORT);
    createWindow(ip);
  } else {
    createWindow(null);
  }
  buildMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow(null);
});

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. App / service status ──────────────────────────────────────────────────

ipcMain.handle('app-status', async () => {
  const check = async (url) => {
    if (!axios) return 'unknown';
    try { await axios.get(url, { timeout: 3000 }); return 'running'; }
    catch { return 'offline'; }
  };
  return {
    server:    await check(`http://localhost:${SERVER_PORT}/api/health`),
    fl_client: await check(`http://127.0.0.1:${FL_CLIENT_PORT}/health`),
    python:    getPython(),
    mode:      isDev ? 'development' : 'production',
  };
});

// ── 2. Train model — spawns Python fl_client directly ───────────────────────

ipcMain.handle('train-model', async (_event, opts = {}) => {
  return new Promise((resolve) => {
    const python   = getPython();
    // Use training_runner.py — a simple CLI wrapper around the FL training logic
    const script   = path.join(FL_CLIENT_DIR, 'training_runner.py');
    const dataDir  = opts.dataDir  || process.env.LOCAL_DATA_DIR || 'D:\\Skin Cancer Dataset';
    const clientId = opts.clientId || '1';
    const epochs   = String(opts.epochs || 1);
    const server   = opts.server   || '127.0.0.1:8080';

    const pyEnv = getPythonEnv();
    console.log(`[IPC:train-model] python=${python}`);
    console.log(`[IPC:train-model] PYTHONPATH=${pyEnv.PYTHONPATH}`);

    const logs = [];
    trainProc = spawn(python, [
      script,
      '--client-id', clientId,
      '--data-dir',  dataDir,
      '--epochs',    epochs,
      '--server',    server,
    ], {
      cwd: FL_CLIENT_DIR,
      env: pyEnv,
    });

    trainProc.stdout.on('data', (chunk) => {
      chunk.toString().split('\n').filter(Boolean).forEach((line) => {
        logs.push(line);
        sendLog('training-log', line);
      });
    });

    trainProc.stderr.on('data', (chunk) => {
      chunk.toString().split('\n').filter(Boolean).forEach((line) => {
        logs.push(`[stderr] ${line}`);
        sendLog('training-log', `[stderr] ${line}`);
      });
    });

    trainProc.on('close', (code) => {
      trainProc = null;
      resolve({ success: code === 0, exitCode: code, logs });
    });

    trainProc.on('error', (err) => {
      trainProc = null;
      resolve({ success: false, error: err.message, logs });
    });
  });
});

// ── Kill active training process ──────────────────────────────────────────────
ipcMain.handle('kill-training', () => {
  if (trainProc && !trainProc.killed) {
    trainProc.kill('SIGTERM');
    trainProc = null;
    return { killed: true };
  }
  return { killed: false };
});

// ── 3. Run prediction — spawns inference_runner.py ───────────────────────────

ipcMain.handle('run-prediction', async (_event, imagePath) => {
  if (!imagePath) return { error: 'No image path provided' };

  return new Promise((resolve) => {
    const python = getPython();
    // inference_runner.py: accepts --image, prints JSON on last stdout line
    const script = path.join(FL_CLIENT_DIR, 'inference_runner.py');

    const proc = spawn(python, [script, '--image', imagePath], {
      cwd: FL_CLIENT_DIR,
      env: getPythonEnv(),
    });

    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      try {
        // The Python script prints JSON on the last line of stdout
        const lines  = stdout.trim().split('\n');
        const result = JSON.parse(lines[lines.length - 1]);
        resolve({ success: true, prediction: result });
      } catch {
        resolve({ success: false, stdout, stderr, exitCode: code });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// ── 4. Select image file ─────────────────────────────────────────────────────

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Skin Lesion Image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tif', 'tiff'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  return { canceled: false, filePath: result.filePaths[0] };
});

// ── 5. Select dataset folder ─────────────────────────────────────────────────

ipcMain.handle('select-dataset-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Skin Cancer Dataset Folder',
    properties: ['openDirectory'],
    buttonLabel: 'Use This Folder',
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };

  const folderPath = result.filePaths[0];

  // Notify running FL client (if any) via HTTP
  if (axios) {
    try {
      const r = await axios.post(
        `http://127.0.0.1:${FL_CLIENT_PORT}/api/set-dataset`,
        { data_dir: folderPath },
        { timeout: 5000 }
      );
      return { canceled: false, path: folderPath, fl_response: r.data };
    } catch {
      return { canceled: false, path: folderPath, fl_response: null };
    }
  }
  return { canceled: false, path: folderPath, fl_response: null };
});

// ── 6. FL-client HTTP proxy handlers (Flask on :7000) ───────────────────────

const flProxy = (method, endpoint, body = null) => async () => {
  if (!axios) return { error: 'axios not available' };
  try {
    const url = `http://127.0.0.1:${FL_CLIENT_PORT}${endpoint}`;
    const r   = method === 'GET'
      ? await axios.get(url, { timeout: 10000 })
      : await axios.post(url, body || {}, { timeout: 60000 });
    return r.data;
  } catch (e) { return { error: e.message }; }
};

ipcMain.handle('fl-sync',   flProxy('POST', '/api/sync'));
ipcMain.handle('fl-train',  flProxy('POST', '/api/train'));
ipcMain.handle('fl-status', flProxy('GET',  '/api/status'));

// ── 7. Misc ──────────────────────────────────────────────────────────────────

ipcMain.handle('open-devtools', () => mainWindow?.webContents.openDevTools());

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: data.toString('base64'), size: data.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('list-dataset', async (_event, dir) => {
  try {
    if (!dir || !fs.existsSync(dir)) return { error: 'Directory not found' };
    const files = fs.readdirSync(dir)
      .filter(f => /\.(jpg|jpeg|png|bmp|tif|tiff)$/i.test(f))
      .slice(0, 500); // cap at 500 for performance
    return { success: true, files, count: files.length };
  } catch (e) {
    return { error: e.message };
  }
});

// ── Menu ─────────────────────────────────────────────────────────────────────

function buildMenu() {
  const tpl = [
    {
      label: 'File',
      submenu: [
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'FL',
      submenu: [
        { label: 'Sync Global Model',  click: () => mainWindow?.webContents.send('trigger-sync') },
        { label: 'Start Training',     click: () => mainWindow?.webContents.send('trigger-train') },
        { label: 'Select Dataset…',   click: async () => {
            const r = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'], buttonLabel: 'Use This Folder',
            });
            if (!r.canceled) mainWindow?.webContents.send('dataset-changed', r.filePaths[0]);
          }
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools() },
        { label: 'Reload',          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload() },
        { label: 'Zoom In',         accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow?.webContents.setZoomLevel(
            mainWindow.webContents.getZoomLevel() + 0.5) },
        { label: 'Zoom Out',        accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.setZoomLevel(
            mainWindow.webContents.getZoomLevel() - 0.5) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}
