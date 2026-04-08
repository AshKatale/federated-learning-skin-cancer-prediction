# Comprehensive System Architecture Prompt for AI-Generated Documentation

## TASK INSTRUCTION
Generate a complete system architecture document that explains all components, modules, data flows, technologies, deployments, and integrations for a **Federated Learning-based Skin Cancer Detection System**. Include detailed diagrams, code examples, and implementation guidelines.

---

# COMPLETE SYSTEM OVERVIEW

## Project: Federated Learning Skin Cancer Prediction System

### Mission
A **privacy-preserving machine learning system** that enables multiple hospitals/clinics to collaboratively train a CNN model for melanoma and skin cancer detection WITHOUT sharing patient data or medical images. The system uses Federated Learning (FedAvg & FedProx algorithms) to aggregate model updates while keeping raw data localized.

### Key Innovation
- **Privacy-First**: Patient images stay at local facilities; only model weights are shared
- **Decentralized Training**: Each hospital trains independently on its dataset
- **Collaborative Learning**: All participants benefit from aggregated intelligence
- **Real-Time Inference**: Web/desktop interfaces for doctors to make predictions

---

# ARCHITECTURAL COMPONENTS (5 MAJOR MODULES)

## MODULE 1: WEB FRONTEND (React/Vite)
**Location**: `client/src/`  
**Technology**: React 18+, Vite, Tailwind CSS, Axios  
**Port**: 3000 (dev), 3001 (served by Express)

### Responsibilities
- User authentication (login/signup)
- Image upload and single/batch predictions
- Real-time prediction history and analytics
- Model information and training round tracking
- Role-based dashboards (admin, doctor, patient)
- Federated learning monitoring (client FL dashboard)

### Components & File Structure
```
client/src/
├── pages/
│   ├── Login.jsx              # Authentication entry point
│   ├── SignUp.jsx             # User registration
│   ├── Dashboard.jsx          # Main prediction interface
│   ├── PredictionHistory.jsx  # View past predictions
│   ├── AdminDashboard.jsx     # System administration
│   ├── FLDashboard.jsx        # Federated learning monitoring
│   └── ProfilePage.jsx        # User profile management
├── components/
│   ├── AppShell.jsx           # Main app layout wrapper
│   ├── ImageUploader.jsx      # Image upload component
│   ├── BatchPredictor.jsx     # Multi-image batch processing
│   ├── PredictionResults.jsx  # Display results with AI analysis
│   ├── ModelInfo.jsx          # Show model metadata
│   ├── FLControlPanel.jsx     # FL client controls & monitoring
│   └── ProtectedRoute.jsx     # Authentication guard
├── context/
│   └── FLContext.jsx          # Global FL state management
├── services/
│   └── api.js                 # Axios wrapper for backend API calls
└── App.jsx                    # Root component with routing
```

### Key Features
1. **Authentication** - JWT-based login/signup with role assignment
2. **Prediction Interface** - Upload images → get predictions with confidence scores
3. **Batch Processing** - Process multiple images, export results as CSV
4. **Results Display** - Show predictions, confidence, class probabilities, risk levels
5. **AI-Powered Analysis** - Gemini API integration for diagnosis explanations
6. **History Tracking** - Filter, sort, and analyze past predictions
7. **FL Monitoring** - Display training round, local/global model status
8. **Admin Controls** - Manage users, view aggregated metrics, approve model updates

### API Consumption
- Calls `http://localhost:3001/api/*` endpoints (Express backend)
- JWT token in every request header
- Handles image uploads as multipart/form-data
- Receives JSON responses with predictions and metadata

### User Flows
1. **Prediction Flow**: Login → Upload Image → Submit → Get Result with Confidence
2. **FL Monitoring Flow**: View Model Round → Check Latest Accuracy → Monitor Client Status
3. **History Flow**: Filter by Date/Risk Level → Sort by Confidence → View Trends

---

## MODULE 2: EXPRESS.JS BACKEND SERVER
**Location**: `server/`  
**Technology**: Node.js 18+, Express.js, MongoDB, PostgreSQL, Multer, JWT  
**Port**: 3001  
**Key File**: `server/server.js`

### Responsibilities
- User authentication (register, login, logout)
- Prediction management (store, retrieve, analyze)
- Database operations and queries
- Integration with ML services (Flask API and FL Server)
- File upload handling
- Request validation and error handling
- CORS configuration for frontend/desktop app
- Role-based access control

### Architecture Overview
```
Express Server (3001)
│
├─ Middleware Stack
│  ├── CORS configuration
│  ├── Body parser (50MB limit)
│  ├── Morgan logging
│  ├── Static file serving (from client/dist)
│  └── JWT extraction/validation
│
├─ Route Handlers (AuthRoutes)
│  ├── POST /api/auth/register
│  ├── POST /api/auth/login
│  ├── POST /api/auth/logout
│  └── GET  /api/auth/profile
│
├─ Route Handlers (PredictionRoutes)
│  ├── POST /api/predictions/predict       (single image)
│  ├── POST /api/predictions/batch         (multiple images)
│  ├── GET  /api/predictions/history       (user's past predictions)
│  ├── GET  /api/predictions/:id           (single prediction details)
│  └── DELETE /api/predictions/:id         (delete prediction)
│
├─ Route Handlers (FederatedLearningRoutes)
│  ├── GET  /api/fl/status                 (current round info)
│  ├── POST /api/fl/start-round            (initiate training round)
│  ├── GET  /api/fl/model/latest           (latest global model info)
│  ├── GET  /api/fl/metrics                (aggregated FL metrics)
│  └── POST /api/fl/register-client        (register new FL client)
│
├─ Route Handlers (MLRoutes)
│  ├── POST /api/ml/inference              (call Flask ML API)
│  ├── GET  /api/ml/model-info             (model metadata)
│  └── POST /api/ml/analyze                (Gemini AI analysis)
│
├─ Database Connections
│  ├─ MongoDB (User profiles, predictions, predictions history)
│  └─ PostgreSQL (Audit logs, federated learning metrics)
│
└─ External Service Integrations
   ├─ Flask ML API (http://localhost:5001)
   ├─ Flask FL Client API (http://localhost:6000)
   ├─ Gemini AI API (for diagnosis explanations)
   └─ File system (uploads/ directory)
```

### Controller Files
```
server/controllers/
├── authController.js              # Register, login, logout, profile
├── predictionController.js        # Predictions CRUD, inference calls
├── federatedLearningController.js # FL round management
└── mlController.js                # ML API wrapper, Gemini integration
```

### Models (MongoDB/PostgreSQL Schemas)
```
server/models/
├── User.js                  # User accounts, authentication
├── Prediction.js            # Individual prediction records
├── FederatedLearning.js     # FL round tracking, client status
└── MLModel.js               # Model version tracking
```

### Key Data Flows
1. **Login Flow**: Email/Password → Verify → Generate JWT → Return Token + User
2. **Prediction Flow**: Image Upload → Multer validation → Call Flask ML API → Store in MongoDB → Return result
3. **FL Integration**: Dashboard → Query FL Server → Fetch Model Info → Display Status
4. **Batch Processing**: Multiple Images → Queue management → Call ML API per image → Aggregate results

### Database Schema Summary

**MongoDB Collections**:
- `users` - { _id, email, password (hashed), firstName, lastName, role, organization }
- `predictions` - { _id, userId, imagePath, prediction, confidence, allProbabilities, timestamp }

**PostgreSQL Tables**:
- `audit_logs` - { id, action, userId, timestamp, details }
- `fl_rounds` - { id, roundNumber, startTime, endTime, aggregationType, modelVersion }
- `fl_metrics` - { id, roundId, clientId, accuracy, loss, epoch, timestamp }

---

## MODULE 3: FEDERATED LEARNING SERVER
**Location**: `fl-server/` and `desktop-app/fl_client/`  
**Technology**: Flask, PyTorch, Flower Framework, gRPC  
**Port**: 6000 (FL HTTP API), 8080 (Flower gRPC server)  

### High-Level FL Architecture
```
FL Coordinator (Central)
    │ gRPC (bi-directional)
    ├─────────────────────────┬──────────────────────┬──────────────────
    │                         │                      │
[Client 1 - Hospital A]   [Client 2 - Hospital B]  [Client N]
(Desktop App)            (Desktop App)             (Docker Container)
├─ Local Dataset         ├─ Local Dataset         ├─ Local Dataset
├─ Training Loop         ├─ Training Loop         ├─ Training Loop
├─ Weight Upload         ├─ Weight Upload         ├─ Weight Upload
└─ Local Inference       └─ Local Inference       └─ Local Inference
```

### fl-server/app.py - Central Aggregation Service
**Responsibilities**:
- Receive model updates from clients
- Aggregate using FedAvg/FedProx algorithm
- Maintain global model state
- Manage rounds (start, end, deadline)
- Serve latest model to clients
- Track metrics per round
- Provide REST API for Express to query

**Key Classes & Functions**:
```
RoundManager
├── current_round()              # Get active round number
├── current_round_deadline()     # Get round end timestamp
├── advance_round()              # Move to next round
├── save_global_model()          # Persist aggregated model
└── latest_model_path()          # Get latest saved model

FedAvgAggregator
├── fedavg()                     # Standard averaging
├── fedprox(updates, mu=0.01)    # Federated proximal method
└── compute_metrics()            # Calculate aggregated metrics

SkinCancerModel
├── load_weights()               # Load from .pt file
├── get_state_dict()             # Export weights as dict
├── set_state_dict()             # Import aggregated weights
└── forward()                    # Inference (EfficientNet-B0)
```

**REST API Endpoints** (served by Flask):
```
GET  /api/model/latest              # Returns: { model_version, round_number, timestamp }
POST /api/model/save                # Upload new global model (from aggregator)
GET  /api/round/status              # Returns: { current_round, deadline, clients_active }
POST /api/client/update             # Clients POST their trained weights here
GET  /api/metrics/{round}           # Returns: { accuracy, loss, client_count, per_class_metrics }
```

**Background Processes**:
- **Round Loop Thread**: Runs in daemon, aggregates at deadline, advances to next round
- **Heartbeat Tracker**: Monitors which clients submitted updates
- **Model Persistence**: Auto-saves aggregated models to `models/global/`

**Algorithms**:
```
FedAvg Aggregation:
  w_new = (1/n) * Σ(w_client_i)
  
FedProx Aggregation:
  L_fedprox = L_original + (μ/2) * ||w - w_global||²
  w_new = FedAvg(w_client_i) + (μ/2) * proximal_term
  Best for heterogeneous (non-IID) data
  μ default: 0.01
```

### desktop-app/fl_client/ - Local Client Service
**Location**: `desktop-app/fl_client/`  
**Technology**: PyTorch, Flask, Requests  
**Files**:
```
fl_client/
├── client.py              # Main FL client service (Flask API)
├── trainer.py             # Local training loop for federated rounds
├── training_runner.py     # Orchestrates training execution
├── inference_runner.py    # Local inference for predictions
├── scheduler.py           # Training schedule management
├── model.py               # EfficientNet-B0 model wrapper
├── convert_model.py       # Model format conversion (Torch ↔ TF)
├── evaluate_model.py      # Test accuracy evaluation
├── gemini_analyzer.py     # AI-powered result analysis
└── local_weights/         # Cached models & training checkpoints
    ├── global_model_round_*.pth
    ├── client_*_trained.pt
    └── best_skin_cancer_model.pth
```

**client.py - Flask API for Desktop**:
```
GET  /api/model/latest              # Download global model from server
POST /api/train                     # Start local training
GET  /api/train/status              # Check training progress
POST /api/inference                 # Run prediction on single image
POST /api/upload_weights            # Send trained weights to server
```

**Workflow: FL Client Training Round**:
1. Check FL server for new round: `GET /api/round/status`
2. Download latest global model: `GET /api/model/latest`
3. Load local dataset from disk (never sent to server)
4. Train for N epochs with FedProx regularization
5. Compute weight delta: `trained_weights - downloaded_weights`
6. Upload only delta to server: `POST /api/upload_weights`
7. Server aggregates all client deltas → new global model
8. Next round begins, repeat from step 1

**Key Classes in trainer.py**:
```
LocalTrainer
├── load_data()              # Load images from LOCAL_DATA_DIR
├── train_epoch()            # Single training epoch with fedprox
├── compute_weights_delta()  # w_trained - w_global
├── evaluate_on_local_test() # Accuracy on local test set
└── get_metrics()            # Return train/val loss and accuracy
```

---

## MODULE 4: DESKTOP APPLICATION (ELECTRON)
**Location**: `desktop-app/`  
**Technology**: Electron, React (IPC bridge), Node.js, Python subprocess  
**Files**:
```
desktop-app/
├── main.js              # Electron main process (Node.js)
├── preload.js           # IPC context bridge
├── package.json         # Dependencies + scripts
├── README.md            # Setup documentation
├── install_cuda_pytorch.py  # GPU setup helper
└── fl_client/           # Python federated learning client
```

### Architecture: IPC-based Communication
```
User Interface (React)
    │ window.electronAPI.*() [IPC calls]
    ▼
preload.js (ContextBridge)
    │ ipcRenderer.invoke(channel, args)
    ▼
main.js (Electron Main - Node.js)
    │ spawn(pythonScript, args)
    ▼
Python: training_runner.py / inference_runner.py / evaluate_model.py
    │ subprocess.run() / torch training loops
    ▼
PyTorch / ML Operations (possibly GPU)
```

### main.js - Process Manager
**Responsibilities**:
- Start/stop backend Express server
- Start/stop Flask FL client service
- Spawn Python training processes
- Handle file dialogs (select model, datasets)
- Stream subprocess output to renderer

**Key IPC Handlers**:
```javascript
ipcMain.handle('train-fl', async (event, args) => {
  // args: { epochs: 5, learningRate: 0.01, dataset: '/path/to/data' }
  // Spawns: Python training_runner.py with args
  // Streams output back via ipcMain.send('training-log', logLine)
});

ipcMain.handle('run-inference', async (event, { imagePath, modelPath }) => {
  // Spawns: Python inference_runner.py
  // Returns: { prediction, confidence, allProbabilities }
});

ipcMain.handle('evaluate-model', async (event, { testDir, modelPath }) => {
  // Spawns: Python evaluate_model.py
  // Returns: { overall_accuracy, per_class_metrics, confusion_matrix }
});

ipcMain.handle('analyze-prediction', async (event, { predictedClass, confidence, allProbabilities }) => {
  // Calls Gemini API for AI analysis
  // Returns: { diagnosis, risk_level, recommendations }
});
```

### preload.js - IPC Bridge
**Exposes to React**:
```javascript
window.electronAPI.trainFL(options)
window.electronAPI.runInference(imagePath, modelPath)
window.electronAPI.evaluateModel(testDir, modelPath)
window.electronAPI.analyzePrediction(result)
window.electronAPI.onTrainingLog((logLine) => {...})
window.electronAPI.onEvaluationLog((logLine) => {...})
window.electronAPI.selectFile(dialogOptions)
window.electronAPI.selectFolder(dialogOptions)
```

### Key UI Components (in client/src/)
1. **FLControlPanel.jsx**
   - Tabs: Training, Monitoring, Evaluation
   - Start/stop local training
   - Upload weights to server
   - Run model evaluation
   - Display training logs in real-time

2. **BatchPredictor.jsx**
   - Bulk upload images
   - Run batch inference
   - Export results CSV

3. **PredictionResults.jsx**
   - Show prediction + confidence
   - Display Grad-CAM heatmap
   - Show Gemini AI analysis
   - Risk level and recommendations

### Startup Flow (npm start)
```
main.js loads
├─ Start Express server (3001)
├─ Start Flask FL client (6000)
├─ Create Electron window
└─ Load React UI (from dist/ or localhost:3000)
    └─ React connects to Express via API calls
    └─ React calls Python via IPC handlers
```

---

## MODULE 5: MACHINE LEARNING SERVICE (FLASK API)
**Location**: `ml-model/` and `desktop-app/fl_client/`  
**Technology**: Flask, PyTorch, torchvision, PIL, Grad-CAM  
**Port**: 5001 (for Express) / 6000 (for desktop)

### ml-model/app.py - Standalone ML Server
**Responsibilities**:
- Load pre-trained EfficientNet-B0 model
- Accept image uploads
- Run inference
- Generate Grad-CAM visualizations
- Return predictions with class probabilities
- Support batch predictions

**REST API Endpoints**:
```
POST /predict
  Input: { image: base64 or file upload }
  Returns: {
    prediction: "mel",
    confidence: 0.92,
    class_probabilities: {
      mel: 0.92, bcc: 0.05, nv: 0.02, ...
    },
    grad_cam: base64_heatmap,
    processing_time_ms: 245
  }

POST /batch-predict
  Input: { images: [image1, image2, ...] }
  Returns: [ {...}, {...}, ... ]

GET /model-info
  Returns: {
    model_name: "EfficientNet-B0",
    classes: ["Melanoma", "BCC", ...],
    input_size: [224, 224],
    device: "cuda" or "cpu"
  }

POST /analyze
  Input: { predicted_class: "mel", confidence: 0.92, ... }
  Calls: Gemini API
  Returns: { diagnosis, risk_level, recommendations, ... }
```

### Model Details: EfficientNet-B0
```
Architecture: EfficientNet-B0 (pre-trained on ImageNet)
Backbone: Mobile-efficient CNN (5.3M parameters)
Input: 224×224 RGB images
Output: 7 classes (skin cancer types)
  - mel:   Melanoma (most dangerous)
  - bcc:   Basal Cell Carcinoma
  - akiec: Actinic Keratosis
  - bkl:   Benign Keratosis
  - df:    Dermatofibroma
  - nv:    Nevus (normal mole)
  - vasc:  Vascular lesion

Fine-tuning: Trained on HAM10000 dataset (10,015 images)
Activation: Last layer softmax for 7 classes
Grad-CAM: Uses Laplacian edge detection or feature gradients
```

### Inference Pipeline
```
Input Image (JPEG/PNG)
    │
    ├─ Preprocess
    │   ├─ Resize to 224×224
    │   ├─ Normalize (ImageNet stats)
    │   └─ Convert to tensor
    │
    ├─ Forward Pass (EfficientNet-B0)
    │   ├─ Backbone feature extraction
    │   ├─ Global average pooling
    │   └─ Classification head (7 outputs)
    │
    ├─ Post-process
    │   ├─ Apply softmax → probabilities
    │   ├─ Get argmax → predicted class
    │   ├─ Get confidence → max probability
    │   └─ Generate Grad-CAM heatmap
    │
    └─ Return JSON
        {
          prediction: string,
          confidence: float 0-1,
          class_probabilities: dict,
          grad_cam: base64_image,
          timestamp: ISO8601
        }
```

### Grad-CAM Implementation
```
Purpose: Visual explanation of model prediction
Method: Laplacian edge detection or gradient-based attention

Algorithm:
1. Extract feature maps from penultimate layer
2. Compute gradients of output w.r.t. feature maps
3. Weight features by gradients
4. Sum weighted features → attention map
5. Normalize to 0-255 range
6. Apply colormap (Red = high attention)
7. Overlay on original image
```

---

## COMPLETE DATA FLOW DIAGRAMS

### Flow 1: User Prediction (Web App)
```
User (Browser)
  │
  ├─ 1. Login
  │     POST /api/auth/login
  │     ↓
  │ Express validates credentials
  │     ↓
  │ Returns JWT token
  │     ↓
  │ Store in localStorage
  │
  ├─ 2. Upload Image
  │     POST /api/predictions/predict
  │     Headers: Authorization: Bearer JWT
  │     Body: { image: FormData }
  │     ↓
  │ Express multer saves file to uploads/
  │     ↓
  │ Express calls Flask: POST http://localhost:5001/predict
  │     ↓
  │ Flask EfficientNet-B0 → prediction + confidence
  │     ↓
  │ Express stores in MongoDB prediction record
  │     ↓
  │ Optional: Call Gemini API for analysis
  │     ↓
  │ Return JSON to frontend
  │     ↓
  │ React displays result + Grad-CAM + risk level
  │
  └─ 3. View History
        GET /api/predictions/history
        ↓
     Express queries MongoDB
        ↓
     Return sorted predictions with timestamps
```

### Flow 2: Federated Learning Round
```
FL Server (3001) checks deadline
  │
  ├─ ROUND START
  │   └─ Increment round number
  │   └─ Set new deadline (+24h)
  │
  ├─ CLIENT [Hospital A] starts training
  │   │
  │   ├─ Desktop app checks: GET /api/round/status
  │   │   ↓ Learn round #5 active
  │   │
  │   ├─ Download model: GET /api/model/latest
  │   │   ↓ Receive global_model_round_5.pt
  │   │
  │   ├─ Train locally (24h window)
  │   │   ├─ Load local_data/images (private, never sent)
  │   │   ├─ Initialize model with global weights
  │   │   ├─ Forward pass → loss
  │   │   ├─ Apply FedProx term: L += (μ/2)*||w - w_global||²
  │   │   ├─ Backward pass & gradient update
  │   │   └─ Save as client_hospital_a_trained.pt after 5 epochs
  │   │
  │   └─ Upload ONLY weights (not images!): POST /api/client/update
  │       {
  │         client_id: "hospital_a",
  │         round: 5,
  │         weights: {
  │           "layer1.weight": [...],
  │           "layer1.bias": [...],
  │           ...
  │         },
  │         metrics: { local_accuracy: 0.82, local_loss: 0.45 }
  │       }
  │
  ├─ CLIENT [Hospital B, C, ...] similar flow (parallel)
  │
  ├─ ROUND END (24h deadline reached)
  │   │
  │   ├─ Collect all client uploads from round 5
  │   ├─ Run FedProx aggregation:
  │   │   w_global_new = FedProx([w_a, w_b, w_c, ...], μ=0.01)
  │   │
  │   ├─ Save as models/global/global_model_round_6.pt
  │   │
  │   ├─ Log metrics to PostgreSQL:
  │   │   fl_metrics { round: 5, client_count: 3, avg_accuracy: 0.805, timestamp: ... }
  │   │
  │   └─ Advance round counter to 6
  │
  └─ Express server can query: GET /api/fl/metrics/5
      └─ Returns aggregated round metrics
```

### Flow 3: Desktop Training with Electron IPC
```
React Component (FLControlPanel.jsx)
  │ User clicks "Start Training"
  │
  ├─ window.electronAPI.trainFL({
  │     epochs: 5,
  │     learningRate: 0.01,
  │     localDataDir: 'D:/Skin Cancer Dataset'
  │   })
  │
  ├─ main.js receives 'train-fl' ipc message
  │   │
  │   └─ spawn('python', ['fl_client/training_runner.py', ...args])
  │       │
  │       └─ training_runner.py executes:
  │           │
  │           ├─ Download global model from FL server
  │           ├─ Load local images (HAM10000_metadata.csv)
  │           ├─ Initialize trainer with FedProx=0.01
  │           ├─ For each epoch:
  │           │   ├─ For each batch:
  │           │   │   ├─ Forward pass → loss
  │           │   │   ├─ Loss += (0.01/2) * ||w - w_global||²
  │           │   │   ├─ Backward, update weights
  │           │   │   └─ Log progress: "Epoch 1/5 [45%] loss=0.234"
  │           │   │
  │           │   └─ Validate on test set
  │           │
  │           ├─ Save trained weights locally
  │           ├─ Compute delta: trained_w - global_w
  │           └─ Print results (captured by main.js)
  │
  ├─ main.js captures stdout
  │   └─ For each line: ipcMain.send('training-log', logLine)
  │       └─ Sent to React renderer
  │
  ├─ React receives on 'training-log' event
  │   └─ setState({ logs: [...] })
  │   └─ UI updates with live progress
  │
  └─ training_runner.py ends
      └─ main.js calls: POST /api/client/update
          └─ Submit trained weights to FL server
```

---

# DATABASE SCHEMAS

## MongoDB (User Data, Predictions)

### Collections

**users**
```json
{
  "_id": ObjectId,
  "email": "doctor@hospital.com",
  "password": "bcrypt_hash",
  "firstName": "John",
  "lastName": "Doe",
  "age": 45,
  "gender": "M",
  "role": "doctor|admin|patient",
  "organization": "Mayo Clinic",
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

**predictions**
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "imageFilename": "upload_abc123.jpg",
  "imagePath": "/uploads/upload_abc123.jpg",
  "prediction": "mel",
  "confidence": 0.92,
  "classIndex": 0,
  "classNames": ["Melanoma", "BCC", "..."],
  "classProbabilities": {
    "mel": 0.92,
    "bcc": 0.05,
    "akiec": 0.01,
    "bkl": 0.01,
    "df": 0.005,
    "nv": 0.005,
    "vasc": 0.005
  },
  "gradCAMBase64": "data:image/png;base64,...",
  "timestamp": ISODate,
  "riskLevel": "high|medium|low",
  "geminiAnalysis": {
    "diagnosis": "Melanoma detected with high confidence",
    "characteristics": ["Asymmetrical", "..."],
    "recommendations": ["URGENT: Consult dermatologist", "..."],
    "nextSteps": "This requires immediate medical evaluation"
  }
}
```

## PostgreSQL (Audit, FL Metrics)

**audit_logs**
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50),           -- login, upload, training_started, etc.
  userId UUID REFERENCES users,
  timestamp TIMESTAMP DEFAULT NOW(),
  details TEXT,
  SUCCESS BOOLEAN
);
```

**fl_rounds**
```sql
CREATE TABLE fl_rounds (
  id SERIAL PRIMARY KEY,
  roundNumber INT UNIQUE,
  startTime TIMESTAMP,
  endTime TIMESTAMP,
  aggregationType VARCHAR(20),  -- FedAvg, FedProx
  mu FLOAT,                     -- FedProx regularization param
  modelVersion VARCHAR(100),    -- e.g. global_model_round_5.pt
  globalAccuracy FLOAT,
  globalLoss FLOAT,
  clientCount INT,
  SUCCESS BOOLEAN
);
```

**fl_metrics**
```sql
CREATE TABLE fl_metrics (
  id SERIAL PRIMARY KEY,
  roundId INT REFERENCES fl_rounds,
  clientId VARCHAR(100),
  accuracy FLOAT,
  loss FLOAT,
  trainingTime INT,             -- seconds
  epochsCompleted INT,
  proximalDistance FLOAT,       -- ||w_client - w_global||
  timestamp TIMESTAMP DEFAULT NOW()
);
```

---

# AUTHENTICATION & AUTHORIZATION

## JWT Token Structure
```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "id": "user_mongo_id",
  "email": "doctor@hospital.com",
  "role": "doctor",
  "iat": 1704067200,
  "exp": 1704153600  // 24 hours
}

Signature: HMAC-SHA256(header.payload, SECRET)
```

## Role-Based Access Control
```
Route Groups:

PUBLIC:
  POST /api/auth/register
  POST /api/auth/login

PROTECTED (any authenticated user):
  GET  /api/predictions/history
  POST /api/predictions/predict
  GET  /api/auth/profile

ADMIN only:
  GET  /api/admin/users
  DELETE /api/admin/users/:id
  GET  /api/fl/metrics

DOCTOR:
  POST /api/predictions/batch
  GET  /api/predictions/trends

Middleware: (protectRoute) verifies JWT, (authorize) checks role
```

---

# DEPLOYMENT ARCHITECTURES

## Development Setup
```
Your Machine (Windows/Mac/Linux)
├─ Express Server (localhost:3001)
├─ React Dev Server (localhost:3000)
├─ Flask ML API (localhost:5001)
├─ Flask FL Client (localhost:6000)
├─ MongoDB Local (localhost:27017)
└─ PostgreSQL Local (localhost:5432)

Used for: Testing, UI dev, debugging
```

## Desktop Production
```
Single Executable: MyApp.exe (Electron)
  ├─ Express Server (bundled, starts automatically)
  ├─ Flask Backend (bundled, starts automatically)
  ├─ React UI (pre-built, loaded from file:// or bundle)
  ├─ Python Runtime (bundled)
  └─ PyTorch Models (bundled)

Used for: Hospital deployments, local training
```

## Web Production
```
Hospital Server (AWS/Azure/GCP)
├─ Nginx (reverse proxy, port 80/443)
├─ Express Server (port 3001, internal)
├─ React SPA (static hosting, port 3000)
├─ Flask ML API (port 5001, internal)
├─ MongoDB Atlas (cloud)
├─ PostgreSQL RDS (cloud)
└─ SSL certificates (Let's Encrypt)

Used for: Multi-user web interface
```

## Federated Learning Deployment
```
Central FL Server (AWS)
├─ Flask app (port 6000)
├─ gRPC server (port 8080)
├─ Model storage (S3/GCS)
└─ PostgreSQL (metrics tracking)
   
Clients (Distributed)
├─ Hospital A: Docker container
├─ Hospital B: Docker container
├─ Hospital C: Electron app (desktop)
└─ Hospital N: Custom implementation

Network: TLS/gRPC between server & clients
```

---

# DEPLOYMENT & INFRASTRUCTURE

## Docker Containerization (Optional)

### desktop-app/Dockerfile (FL Client)
```dockerfile
FROM python:3.10
FROM node:18

# Install PyTorch
RUN pip install torch torchvision
RUN pip install flask pillow requests flwr

# Copy app code
COPY . /app
WORKDIR /app

# Start services
CMD ["npm", "start"]
```

### fl-server/Dockerfile
```dockerfile
FROM python:3.10
RUN pip install flask pytorch flwr

COPY . /app
WORKDIR /app

EXPOSE 6000 8080
CMD ["python", "app.py"]
```

## Environment Variables
```
Development (.env):
  NODE_ENV=development
  MONGO_URI=mongodb://localhost:27017/skin_cancer
  PG_HOST=localhost
  PG_PORT=5432
  FL_SERVER_URL=http://localhost:6000
  ML_API=http://localhost:5001
  GEMINI_API_KEY=your-key

Production (.env.prod):
  NODE_ENV=production
  MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/prod_db
  PG_HOST=prod-pg.aws.rds.amazonaws.com
  FL_SERVER_URL=https://fl-server.example.com
  ML_API=https://ml-api.example.com
  GEMINI_API_KEY=secure-key
```

### Startup Scripts

**start-dev.sh** (local development)
```bash
# Terminal 1
cd client && npm run dev

# Terminal 2
cd server && npm start

# Terminal 3
cd ml-model && python app.py

# Terminal 4
cd fl-server && python app.py

# Terminal 5
cd desktop-app/fl_client && python client.py
```

**start-desktop.sh** (Electron production)
```bash
cd desktop-app
npm run build       # Build React bundle
npm start           # Start Electron
```

---

# KEY FEATURES & ALGORITHMS

## Feature 1: Federated Averaging (FedAvg)
```
Basic algorithm for aggregating client updates

Formula:
  w_t^(k+1) = w_t^k - η * (1/m) * Σ(∇L_i(w_t^k))
  
Where:
  - w_t: global model weights at time t
  - η: learning rate
  - m: number of clients
  - ∇L_i: gradient from client i

Privacy: No raw data shared, only encrypted weight updates
```

## Feature 2: Federated Proximal (FedProx)
```
Enhanced algorithm for heterogeneous (non-IID) data

Local loss function at each client:
  L_fedprox = L_original + (μ/2) * ||w - w_global||²

Benefits:
  - Handles data heterogeneity (different patient populations)
  - More stable convergence
  - Reduces divergence in non-IID settings

μ (mu) tuning:
  μ=0:    Falls back to standard FedAvg
  μ=0.01: Light regularization (most common)
  μ=0.1:  Strong regularization (very heterogeneous data)
```

## Feature 3: Privacy Preservation
```
Techniques:

1. Data Minimization
   - Raw images never leave hospital
   - Only model weights sent to center
   - No image compression/encryption needed

2. Differential Privacy (optional)
   - Add Laplacian noise to weights before upload
   - ε=1.0 provides strong privacy

3. Secure Aggregation (optional)
   - Encrypt weights in transit
   - Server never sees individual updates

4. Audit Logging
   - PostgreSQL tracks: who accessed what, when
   - No image access logs (N/A - images stay local)
```

## Feature 4: Asynchronous Training
```
Clients train on different schedules:
  - No waiting for slowest client
  - Client submits whenever ready
  - Server aggregates at round deadline
  - Handles client churn (dropouts, network failure)
```

---

# INTEGRATION POINTS & API CONTRACTS

## Client ↔ Express Server
```
All requests include JWT header:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Content-Type: 
  application/json (for JSON)
  multipart/form-data (for file uploads)

Error responses:
  { success: false, message: "Error description", error: {...} }

Success responses:
  { success: true, data: {...}, message: "Success" }
```

## Express ↔ Flask ML API
```
Request (from Express):
  POST http://localhost:5001/predict
  Content-Type: multipart/form-data
  Body: { image: File }

Response:
  {
    success: true,
    prediction: "mel",
    confidence: 0.92,
    classIndex: 0,
    classProbabilities: {...},
    processingTime: 245,
    gradCAM: "base64_encoded_image",
    deviceUsed: "cuda" or "cpu"
  }
```

## Express ↔ FL Server
```
Request (from Express):
  GET http://localhost:6000/api/round/status
  
Response:
  {
    currentRound: 5,
    roundDeadline: 1704316800,
    clientsActive: 3,
    aggregationType: "fedprox",
    mu: 0.01
  }

Request (from FL Client):
  POST http://localhost:6000/api/client/update
  Content-Type: application/json
  Body: { clientId, round, weights, metrics }

Response:
  { success: true, message: "Weights received" }
```

## Desktop ↔ Python (IPC)
```
React → Electron Main (IPC invoke):
  channel: 'train-fl'
  args: { epochs: 5, learningRate: 0.01 }

Electron Main → Python (spawn subprocess):
  program: python
  args: ['fl_client/training_runner.py', '--epochs=5', ...]

Python → Electron Main (stdout stream):
  "Epoch 1/5 [25%] loss=0.234"
  
Electron Main → React (IPC send):
  channel: 'training-log'
  data: logLine
```

---

# COMMON USER WORKFLOWS

## Workflow 1: Doctor Making a Prediction
```
1. Doctor logs in with credentials
2. Dashboard loads, showing latest model info
3. Clicks "Upload Image"
4. Selects dermatology photo from file system
5. System auto-processes (resize, normalize)
6. Returns prediction + confidence + Grad-CAM
7. Doctor clicks "AI Analysis" tab
8. Gemini API generates human-readable diagnosis
9. Doctor reviews recommendations
10. Doctor can:
    - Save to patient's file (MongoDB)
    - Export as PDF report
    - Refer patient to specialist
```

## Workflow 2: Hospital Participating in Federated Learning
```
1. Hospital IT installs desktop app
2. Hospital uploads 1000 dermatology images to local folder
3. Doctor/Admin opens app, clicks "FL Training"
4. App checks: "New round available (Round #5)"
5. Downloads latest global model (0.5MB)
6. Trains locally on 1000 images for 5 epochs (2 hours)
   - Images never leave hospital
   - Only weight updates sent (10KB)
7. Uploads to FL server
8. FL server aggregates updates from Hospitals A, B, C, D
9. Returns new global model (Round #6)
10. All hospitals see improved model from collective training

Privacy guarantee: Central server never sees Hospital's images
```

## Workflow 3: System Administrator Monitoring Federated Learning
```
1. Admin logs into web dashboard
2. Navigates to "FL Operations" section
3. Sees:
   - Current round: 5
   - Deadline: 2024-01-10 18:00 UTC
   - Clients active: 3/4 (Hospital D offline)
   - Last aggregation accuracy: 82.5%
4. Clicks on Round 5 metrics
5. Sees per-hospital metrics:
   - Hospital A: 85% accuracy (2 hours training)
   - Hospital B: 80% accuracy (1 hour training)
   - Hospital C: 81% accuracy (1.5 hours training)
   - Hospital D: Not submitted
6. Can adjust round deadline if needed
7. Generates report: "FL Round Summary"
```

---

# SECURITY CONSIDERATIONS

## Authentication
- Passwords: bcrypt (salt rounds: 12)
- JWT tokens: HS256, 24-hour expiry
- Refresh tokens: Optional, 7-day expiry
- Session management: Stored in database

## Authorization
- Role-based access control (RBAC): admin, doctor, patient
- Resource-level authorization: Users can only view own predictions
- API rate limiting: 100 requests/min per user

## Data Protection
- Images in transit: HTTPS/TLS
- Images at rest: Encrypted (AES-256)
- Database: Encrypted connections (PostgreSQL SSL)
- Model weights: Integrity checks (SHA-256 hash)

## Privacy (Federated Learning)
- Images stay local: No central data repository
- Weight aggregation: Server never sees raw images
- Audit logging: Who accessed what, when
- GDPR compliance: Users can request data deletion

## Infrastructure
- CORS: Whitelisted origins only
- CSRF protection: Token validation
- Input validation: Sanitize all user inputs
- SQL injection: Use parameterized queries (Mongoose/Sequelize)
- File upload: Validate type, scan for malware

---

# ERROR HANDLING & LOGGING

## Error Types & HTTP Status Codes
```
200 OK                - Request succeeded
201 Created           - Resource created
400 Bad Request       - Invalid input
401 Unauthorized      - Missing/invalid JWT
403 Forbidden         - Insufficient permissions
404 Not Found         - Resource doesn't exist
409 Conflict          - Duplicate record
422 Unprocessable     - Validation failed
429 Too Many Requests - Rate limit exceeded
500 Internal Server   - Server error
503 Service Unavailable - ML API down
```

## Logging Strategy
```
Development: console.log, morgan middleware
  └─ Sample request: "GET /api/predictions/history 200 45ms"

Production: File-based + centralized logging
  ├─ Winston (Node.js) → logs/app.log
  ├─ Python logging → logs/fl_client.log
  ├─ Structured JSON logs for aggregation
  └─ Centralized: ELK Stack or CloudWatch

Log Levels:
  INFO:   User actions, API calls, model training
  WARN:   Missing files, retries, slow operations
  ERROR:  Failed predictions, network errors, FL failures
  DEBUG:  Detailed tensor operations, weight diffs (dev only)
```

---

# MONITORING & OBSERVABILITY

## Metrics to Track
```
Application Level:
  - Request latency (p50, p95, p99)
  - Error rate (4xx, 5xx)
  - Prediction latency
  - Model accuracy per class
  - User login count
  - Predictions per day

Federated Learning:
  - Round completion time
  - Client participation rate
  - Aggregated model accuracy per round
  - Weight divergence (proximal distance)
  - Client upload file size
  - Training time per client

Infrastructure:
  - CPU usage
  - Memory usage
  - GPU utilization
  - Disk I/O
  - Network bandwidth
  - Model file sizes
```

## Dashboards
```
Admin Dashboard:
  - Real-time prediction count
  - Average accuracy
  - User growth chart
  - Model version timeline

FL Monitoring:
  - Current round status
  - Client participation
  - Accuracy trend graph
  - Weight aggregation progress

DevOps Dashboard:
  - Server health
  - Error logs
  - API latency histogram
  - Database performance
```

---

# PERFORMANCE OPTIMIZATION TECHNIQUES

## Model Optimization
```
1. Quantization: Convert FP32 weights to INT8
   - Model size: 100MB → 25MB
   - Inference: 0.5s → 0.1s

2. Pruning: Remove unimportant weights
   - Sparse model: 50% weights zero
   - No accuracy loss for skin cancer

3. Distillation: Train small model from large model
   - Smaller model: 5M params → 1M params
   - Similar accuracy, faster inference

4. Batch Normalization: Freeze after training
   - Inference slightly faster
   - Less memory

5. GPU Inference:
   - Device: "cuda" if NVIDIA available
   - Batch size: Process 32 images in parallel
```

## Server Optimization
```
1. Caching
   - Redis: Cache model predictions (key: image_hash)
   - TTL: 24 hours
   - Reduces model calls by 40%

2. Database Indexing
   - MongoDB: Index userId, timestamp (predictions)
   - PostgreSQL: Index flRound (fl_metrics)

3. Connection Pooling
   - MongoDB: 50 connections
   - PostgreSQL: 20 connections
   - Reuse rather than create new

4. Compression
   - gzip response bodies (text)
   - Binary protobuf for weights
```

## Client Optimization
```
1. Image Preprocessing
   - Server-side: Resize once, cache
   - Client-side: Lazy loading, pagination

2. Lazy Loading
   - React: Code splitting, dynamic imports
   - Images: Intersection Observer API

3. Debouncing/Throttling
   - Search queries: 300ms debounce
   - API calls: Prevent duplicate requests
```

---

# TROUBLESHOOTING GUIDE

## Common Issues

### Issue 1: Prediction returns null
```
Cause: Flask ML API down or timeout
Solution:
  1. Check: http://localhost:5001/model-info
  2. If 500: Check Flask logs, restart service
  3. If timeout: Increase timeout (default 30s)
  4. Fallback: Return cached result
```

### Issue 2: FL client fails to upload weights
```
Cause: Network timeout, server busy, or weights too large
Solution:
  1. Check FL server: GET /api/round/status
  2. If 500: Server crashed, restart service
  3. Compress weights before upload (ZIP)
  4. Retry logic: Exponential backoff
```

### Issue 3: GPU out of memory
```
Cause: Batch size too large or model doesn't fit
Solution:
  1. Reduce batch size: 32 → 16 or 8
  2. Reduce model: EfficientNet-B0 → B2 (lighter)
  3. Enable gradient checkpointing
  4. Run on CPU (slower, but works)
```

### Issue 4: Gemini API returns error
```
Cause: Missing API key, quota exceeded, or network issue
Solution:
  1. Check: echo $GEMINI_API_KEY (is it set?)
  2. Dashboard: Check API quota at makersuite.google.com
  3. Fallback: Return template-based analysis
  4. Retry: Linear retry (3 attempts, 2s delay)
```

### Issue 5: Desktop app won't start
```
Cause: Python not installed, port already in use, or missing dependencies
Solution:
  1. Check: python --version (≥3.9)
  2. Check ports: netstat -an | grep 3000, 3001, 5001, 6000
  3. Kill processes: lsof -ti:3001 | xargs kill -9
  4. Reinstall: pip install -r requirements.txt
  5. Check logs: desktop-app/logs/error.log
```

---

# EXAMPLE API CALLS

## Example 1: Login and Get JWT
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@hospital.com",
    "password": "SecurePassword123"
  }'

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "doctor@hospital.com",
    "firstName": "Dr. John",
    "role": "doctor"
  }
}
```

## Example 2: Upload Image for Prediction
```bash
curl -X POST http://localhost:3001/api/predictions/predict \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "image=@/path/to/skin_image.jpg"

Response:
{
  "success": true,
  "data": {
    "prediction": "mel",
    "confidence": 0.92,
    "riskLevel": "high",
    "classIndex": 0,
    "classProbabilities": {
      "mel": 0.92,
      "bcc": 0.05,
      "nv": 0.02,
      ...
    },
    "gradCAMBase64": "data:image/png;base64,iVBORw0KGgo...",
    "processingTime": 245,
    "geminiAnalysis": {
      "diagnosis": "Melanoma detected with 92% confidence...",
      "riskLevel": "High",
      "recommendations": ["URGENT: Consult dermatologist immediately", ...],
      "nextSteps": "This requires immediate medical evaluation..."
    }
  }
}
```

## Example 3: Get Prediction History
```bash
curl -X GET "http://localhost:3001/api/predictions/history?skip=0&limit=10&sortBy=timestamp" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

Response:
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "prediction": "mel",
      "confidence": 0.92,
      "timestamp": "2024-01-08T14:30:00Z",
      "riskLevel": "high"
    },
    ...
  ],
  "total": 45,
  "skip": 0,
  "limit": 10
}
```

## Example 4: Check Federated Learning Status
```bash
curl -X GET http://localhost:6000/api/round/status

Response:
{
  "currentRound": 5,
  "roundDeadline": 1704316800,
  "clientsActive": 3,
  "clientsExpected": 4,
  "aggregationType": "fedprox",
  "mu": 0.01,
  "lastAggregation": {
    "timestamp": 1704230400,
    "globalAccuracy": 0.825,
    "globalLoss": 0.456,
    "clientCount": 3
  }
}
```

---

# DEVELOPMENT ROADMAP

## Phase 1: Foundation (Completed ✓)
- [x] React frontend with login/dashboard
- [x] Express backend with APIs
- [x] MongoDB for user/prediction storage
- [x] Flask ML service with EfficientNet-B0
- [x] Basic inference and Grad-CAM
- [x] Gemini AI analysis integration

## Phase 2: Federated Learning (Completed ✓)
- [x] FL server with FedAvg aggregation
- [x] Desktop app (Electron) for local training
- [x] FL client connecting to server
- [x] FedProx algorithm implementation
- [x] Round-based training coordination
- [x] Model persistence and versioning

## Phase 3: Advanced Features (In Progress)
- [ ] Differential privacy (add noise to updates)
- [ ] Secure aggregation (encrypt weights)
- [ ] Model ensemble for better accuracy
- [ ] Uncertainty quantification
- [ ] Automated retraining schedules
- [ ] A/B testing framework

## Phase 4: Production & Scale
- [ ] Kubernetes deployment
- [ ] Multi-region FL (geographic distribution)
- [ ] Mobile app (React Native)
- [ ] Blockchain audit trail
- [ ] Compliance: HIPAA, GDPR, CCPA
- [ ] Performance: 1000+ concurrent users

---

END OF COMPREHENSIVE PROMPT

This document provides an AI with complete context to generate detailed system architecture documentation including:
1. All modules and their responsibilities
2. Complete data flows and interactions
3. Database schemas
4. API endpoints with examples
5. Algorithm explanations
6. Deployment architectures
7. Security and privacy measures
8. Troubleshooting guides
9. Performance optimization techniques
10. Integration points and contracts
