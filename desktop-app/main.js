/**
 * Electron Main Process
 * Manages application lifecycle and spawns backend processes
 */

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');

const SERVER_PORT = 3001;
const FL_PORT = 8080;
const ML_PORT = 5000;
const REACT_PORT = 5173;

// Production build path
const REACT_BUILD_PATH = path.join(__dirname, '../client/build');
const SERVER_PATH = path.join(__dirname, '../server');
const FL_PATH = path.join(__dirname, '../federated-learning');
const ML_PATH = path.join(__dirname, '../ml-model');

// Detect if running in development
const isDev = process.env.NODE_ENV === 'development' || 
              process.argv.includes('--dev') ||
              !fs.existsSync(REACT_BUILD_PATH);

let mainWindow;
let serverProcess;
let flServerProcess;
let pythonMLProcess;

/**
 * Create main window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, './assets/icon.png') // Optional
  });

  // In development: load from dev server
  // In production: load from build folder
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(REACT_BUILD_PATH, 'index.html')}`;

  console.log(`[Electron] Loading URL: ${startUrl}`);

  mainWindow.loadURL(startUrl).catch(err => {
    console.error('[Electron] Failed to load URL:', err.message);
    console.log('[Electron] Make sure React dev server is running on port 3000');
    console.log('[Electron] Or build React app: cd client && npm run build');
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupProcesses();
  });
}

/**
 * Start Node.js Express server
 */
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting Node.js server...');

    // Use npm.cmd on Windows, npm on Unix
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    serverProcess = spawn(npmCmd, ['start'], {
      cwd: SERVER_PATH,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: SERVER_PORT
      },
      shell: process.platform === 'win32'
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Server] ${data}`);
      if (data.toString().includes('listening') || data.toString().includes('started')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data}`);
    });

    serverProcess.on('error', (error) => {
      console.error('[Server] Failed to start:', error.message);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(resolve, 10000);
  });
}

/**
 * Start Python ML model server
 */
function startMLServer() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting Python ML server...');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    pythonMLProcess = spawn(pythonCmd, ['app.py'], {
      cwd: ML_PATH,
      env: {
        ...process.env,
        FLASK_PORT: ML_PORT,
        FLASK_ENV: 'production'
      },
      shell: process.platform === 'win32'
    });

    pythonMLProcess.stdout.on('data', (data) => {
      console.log(`[ML Server] ${data}`);
      if (data.toString().includes('running') || data.toString().includes('WARNING')) {
        resolve();
      }
    });

    pythonMLProcess.stderr.on('data', (data) => {
      console.error(`[ML Server Error] ${data}`);
    });

    pythonMLProcess.on('error', (error) => {
      console.error('[ML Server] Failed to start:', error.message);
      reject(error);
    });

    setTimeout(resolve, 5000);
  });
}

/**
 * Start Flower FL Server (runs once, clients connect to it)
 */
function startFLServer() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting Flower FL server...');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    flServerProcess = spawn(pythonCmd, ['fl_server.py'], {
      cwd: FL_PATH,
      env: {
        ...process.env,
        FL_PORT: FL_PORT,
        FL_SERVER_ADDRESS: `0.0.0.0:${FL_PORT}`
      },
      shell: process.platform === 'win32'
    });

    flServerProcess.stdout.on('data', (data) => {
      console.log(`[FL Server] ${data}`);
    });

    flServerProcess.stderr.on('data', (data) => {
      console.error(`[FL Server Error] ${data}`);
    });

    flServerProcess.on('error', (error) => {
      console.error('[FL Server] Failed to start:', error.message);
      // FL Server is optional for basic operation
      resolve();
    });

    // Give it time to start
    setTimeout(resolve, 3000);
  });
}

/**
 * Initialize app
 */
async function initializeApp() {
  try {
    console.log('[Electron] Initializing application...');
    console.log('[Electron] Starting backend services...');

    // Start servers in parallel, continue even if some fail
    await Promise.all([
      startServer().catch(e => {
        console.warn('Server startup error (non-critical):', e.message);
      }),
      startMLServer().catch(e => {
        console.warn('ML server startup error (non-critical):', e.message);
      }),
      startFLServer().catch(e => {
        console.warn('FL server startup error (non-critical):', e.message);
      })
    ]);

    console.log('[Electron] Services initialization complete');
    createWindow();
  } catch (error) {
    console.warn('[Electron] Service initialization error (non-critical):', error.message);
    // Still create window - services are optional
    createWindow();
  }
}

/**
 * App event handlers
 */
app.on('ready', initializeApp);

app.on('window-all-closed', () => {
  // On macOS, apps stay active until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Cleanup processes on exit
 */
process.on('exit', cleanupProcesses);
process.on('SIGINT', () => {
  cleanupProcesses();
  process.exit(0);
});

function cleanupProcesses() {
  console.log('[Electron] Cleaning up processes...');

  if (serverProcess) {
    serverProcess.kill();
  }
  if (flServerProcess) {
    flServerProcess.kill();
  }
  if (pythonMLProcess) {
    pythonMLProcess.kill();
  }
}

/**
 * IPC Handlers for frontend communication
 */

// Get application status
ipcMain.handle('app-status', async () => {
  try {
    const serverHealth = await axios.get(`http://localhost:${SERVER_PORT}/api/health`)
      .then(() => true)
      .catch(() => false);

    const mlHealth = await axios.get(`http://localhost:${ML_PORT}/health`)
      .then(() => true)
      .catch(() => false);

    return {
      server: serverHealth ? 'running' : 'offline',
      ml: mlHealth ? 'running' : 'offline',
      fl: flServerProcess ? 'running' : 'offline'
    };
  } catch (error) {
    return {
      server: 'error',
      ml: 'error',
      fl: 'error'
    };
  }
});

// Start FL training
ipcMain.handle('start-fl-training', async (event, { type, config }) => {
  try {
    const url = type === 'global'
      ? `http://localhost:${SERVER_PORT}/api/federated-learning/train-global`
      : `http://localhost:${SERVER_PORT}/api/federated-learning/train-local`;

    const response = await axios.post(url, config);
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Get training status
ipcMain.handle('get-training-status', async (event, trainingId) => {
  try {
    const response = await axios.get(
      `http://localhost:${SERVER_PORT}/api/federated-learning/${trainingId}/status`
    );
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Open DevTools
ipcMain.handle('open-devtools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
});

/**
 * Menu setup
 */
const createMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.on('ready', createMenu);
