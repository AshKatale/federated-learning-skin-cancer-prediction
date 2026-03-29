# Federated Learning System - Complete Implementation

## Overview
A hybrid federated learning system with two training modes:
1. **Global Training** - Server-triggered collaborative learning across multiple clients
2. **Local Training** - Client-specific training without server aggregation

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DESKTOP APP (Electron)                    │
│  Single executable that launches all services automatically  │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────┬───────────┼───────────┬─────────────┐
    ▼             ▼           ▼           ▼             ▼
┌─────────┐  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
│ React   │  │  Node.js │ │ Flower │ │ Python  │ │  SQLite  │
│Frontend │  │ Backend  │ │  FL    │ │  ML     │ │  Database│
│:3000    │  │ :3001    │ │:8080   │ │ :5000   │ │          │
└─────────┘  └──────────┘ └────────┘ └─────────┘ └──────────┘
```

## Files Created

### Python Federated Learning Components

#### `fl_server.py`
- **Purpose**: Flower framework server for federated aggregation
- **Strategy**: FedAvg (Federated Averaging)
- **Features**:
  - Weighted model aggregation based on sample counts
  - Handles partial client participation
  - Logs aggregation metrics per round
  - Saves global model weights after each round
- **Runs on port**: 8080

#### `fl_client.py`
- **Purpose**: Flower client for local training
- **Features**:
  - Loads global model weights from server
  - Trains locally (1-2 epochs recommended)
  - Returns updated weights to server
  - Supports validation dataset
  - PyTorch-based CNN model (EfficientNet compatible)
- **Usage**: Each client connects to server and participates in rounds

#### `client_simulator.py`
- **Purpose**: Simulates multiple clients with heterogeneous data
- **Features**:
  - IID and non-IID data distribution
  - Dirichlet distribution for non-IID (alpha parameter)
  - Image hashing for deduplication
  - Database tracking of image usage
  - Exports client data distributions
- **Use case**: Testing without real hospital networks

#### `training_orchestrator.py`
- **Purpose**: Automates FL training and monitoring
- **Features**:
  - Start global or local training via Python
  - Auto-trigger training when image threshold reached
  - Monitor trained vs unused images
  - Fetch analytics
  - Command-line interface
- **Modes**:
  ```bash
  python training_orchestrator.py --mode global --clients 3 --rounds 5
  python training_orchestrator.py --mode local --epochs 1
  python training_orchestrator.py --mode monitor --threshold 20
  python training_orchestrator.py --mode analytics
  ```

### Node.js Backend Integration

#### `server/controllers/federatedLearningController.js`
- **New endpoints**:
  - `POST /train-global` - Start global federated training
  - `POST /train-local` - Start local training
  - `GET /:trainingId/status` - Check training status
  - `GET /analytics` - Get FL metrics and trends
- **Features**:
  - Spawns Python FL server process
  - Manages client simulators
  - Tracks training rounds in MongoDB
  - Background training execution

#### `server/routes/federatedLearningRoutes.js`
- Updated with new endpoints
- Authentication via JWT tokens
- Role-based access control (admin for global, any user for local)

### Desktop Application (Electron)

#### `desktop-app/main.js`
- **Purpose**: Main Electron process
- **Features**:
  - Auto-starts all services (Node backend, Flask ML, Flower FL)
  - IPC communication with React frontend
  - Manages process lifecycle
  - Menu with DevTools toggle
  - Health checks for services
- **Environment**: Runs all services in background, opens single window

#### `desktop-app/preload.js`
- **Purpose**: Secure IPC bridge
- **Exposed APIs**:
  - `getAppStatus()` - Check service health
  - `startTraining(type, config)` - Trigger FL training
  - `getTrainingStatus(trainingId)` - Poll training status
  - `openDevTools()` - Dev tools toggle

#### `desktop-app/package.json`
- Electron configuration
- Build scripts for Windows, macOS, Linux
- Auto-update setup

### Startup Scripts

#### Linux/macOS
- `start-dev.sh` - Start all services for development
- `start-desktop.sh` - Start Electron desktop app

#### Windows
- `start-dev.bat` - Start all services for development
- `start-desktop.bat` - Start Electron desktop app

## Installation

### Prerequisites
- **Node.js** 16+ (for React, Node backend, Electron)
- **Python** 3.8+ (for ML model, Flower, client simulator)
- **pip** packages (see federated-learning/requirements.txt)

### Setup Steps

1. **Install Node dependencies**
   ```bash
   cd client && npm install
   cd ../server && npm install
   cd ../desktop-app && npm install
   ```

2. **Install Python dependencies**
   ```bash
   cd federated-learning
   pip install -r requirements.txt
   cd ../ml-model
   pip install -r requirements.txt
   ```

3. **Environment variables** (optional)
   Create `.env` files in server/ and federated-learning/:
   ```
   # server/.env
   PORT=3001
   FL_SERVER_ADDRESS=localhost:8080
   ML_API=http://localhost:5000
   
   # federated-learning/.env
   FL_PORT=8080
   FL_ROUNDS=5
   FL_MIN_CLIENTS=1
   ```

## Running the System

### Option 1: Electron Desktop App (Recommended)
Single executable that handles everything:
```bash
# Windows
start-desktop.bat

# Linux/macOS
./start-desktop.sh
```

### Option 2: Development Mode (All Services Separate)
```bash
# Windows
start-dev.bat

# Linux/macOS
./start-dev.sh
```

This starts:
- React frontend on http://localhost:3000
- Node backend on http://localhost:3001
- Python ML server on http://localhost:5000
- Flower FL server on localhost:8080

### Option 3: Command Line Training Control
```bash
# Start global training (5 rounds, 3 clients, non-IID)
python federated-learning/training_orchestrator.py --mode global --rounds 5 --clients 3

# Start local training (single client, 1 epoch)
python federated-learning/training_orchestrator.py --mode local --epochs 1

# Auto-trigger monitoring (train when 20+ new images)
python federated-learning/training_orchestrator.py --mode monitor --threshold 20

# View analytics
python federated-learning/training_orchestrator.py --mode analytics
```

## API Endpoints

All endpoints require JWT authentication in header:
```
Authorization: Bearer <token>
```

### Federated Learning Endpoints
- `POST /api/federated-learning/train-global`
- `POST /api/federated-learning/train-local`
- `GET /api/federated-learning/{trainingId}/status`
- `GET /api/federated-learning/analytics`

**See FL_API_INTEGRATION.md for detailed endpoint documentation and React examples**

## Data Flow

### Global Training Round
```
1. User clicks "Train Global Model" → Frontend requests server
2. Server spawns Flower FL server on :8080
3. Server spawns N client simulators
4. Each client:
   - Connects to Flower server
   - Loads global model
   - Trains on local data (subset of dataset)
   - Sends weights back
5. Server aggregates weights (FedAvg)
6. New global model saved
7. Round completes
```

### Local Training
```
1. User clicks "Train Locally"
2. Server spawns single client trainer
3. Client trains on user's uploaded data
4. Sends weights to server
5. Server updates global model
6. No aggregation needed (single client)
```

### Auto-Trigger Monitoring
```
1. Background process monitors image database
2. Tracks unused_for_training = false images
3. When count >= threshold (default 20):
   - Triggers global training automatically
   - Marks images as used_for_training = true
4. Continues monitoring
```

## Database Schema

### Image Metadata (SQLite)
```sql
CREATE TABLE image_metadata (
  id INTEGER PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  hash TEXT UNIQUE,           -- MD5 for deduplication
  path TEXT,
  label INTEGER,              -- Class ID (0-6)
  used_for_training BOOLEAN,  -- true after used in FL round
  client_id INTEGER,
  training_round INTEGER,
  timestamp DATETIME
)
```

### FL Training Records (MongoDB)
```javascript
{
  roundNumber: Number,
  status: String,             // initiated, in-progress, completed, failed
  globalModelVersion: String,
  globalWeightsUrl: String,
  totalClients: Number,
  participatingClients: Number,
  roundStartTime: Date,
  roundEndTime: Date,
  roundDuration: Number       // seconds
}
```

## Configuration

### FL Server Settings
Environment variables in federated-learning/:
```bash
FL_PORT=8080                  # Server port
FL_ROUNDS=5                   # Number of training rounds
FL_MIN_CLIENTS=1              # Minimum clients to start
FL_FRACTION_FIT=1.0          # Fraction of clients to train
FL_FRACTION_EVAL=1.0         # Fraction for evaluation
```

### Client Simulator Settings
In client_simulator.py:
```python
simulator = ClientSimulator(
    num_clients=3,             # Number of simulated clients
    iid=False,                # Non-IID data distribution
    alpha=0.1                 # Dirichlet parameter (lower = more heterogeneous)
)
```

## Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :8080
kill -9 <PID>
```

### Python Import Errors
```bash
# Ensure deps installed
cd federated-learning
pip install --upgrade -r requirements.txt
```

### Electron App Won't Start
```bash
# Clear cache and reinstall
rm -rf desktop-app/node_modules
cd desktop-app && npm install
npm start
```

### Frontend Can't Reach Backend
- Check backend is running on :3001
- Verify CORS settings in server.js
- Check Authorization token is valid

## Performance Tuning

### Federated Rounds
- Fewer rounds = faster but potentially worse accuracy
- More rounds = better accuracy, longer training time
- Typical: 5-10 rounds per global training session

### Local Training Epochs
- 1 epoch = fast, good for non-IID data
- 2-3 epochs = better local accuracy
- More = risk of overfitting to local data

### Number of Clients
- More clients = better model diversity
- Fewer clients = faster aggregation
- Optimal typically 3-10 clients

### Data Distribution
- IID mode: uniform class distribution per client
- Non-IID (alpha=0.1): highly heterogeneous, realistic
- Non-IID (alpha=1.0): less heterogeneous

## Next Steps

1. **Frontend Integration**: Connect React buttons to FL endpoints
2. **Model Selection**: Replace dummy model with actual EfficientNet
3. **Data Loading**: Implement real image loading from uploads
4. **Monitoring Dashboard**: Add real-time training progress display
5. **Deployment**: Build and deploy Electron app to users

## File Structure Reference
```
.
├── client/               (React frontend)
├── server/              (Node.js backend)
│   ├── controllers/
│   │   └── federatedLearningController.js  ← FL training logic
│   └── routes/
│       └── federatedLearningRoutes.js       ← FL endpoints
├── ml-model/           (EfficientNet model)
├── federated-learning/ (Python FL system)
│   ├── fl_server.py    (Flower server)
│   ├── fl_client.py    (Flower client)
│   ├── client_simulator.py  (Data distribution)
│   └── training_orchestrator.py  (Automation)
├── desktop-app/        (Electron wrapper)
│   ├── main.js        (Main process)
│   └── preload.js     (IPC bridge)
├── start-dev.sh/bat    (Start all services)
└── start-desktop.sh/bat (Start Electron)
```

## Security Notes

1. **Never send raw images to FL server** - Only weights are transmitted
2. **JWT tokens required** for all API calls
3. **Preload.js restricts** IPC to safe methods only
4. **Data hashing** prevents duplicate training on same image
5. **Model weights encrypted** in transit (HTTPS in production)

## Additional Resources

- Flower Documentation: https://flower.ai
- PyTorch: https://pytorch.org
- Electron: https://electronjs.org
- Express.js: https://expressjs.com
