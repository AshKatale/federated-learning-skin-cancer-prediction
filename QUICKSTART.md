# Quick Start Checklist

## ✓ Installation & Setup

### 1. Prerequisites Check
- [ ] Node.js 16+ installed
- [ ] Python 3.8+ installed
- [ ] pip package manager working
- [ ] npm package manager working

### 2. Install Dependencies
```bash
# Node dependencies
cd client && npm install
cd ../server && npm install
cd ../desktop-app && npm install

# Python dependencies
cd federated-learning
pip install -r requirements.txt
cd ../ml-model
pip install -r requirements.txt
```

### 3. Environment Setup (Optional)
Create `.env` files if needed (use defaults otherwise):
```bash
# server/.env
PORT=3001
FL_SERVER_ADDRESS=localhost:8080

# federated-learning/.env
FL_PORT=8080
FL_ROUNDS=5
```

---

## 🚀 Running the System

### Quick Start (Recommended)
```bash
# Windows
start-desktop.bat

# Linux/macOS
./start-desktop.sh
```
This launches a single Electron window that manages all services.

### Development Mode
```bash
# Windows
start-dev.bat

# Linux/macOS
./start-dev.sh
```
Starts all services in separate windows/terminals.

### Manual Service Startup
```bash
# Terminal 1: Node Backend
cd server
npm start

# Terminal 2: Python ML Server
cd ml-model
python app.py

# Terminal 3: Flower FL Server
cd federated-learning
python fl_server.py

# Terminal 4: React Frontend
cd client
npm start
```

---

## 🧪 Verify Installation

```bash
# Test all components
python test_system.py
```

Expected output: All tests should PASS

---

## 💻 Using the System

### From React Frontend
Navigate to http://localhost:3000 and click:
- "Train Global Model" button → Triggers global FL training
- "Train Locally" button → Triggers local training

### From Command Line
```bash
# Global training (5 rounds, 3 clients)
python federated-learning/training_orchestrator.py --mode global --rounds 5 --clients 3

# Local training (single client, 1 epoch)
python federated-learning/training_orchestrator.py --mode local --epochs 1

# Auto-trigger monitoring (trains when 20+ new images)
python federated-learning/training_orchestrator.py --mode monitor --threshold 20

# View analytics
python federated-learning/training_orchestrator.py --mode analytics
```

### From REST API
```bash
# Global training (with auth token)
curl -X POST http://localhost:3001/api/federated-learning/train-global \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"numRounds":5,"numClients":3,"iid":false}'

# Local training
curl -X POST http://localhost:3001/api/federated-learning/train-local \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"user1","epochs":1}'

# Check status
curl http://localhost:3001/api/federated-learning/TRAINING_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get analytics
curl http://localhost:3001/api/federated-learning/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📋 Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/federated-learning/train-global` | POST | Start global FL training |
| `/api/federated-learning/train-local` | POST | Start local training |
| `/api/federated-learning/{id}/status` | GET | Check training status |
| `/api/federated-learning/analytics` | GET | Get FL analytics |

---

## 🔧 Configuration

### Federated Learning
Edit `federated-learning/fl_server.py`:
```python
FL_PORT = 8080                          # Change port
NUM_ROUNDS = 5                          # Global rounds
MIN_CLIENTS = 1                         # Min clients per round
```

### Client Simulator
Edit `federated-learning/client_simulator.py`:
```python
simulator = ClientSimulator(
    num_clients=3,                      # Number of clients
    iid=False,                          # IID vs non-IID
    alpha=0.1                           # Data heterogeneity
)
```

### Training Orchestrator
```bash
# Auto-trigger with 20 new images threshold
python training_orchestrator.py --mode monitor --threshold 20

# Custom client count and non-IID distribution
python training_orchestrator.py --mode global --clients 5 --iid
```

---

## ❌ Troubleshooting

### Port Already in Use
```bash
# Find process using port
Windows: netstat -ano | findstr :8080
Linux/Mac: lsof -i :8080

# Kill process
Windows: taskkill /PID <PID> /F
Linux/Mac: kill -9 <PID>
```

### Module Not Found Errors
```bash
# Reinstall Python dependencies
cd federated-learning
pip install --upgrade -r requirements.txt
```

### Backend Won't Start
```bash
# Check database connection
# Ensure MongoDB is running (for training records)
# Check PORT 3001 is available
```

### Frontend Can't Reach Backend
- Verify backend running on :3001
- Check Authorization header in requests
- Confirm CORS is enabled in server.js
- Check network requests in browser DevTools

---

## 📚 Documentation Files

- **FEDERATED_LEARNING_SETUP.md** - Complete system overview and architecture
- **FL_API_INTEGRATION.md** - REST API endpoints and React examples
- **test_system.py** - Verification script to test all components

---

## 🎯 Common Tasks

### Start Global Training Session
```bash
python federated-learning/training_orchestrator.py --mode global
```
Then poll status:
```bash
curl http://localhost:3001/api/federated-learning/analytics
```

### Monitor Auto-Training
```bash
python federated-learning/training_orchestrator.py --mode monitor --threshold 20
```
Add new images, system automatically trains when threshold is reached.

### Build Desktop App
```bash
cd desktop-app
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
```

### View Training Analytics
```bash
python federated-learning/training_orchestrator.py --mode analytics
```

---

## 📁 Important Directories

```
project-root/
├── client/                   React frontend
├── server/                   Node.js backend
├── ml-model/                 ML model code
├── federated-learning/       FL system
│   ├── fl_server.py         Flower server
│   ├── fl_client.py         FL client
│   ├── client_simulator.py  Data simulator
│   └── training_orchestrator.py  Automation
├── desktop-app/             Electron app
│   ├── main.js
│   └── preload.js
└── [startup scripts]
```

---

## 🔐 Security Reminders

1. Always use JWT tokens for API calls
2. Never expose model weights in logs
3. Images never sent to FL server (only weights)
4. Use HTTPS in production
5. Validate all user inputs on backend

---

## 💡 Tips

- **Development**: Use separate terminal windows for each service
- **Production**: Use Electron app for easier deployment
- **Testing**: Use `test_system.py` to verify setup
- **Monitoring**: Check `/api/federated-learning/analytics` for metrics
- **Automation**: Use `training_orchestrator.py` in monitor mode

---

## 🤝 Support

For issues, check:
1. Ports are available (3000, 3001, 5000, 8080)
2. All dependencies installed
3. Python version >= 3.8
4. Node version >= 16
5. See FEDERATED_LEARNING_SETUP.md for detailed troubleshooting
