/**
 * Electron Main Process — Skin Cancer FL Desktop App
 *
 * Architecture:
 *   React (Renderer) ──IPC──► Preload ──► Main Process ──► Python / FL-Client HTTP
 *
 * Two Python execution paths:
 *   A) Direct spawn: trainModel, runPrediction  (child_process.spawn)
 *   B) HTTP proxy:   fl-sync, fl-status etc.   (axios → Flask FL client on :6000)
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
const FL_DIR       = path.join(PROJECT_ROOT, 'ml-model');
const FL_CLIENT_DIR= path.join(__dirname, 'fl_client');

// Dev mode: dist not built yet
const isDev = !fs.existsSync(CLIENT_DIST);

let mainWindow     = null;
let flClientProc   = null;  // Flask FL client child process
let trainProc      = null;  // Active training Python process
let cudaInstallProc = null; // CUDA installation Python process (for cancellation)

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
 * Check if PyTorch with CUDA support is installed
 * Also checks if CUDA is available on the system
 * Returns: { installed: boolean, version: string, cuda_available: boolean, device: string }
 */
async function checkCudaStatus() {
  return new Promise(async (resolve) => {
    const python = getPython();
    const checkScript = `
import torch
import sys

# Check torch installation
torch_version = torch.__version__
cuda_available = torch.cuda.is_available()
device_name = None

if cuda_available:
    try:
        device_name = torch.cuda.get_device_name(0)
        cuda_version = torch.version.cuda
    except:
        cuda_version = "Unknown"
else:
    cuda_version = "Not available"

print(f"torch_version:{torch_version}")
print(f"cuda_available:{cuda_available}")
print(f"cuda_version:{cuda_version}")
if device_name:
    print(f"cuda_device:{device_name}")

sys.exit(0)
`.trim();

    const proc = spawn(python, ['-c', checkScript], {
      env: getPythonEnv(),
    });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', async (code) => {
      // Await system CUDA check (for serializable value)
      const systemCudaAvailable = await checkSystemCuda();

      if (code !== 0) {
        console.log('[CUDA Check] PyTorch not installed or error occurred');
        if (error) console.log('[CUDA Check] Error:', error);
        return resolve({
          installed: false,
          version: null,
          cuda_available: false,
          device: null,
          system_cuda_available: systemCudaAvailable,
        });
      }

      const lines = output.split('\n');
      const versionLine = lines.find((l) => l.startsWith('torch_version:'));
      const cudaLine = lines.find((l) => l.startsWith('cuda_available:'));
      const cudaVersionLine = lines.find((l) => l.startsWith('cuda_version:'));
      const deviceLine = lines.find((l) => l.startsWith('cuda_device:'));

      const version = versionLine ? versionLine.split(':')[1].trim() : null;
      const cudaAvailable = cudaLine ? cudaLine.includes('True') : false;
      const cudaVersion = cudaVersionLine ? cudaVersionLine.split(':')[1].trim() : null;
      const device = deviceLine ? deviceLine.split(':')[1].trim() : null;

      console.log(
        `[CUDA Check] Torch: ${version}, CUDA: ${cudaAvailable}, ` +
        `CUDA Version: ${cudaVersion}, Device: ${device}`
      );

      resolve({
        installed: true,
        version,
        cuda_available: cudaAvailable,
        cuda_version: cudaVersion,
        device,
        system_cuda_available: systemCudaAvailable,
      });
    });

    proc.on('error', async (err) => {
      // Await system CUDA check (for serializable value)
      const systemCudaAvailable = await checkSystemCuda();

      console.error('[CUDA Check] Error:', err.message);
      resolve({
        installed: false,
        version: null,
        cuda_available: false,
        device: null,
        system_cuda_available: systemCudaAvailable,
      });
    });
  });
}

/**
 * Check if CUDA drivers/toolkit are installed on the system
 * Uses nvidia-smi to detect CUDA availability
 */
function checkSystemCuda() {
  return new Promise((resolve) => {
    try {
      const proc = exec('nvidia-smi --query-gpu=name --format=csv,noheader', (error, stdout) => {
        if (error) {
          console.log('[System CUDA] nvidia-smi not found - CUDA drivers not installed');
          resolve(false);
        } else {
          const gpuNames = stdout.trim().split('\n');
          const hasGpu = gpuNames.some(name => name.length > 0);
          if (hasGpu) {
            console.log(`[System CUDA] Detected GPU(s): ${gpuNames.join(', ')}`);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
      // Timeout after 3 seconds
      setTimeout(() => resolve(false), 3000);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Install PyTorch with CUDA 12.1 support
 * Streams installation progress to renderer via 'cuda-install-progress'
 * Progress format: { status, downloaded, total, percentage, message }
 */
async function installCudaPyTorch() {
  return new Promise((resolve) => {
    // Prevent multiple simultaneous installations
    if (cudaInstallProc) {
      sendLog('cuda-install-log', '[Install] Installation already in progress');
      return resolve({ success: false, error: 'Installation already in progress' });
    }

    const python = getPython();
    const scriptPath = path.join(__dirname, 'install_cuda_pytorch.py');

    sendLog('cuda-install-log', '[Install] Starting PyTorch CUDA 12.1 installation...');
    sendLog('cuda-install-log', '[Install] Estimated size: ~2.4 GB (one-time download)');
    sendLog('cuda-install-log', '[Install] This may take 5-15 minutes depending on connection speed');

    const proc = spawn(python, [scriptPath], {
      env: getPythonEnv(),
    });

    cudaInstallProc = proc; // Store for cancellation

    let output = '';
    let totalSize = 0;
    let downloadedSize = 0;

    // Parse progress JSON from Python script
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Try to parse as JSON progress update
          const json = JSON.parse(line);
          if (json.status) {
            const { status, downloaded, total, percentage, message } = json;

            sendLog('cuda-install-log', `[${status}] ${message}`);

            // Send progress event with all details
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('cuda-progress', {
                status,
                downloaded: downloaded || 0,
                total: total || 0,
                percentage: percentage || 0,
                message: message || '',
              });
            }

            totalSize = total;
            downloadedSize = downloaded;
          }
        } catch {
          // Not JSON - regular log line
          if (line.trim()) {
            sendLog('cuda-install-log', `[pip] ${line}`);
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        sendLog('cuda-install-log', `[error] ${line}`);
      }
    });

    proc.on('close', (code) => {
      cudaInstallProc = null; // Clear process reference

      if (code === 0) {
        sendLog('cuda-install-log', '[Install] ✅ PyTorch CUDA 12.1 installed successfully!');
        sendLog('cuda-install-log', '[Install] You can now use GPU acceleration for training');

        // Send final progress
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cuda-progress', {
            status: 'completed',
            downloaded: totalSize,
            total: totalSize,
            percentage: 100,
            message: 'Installation completed successfully',
          });
        }

        resolve({ success: true });
      } else {
        sendLog('cuda-install-log', `[Install] ❌ Installation failed (exit code: ${code})`);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cuda-progress', {
            status: 'error',
            percentage: 0,
            message: 'Installation failed',
          });
        }

        resolve({ success: false, error: 'Installation failed with exit code ' + code });
      }
    });

    proc.on('error', (err) => {
      cudaInstallProc = null;
      sendLog('cuda-install-log', `[Install] ❌ Process error: ${err.message}`);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cuda-progress', {
          status: 'error',
          percentage: 0,
          message: 'Process error: ' + err.message,
        });
      }

      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Cancel the ongoing CUDA installation
 */
function cancelCudaInstall() {
  if (cudaInstallProc) {
    console.log('[CUDA] Cancelling installation...');
    try {
      // Kill the process tree (including pip)
      if (process.platform === 'win32') {
        exec(`taskkill /PID ${cudaInstallProc.pid} /T /F`, (error) => {
          if (error) console.error('[CUDA] Error killing process:', error);
        });
      } else {
        process.kill(-cudaInstallProc.pid); // Kill process group on Unix
      }
    } catch (e) {
      cudaInstallProc.kill('SIGTERM');
    }
    cudaInstallProc = null;

    sendLog('cuda-install-log', '[Install] ❌ Installation cancelled by user');

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cuda-progress', {
        status: 'cancelled',
        percentage: 0,
        message: 'Installation cancelled',
      });
    }

    return { cancelled: true };
  }
  return { cancelled: false, error: 'No installation in progress' };
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
  // ── 1. Open the window FIRST — spawn failures must NEVER block the UI ─────
  if (isDev) {
    console.log(`[Electron] Waiting for React dev server on :${REACT_PORT}…`);
    const ip = await waitForPort(REACT_PORT);
    createWindow(ip);
  } else {
    createWindow(null);
  }
  buildMenu();

  // ── 2. Auto-start the Flask FL client (non-critical; errors are logged) ────
  try {
    const python       = getPython();
    const clientScript = path.join(FL_CLIENT_DIR, 'client.py');
    if (!fs.existsSync(clientScript)) {
      console.warn('[Electron] client.py not found — FL sync/status will be unavailable');
    } else {
      console.log(`[Electron] Starting FL client on port ${FL_CLIENT_PORT}…`);
      flClientProc = spawn(python, [clientScript], {
        cwd: FL_CLIENT_DIR,
        env: {
          ...getPythonEnv(),
          FL_CLIENT_PORT: String(FL_CLIENT_PORT),
          FL_SERVER_URL:  'http://127.0.0.1:6000',  // fl-server default port
        },
      });
      flClientProc.stdout.on('data', (d) =>
        d.toString().split('\n').filter(Boolean).forEach((l) => console.log('[FL-Client]', l))
      );
      flClientProc.stderr.on('data', (d) =>
        d.toString().split('\n').filter(Boolean).forEach((l) => console.warn('[FL-Client stderr]', l))
      );
      flClientProc.on('close', (code) => {
        console.log(`[FL-Client] exited (code ${code})`);
        flClientProc = null;
      });
      flClientProc.on('error', (err) => {
        console.error('[FL-Client] Failed to start:', err.message);
        flClientProc = null;
      });
    }
  } catch (e) {
    console.error('[Electron] FL client spawn error (non-fatal):', e.message);
  }
});

app.on('before-quit', () => {
  if (flClientProc && !flClientProc.killed) {
    console.log('[Electron] Killing FL client process…');
    flClientProc.kill('SIGTERM');
    flClientProc = null;
  }
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
    const server   = opts.server   || '127.0.0.1:6000';  // must match fl-server port
    const device   = opts.device   || 'cpu';  // NEW: 'cpu' or 'cuda'

    const pyEnv = getPythonEnv();
    console.log(`[IPC:train-model] python=${python}`);
    console.log(`[IPC:train-model] device=${device}`);
    console.log(`[IPC:train-model] PYTHONPATH=${pyEnv.PYTHONPATH}`);

    const logs = [];
    trainProc = spawn(python, [
      script,
      '--client-id', clientId,
      '--data-dir',  dataDir,
      '--epochs',    epochs,
      '--server',    server,
      '--device',    device,  // NEW: Pass device to training script
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

// ── CUDA Management ──────────────────────────────────────────────────────────

/** Check if CUDA PyTorch is installed */
ipcMain.handle('check-cuda-status', async () => {
  return await checkCudaStatus();
});

/** Install PyTorch with CUDA support (streams logs via 'cuda-install-log') */
ipcMain.handle('install-cuda-pytorch', async () => {
  return await installCudaPyTorch();
});

/** Cancel ongoing CUDA installation */
ipcMain.handle('cancel-cuda-install', () => {
  return cancelCudaInstall();
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

// ── 6. FL-client HTTP proxy handlers (Flask on :5000) ───────────────────────

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

// ── 7. Model Evaluation ──────────────────────────────────────────────────────

/**
 * Evaluate the global FL model on a test dataset.
 * Streams progress logs via 'evaluation-log' channel.
 * Returns: { success, overall_accuracy, per_class_metrics, confusion_matrix, ... }
 */
ipcMain.handle('evaluate-model', async (_event, opts = {}) => {
  return new Promise((resolve) => {
    const python = getPython();
    const script = path.join(FL_CLIENT_DIR, 'evaluate_model.py');
    const modelPath = opts.modelPath || path.join(FL_CLIENT_DIR, 'local_weights', 'global_model_round_1.pt');
    const testDir = opts.testDir || 'D:\\Skin Cancer Dataset\\test';

    if (!fs.existsSync(script)) {
      return resolve({ success: false, error: 'evaluate_model.py not found' });
    }

    sendLog('evaluation-log', `[Evaluate] Starting model evaluation...`);
    sendLog('evaluation-log', `[Evaluate] Model: ${modelPath}`);
    sendLog('evaluation-log', `[Evaluate] Test folder: ${testDir}`);

    const evalProc = spawn(python, [
      script,
      '--data-dir', testDir,
      '--model-path', modelPath,
      '--server', 'http://127.0.0.1:6000',
    ], {
      cwd: FL_CLIENT_DIR,
      env: getPythonEnv(),
    });

    let stdout = '', stderr = '';

    evalProc.stdout.on('data', (d) => {
      const text = d.toString();
      stdout += text;
      // Extract and log progress lines
      text.split('\n').forEach(line => {
        if (line.includes('Progress:') || line.includes('Found') || line.includes('Loading')) {
          sendLog('evaluation-log', `[Eval] ${line.trim()}`);
        }
      });
    });

    evalProc.stderr.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      text.split('\n').filter(Boolean).forEach(line => {
        sendLog('evaluation-log', `[Eval Error] ${line}`);
      });
    });

    evalProc.on('close', (code) => {
      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n');
          const result = JSON.parse(lines[lines.length - 1]);
          sendLog('evaluation-log', `[Evaluate] ✅ Evaluation complete!`);
          sendLog('evaluation-log', `[Evaluate] Overall Accuracy: ${(result.overall_accuracy * 100).toFixed(2)}%`);
          resolve({ success: true, ...result });
        } catch (e) {
          sendLog('evaluation-log', `[Evaluate] ❌ Failed to parse results: ${e.message}`);
          resolve({ success: false, error: 'Failed to parse evaluation results', stdout, stderr });
        }
      } else {
        sendLog('evaluation-log', `[Evaluate] ❌ Evaluation failed (exit code: ${code})`);
        resolve({ success: false, error: `Exit code ${code}`, stderr });
      }
    });

    evalProc.on('error', (err) => {
      sendLog('evaluation-log', `[Evaluate] ❌ Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
  });
});

// ── 8. AI Analysis via Gemini ────────────────────────────────────────────────

/**
 * Get Gemini AI analysis for a skin cancer prediction.
 * Returns: { diagnosis, explanation, recommendations, risk_level, ... }
 */
ipcMain.handle('analyze-prediction', async (_event, opts = {}) => {
  return new Promise((resolve) => {
    const python = getPython();
    const script = path.join(FL_CLIENT_DIR, 'gemini_analyzer.py');

    if (!fs.existsSync(script)) {
      return resolve({ 
        success: false, 
        error: 'gemini_analyzer.py not found',
        fallback: true 
      });
    }

    const { predictedClass, confidence, allProbabilities } = opts;

    const analyzeProc = spawn(python, [
      script,
      '--class', predictedClass || 'bkl',
      '--confidence', String(confidence || 0.5),
      '--probs', JSON.stringify(allProbabilities || {}),
    ], {
      cwd: FL_CLIENT_DIR,
      env: getPythonEnv(),
    });

    let stdout = '', stderr = '';

    analyzeProc.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    analyzeProc.stderr.on('data', (d) => {
      stderr += d.toString();
      console.log(`[Gemini Analyzer stderr] ${d.toString()}`);
    });

    analyzeProc.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.log(`[Gemini] Failed to parse result: ${e.message}`);
          resolve({ 
            success: false, 
            error: 'Failed to parse AI analysis',
            fallback: true 
          });
        }
      } else {
        console.log(`[Gemini] Process exited with code ${code}`);
        resolve({ 
          success: false, 
          error: `Process exit code ${code}`,
          fallback: true 
        });
      }
    });

    analyzeProc.on('error', (err) => {
      resolve({ 
        success: false, 
        error: err.message,
        fallback: true 
      });
    });
  });
});

// ── 9. Misc ──────────────────────────────────────────────────────────────────

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
