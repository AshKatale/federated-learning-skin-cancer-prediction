# Electron Desktop App — Skin Cancer FL Client

> True desktop application: local file access · Python ML execution · GPU training · IPC-based UI

---

## Architecture

```
React UI (renderer)
    │  window.electronAPI.*()
    ▼
preload.js (contextBridge)
    │  ipcRenderer.invoke()
    ▼
main.js (Electron main / Node.js)
    │  child_process.spawn()
    ▼
Python ML scripts
    ├─ fl_client/training_runner.py   ← local training
    ├─ fl_client/inference_runner.py  ← local prediction
    └─ federated-learning/skin_cancer_model.py etc.
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.9 |
| PyTorch | ≥ 2.0 |
| Electron | ≥ 27 (installed via npm) |

### 1. Install Python dependencies

```powershell
# From project root (uses shared venv)
cd "D:\Major Project"
python -m venv venv
.\venv\Scripts\activate
pip install torch torchvision pillow flask requests flwr
pip install -r federated-learning/requirements.txt
pip install -r desktop-app/fl_client/requirements.txt
```

### 2. Install Node dependencies

```powershell
cd "D:\Major Project\desktop-app"
npm install

cd "D:\Major Project\client"
npm install
```

---

## Running Modes

### Mode A — Development (React hot-reload + Electron)

Runs React on `localhost:3000` and Electron loads it via URL.

```powershell
# Terminal 1: start React dev server
cd "D:\Major Project\client"
npm run dev

# Terminal 2: start Electron (waits for React to be ready)
cd "D:\Major Project\desktop-app"
npm run dev
```

Or use one command:
```powershell
cd "D:\Major Project\desktop-app"
npm run dev-full
```

### Mode B — Production (built React, no dev server dependency)

Electron loads `client/dist/index.html` — **no localhost needed**.

```powershell
# Step 1: build React
cd "D:\Major Project\client"
npm run build          # output → client/dist/

# Step 2: launch Electron (prod mode auto-detected)
cd "D:\Major Project\desktop-app"
npm start
```

---

## IPC API Reference

All APIs are available in React as `window.electronAPI.*`

| Method | Description | Returns |
|--------|-------------|---------|
| `getAppStatus()` | Service health check | `{ server, fl_client, python, mode }` |
| `trainModel(opts)` | Spawn Python training | `{ success, logs, exitCode }` |
| `runPrediction(imagePath)` | Spawn Python inference | `{ success, prediction }` |
| `selectFile()` | Native file picker | `{ canceled, filePath }` |
| `selectDatasetFolder()` | Native folder picker | `{ canceled, path }` |
| `readFile(path)` | Read file as base64 | `{ success, data, size }` |
| `listDataset(dir)` | List images in folder | `{ success, files, count }` |
| `flSync()` | Sync from FL server | `{ updated, synced_round }` |
| `flTrain()` | Trigger FL client train | `{ status }` |
| `flStatus()` | FL client status | `{ client_id, synced_round, ... }` |

### Event Listeners (main → renderer)

```js
// Stream live training logs from Python process
const cleanup = window.electronAPI.onTrainingLog((line) => {
  console.log(line);  // e.g. "[FL Training] Epoch 1/2 Loss=0.42 Acc=76.3%"
});
// Call cleanup() in useEffect return to unsubscribe

window.electronAPI.onTriggerTrain(() => startTraining());
window.electronAPI.onTriggerSync(() => syncModel());
window.electronAPI.onDatasetChanged((path) => setDatasetPath(path));
```

### React usage example

```jsx
// In any React component — NO direct Node.js imports!
async function handleTrain() {
  const result = await window.electronAPI.trainModel({
    dataDir:  'D:/Skin Cancer Dataset',
    clientId: '1',
    epochs:   2,
  });
  console.log(result.success, result.logs);
}

async function handlePredict(imagePath) {
  const { success, prediction } = await window.electronAPI.runPrediction(imagePath);
  if (success) console.log(prediction.class_name, prediction.confidence);
}

async function handleBrowse() {
  const { canceled, filePath } = await window.electronAPI.selectFile();
  if (!canceled) handlePredict(filePath);
}
```

---

## Python Scripts

### `fl_client/training_runner.py`

CLI wrapper for local FL training. Called by `main.js` `train-model` IPC handler.

```powershell
python training_runner.py \
  --client-id 1 \
  --data-dir "D:/Skin Cancer Dataset" \
  --epochs 2 \
  --server 127.0.0.1:8080
```

- Streams progress lines to stdout (Electron pipes each line → React UI via IPC)
- Saves weights to `fl_client/local_weights/client_<id>_trained.pt`
- Prints final JSON summary on last line

### `fl_client/inference_runner.py`

CLI wrapper for local inference. Called by `main.js` `run-prediction` IPC handler.

```powershell
python inference_runner.py --image "D:/photos/lesion.jpg"
```

- Prints JSON result on stdout last line:
  ```json
  {"success": true, "class_name": "Melanoma", "confidence": 0.87, "risk_level": "High"}
  ```

---

## Security

| Setting | Value | Reason |
|---------|-------|--------|
| `nodeIntegration` | `false` | Renderer has no Node.js access |
| `contextIsolation` | `true` | Preload context is isolated |
| `contextBridge` | whitelisted channels only | Only 10 named channels permitted |
| `setWindowOpenHandler` | deny + shell.openExternal | External links open in OS browser |

---

## File Structure

```
desktop-app/
├── main.js              ← Electron main process (Node.js, system access)
├── preload.js           ← Secure IPC bridge (contextBridge)
├── package.json
└── fl_client/
    ├── client.py        ← Flask HTTP server (alternative launch mode)
    ├── training_runner.py   ← CLI: spawned by Electron for training
    ├── inference_runner.py  ← CLI: spawned by Electron for prediction
    ├── model.py
    ├── trainer.py
    ├── scheduler.py
    ├── requirements.txt
    └── local_weights/   ← Saved model checkpoints

client/                  ← React app (UI only — no Node.js)
├── src/
│   ├── components/
│   │   ├── FLControlPanel.jsx  ← Uses window.electronAPI IPC
│   │   └── AppShell.jsx        ← Shows FL nav icon in Electron
│   └── pages/
│       └── FLDashboard.jsx     ← /fl route
└── dist/                ← Built output (loaded by Electron in prod)

federated-learning/      ← Core ML code (shared by Python scripts)
├── skin_cancer_model.py
├── fl_data_loader.py
├── fl_client.py
└── fl_model_inference.py
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `python not found` | Activate venv or add Python to PATH |
| `No training data found` | Select your HAM10000 dataset folder via "Browse…" button |
| `axios not found` | Run `npm install` in `desktop-app/` |
| White screen on launch | Run `npm run build` in `client/` first for prod mode |
| FL panel not visible | Only shows inside Electron (`window.electronAPI` exists) |
| Training log not streaming | Check `PYTHONUNBUFFERED=1` is set (done automatically in main.js) |
