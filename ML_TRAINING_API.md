# ML Model Training & Aggregation API

Complete REST API for ML model training, aggregation, and central model management.

## Base URL
```
http://localhost:3001/api/ml
```

---

## Endpoints

### 1. **Start ML Model Training**
**Trigger distributed training across datasets with automatic GPU utilization**

- **Route:** `POST /api/ml/train`
- **Auth:** Required (admin)
- **Content-Type:** `application/json`

#### Request Body
```json
{
  "modelName": "skin_cancer_model",
  "epochs": 5,
  "batchSize": 32,
  "learningRate": 0.001,
  "datasetType": "full",
  "useAggregation": true
}
```

#### Parameters
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `modelName` | string | `skin_cancer_model` | Name of model to train |
| `epochs` | number | 5 | Training epochs |
| `batchSize` | number | 32 | Batch size for training |
| `learningRate` | number | 0.001 | Learning rate |
| `datasetType` | enum | `full` | `full` or `sample` dataset |
| `useAggregation` | boolean | true | Auto-aggregate with recent models |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "ML model training initiated",
  "training_id": "507f1f77bcf86cd799439011",
  "model_name": "skin_cancer_model",
  "status": "training_started"
}
```

#### Response (Error - 500)
```json
{
  "success": false,
  "message": "Failed to start ML training",
  "error": "error details"
}
```

#### Example - cURL
```bash
curl -X POST http://localhost:3001/api/ml/train \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "epochs": 10,
    "batchSize": 64,
    "learningRate": 0.0005,
    "useAggregation": true
  }'
```

#### Example - JavaScript/Fetch
```javascript
async function trainModel() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('http://localhost:3001/api/ml/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        epochs: 10,
        batchSize: 64,
        learningRate: 0.0005,
        useAggregation: true
      })
    });
    
    const data = await response.json();
    console.log('Training started:', data.training_id);
    return data.training_id;
  } catch (error) {
    console.error('Training failed:', error);
  }
}
```

#### Example - React Component
```jsx
import React, { useState } from 'react';

function MLTraining() {
  const [trainingId, setTrainingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const startTraining = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          epochs: 10,
          batchSize: 64,
          useAggregation: true
        })
      });
      const data = await res.json();
      setTrainingId(data.training_id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={startTraining} disabled={loading}>
      {loading ? 'Starting...' : 'Start Training'}
    </button>
  );
}
```

---

### 2. **Get Training Status**
**Check progress and results of ongoing or completed training**

- **Route:** `GET /api/ml/train/:trainingId`
- **Auth:** Required
- **Parameters:** 
  - `trainingId` (URL parameter): Training record ID

#### Response (Success - 200)
```json
{
  "success": true,
  "training_id": "507f1f77bcf86cd799439011",
  "status": "completed",
  "modelName": "skin_cancer_model",
  "version": "v1711420000000",
  "startTime": "2024-03-26T10:20:00.000Z",
  "endTime": "2024-03-26T10:35:45.000Z",
  "duration": 945,
  "metrics": {
    "trainingLoss": 0.234,
    "validationLoss": 0.301,
    "trainingAccuracy": 0.942,
    "validationAccuracy": 0.895,
    "precision": 0.920,
    "recall": 0.895,
    "f1Score": 0.907,
    "GPU": "NVIDIA RTX 3080",
    "device": "cuda"
  },
  "accuracy": 0.895
}
```

#### Example - JavaScript with Polling
```javascript
async function monitorTraining(trainingId) {
  const token = localStorage.getItem('token');
  const maxAttempts = 120; // 2 hours with 60-second intervals
  let attempts = 0;

  const checkStatus = async () => {
    attempts++;
    
    if (attempts > maxAttempts) {
      console.log('Training timeout');
      return;
    }

    try {
      const response = await fetch(`/api/ml/train/${trainingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      console.log(`Status: ${data.status}`, data);

      if (data.status === 'completed' || data.status === 'failed') {
        console.log('Training finished:', data);
      } else {
        // Poll again after 60 seconds
        setTimeout(checkStatus, 60000);
      }
    } catch (error) {
      console.error('Status check failed:', error);
      setTimeout(checkStatus, 60000);
    }
  };

  checkStatus();
}
```

---

### 3. **Aggregate Models**
**Combine weights from multiple trained models using federated averaging**

- **Route:** `POST /api/ml/aggregate`
- **Auth:** Required (admin)
- **Content-Type:** `application/json`

#### Request Body
```json
{
  "modelVersions": [
    "v1711420000000",
    "v1711421000000",
    "v1711422000000"
  ],
  "outputVersion": "aggregated_v1711423000000"
}
```

#### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelVersions` | array | Yes | List of version strings to aggregate |
| `outputVersion` | string | No | Custom version name for aggregated model |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Model aggregation initiated",
  "aggregation_id": "507f1f77bcf86cd799439012",
  "output_version": "aggregated_v1711423000000",
  "input_models": 3
}
```

#### Example - JavaScript
```javascript
async function aggregateModels() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('/api/ml/aggregate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        modelVersions: [
          'v1711420000000',
          'v1711421000000',
          'v1711422000000'
        ]
      })
    });
    
    const data = await response.json();
    console.log('Aggregation started:', data.aggregation_id);
    return data.aggregation_id;
  } catch (error) {
    console.error('Aggregation failed:', error);
  }
}
```

---

### 4. **Get Central Model**
**Retrieve the active central model used for predictions (PUBLIC)**

- **Route:** `GET /api/ml/central-model`
- **Auth:** Not required
- **Response:** Model info for serving predictions

#### Response (Success - 200)
```json
{
  "success": true,
  "model": {
    "version": "aggregated_v1711423000000",
    "name": "skin_cancer_model",
    "accuracy": 0.917,
    "createdAt": "2024-03-26T10:50:00.000Z",
    "aggregatedFrom": [
      "v1711420000000",
      "v1711421000000",
      "v1711422000000"
    ],
    "architectureInfo": {
      "baseModel": "EfficientNet-B0",
      "numClasses": 7,
      "classes": [
        "Actinic Keratosis",
        "Basal Cell Carcinoma",
        "Benign Keratosis",
        "Dermatofibroma",
        "Melanoma",
        "Nevus",
        "Vascular"
      ]
    }
  }
}
```

#### Example - React Component for Prediction
```jsx
function PredictionComponent() {
  const [centralModel, setCentralModel] = useState(null);

  useEffect(() => {
    async function getCentralModel() {
      const res = await fetch('/api/ml/central-model');
      const data = await res.json();
      setCentralModel(data.model);
    }
    getCentralModel();
  }, []);

  return (
    <div>
      {centralModel && (
        <div>
          <p>Using Model: {centralModel.version}</p>
          <p>Accuracy: {(centralModel.accuracy * 100).toFixed(2)}%</p>
          <p>Classes: {centralModel.architectureInfo.classes.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
```

---

### 5. **List All Models**
**Get paginated list of all trained models**

- **Route:** `GET /api/ml/models`
- **Auth:** Required
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 10)
  - `status` (optional): Filter by status

#### Response (Success - 200)
```json
{
  "success": true,
  "models": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "version": "aggregated_v1711423000000",
      "modelName": "skin_cancer_model",
      "status": "active",
      "accuracy": 0.917,
      "isAggregated": true,
      "aggregatedFrom": 3,
      "createdAt": "2024-03-26T10:50:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

#### Example - JavaScript
```javascript
async function listModels() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/ml/models?status=completed&limit=20', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  console.log('Available models:', data.models);
}
```

---

### 6. **Activate Model**
**Set a trained model as the active central model for predictions**

- **Route:** `PUT /api/ml/models/:modelId/activate`
- **Auth:** Required (admin)
- **Parameters:**
  - `modelId` (URL parameter): Model ID to activate

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Model activated successfully",
  "model": {
    "version": "aggregated_v1711423000000",
    "accuracy": 0.917,
    "activatedAt": "2024-03-26T11:00:00.000Z"
  }
}
```

#### Example - JavaScript
```javascript
async function activateModel(modelId) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/api/ml/models/${modelId}/activate`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  console.log('Model activated:', data.model);
}
```

---

## Workflow Example: Full Training & Aggregation Pipeline

```javascript
async function fullMLPipeline() {
  const token = localStorage.getItem('token');

  // Step 1: Start training (multiple times for distributed data)
  console.log('Step 1: Starting training runs...');
  const trainingIds = [];
  
  for (let i = 0; i < 3; i++) {
    const res = await fetch('/api/ml/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        epochs: 10,
        batchSize: 64,
        datasetType: i === 0 ? 'sample' : 'full'
      })
    });
    const data = await res.json();
    trainingIds.push(data.training_id);
  }

  // Step 2: Wait for all training to complete
  console.log('Step 2: Waiting for training to complete...');
  
  async function waitForTraining(trainingId) {
    while (true) {
      const res = await fetch(`/api/ml/train/${trainingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.status === 'completed' || data.status === 'failed') {
        return data;
      }
      
      // Wait 60 seconds before checking again
      await new Promise(r => setTimeout(r, 60000));
    }
  }

  const results = await Promise.all(trainingIds.map(waitForTraining));
  console.log('Training results:', results);

  // Step 3: Aggregate models
  console.log('Step 3: Aggregating trained models...');
  const modelVersions = results
    .filter(r => r.status === 'completed')
    .map(r => r.version);

  const aggregateRes = await fetch('/api/ml/aggregate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ modelVersions })
  });
  const aggregateData = await aggregateRes.json();

  // Step 4: Get central model info
  console.log('Step 4: Retrieving central model...');
  const modelRes = await fetch('/api/ml/central-model');
  const modelInfo = await modelRes.json();
  
  console.log('Pipeline complete:');
  console.log('  - Trained models:', modelVersions.length);
  console.log('  - Aggregation ID:', aggregateData.aggregation_id);
  console.log('  - Central model version:', modelInfo.model.version);
  console.log('  - Central model accuracy:', modelInfo.model.accuracy);

  return modelInfo.model;
}
```

---

## Key Features

### ✅ Automatic GPU Utilization
- PyTorch automatically detects CUDA
- Models trained on available GPU (NVIDIA, AMD)
- Falls back to CPU automatically if GPU unavailable

### ✅ Federated Model Averaging
- Combines weights from distributed training runs
- Weighted averaging based on model accuracy
- Supports simple and weighted aggregation strategies

### ✅ Central Model Management
- Single active model serves all predictions
- Version control for all trained models
- Easy model switching and rollback

### ✅ Scalable Architecture
- Background training processes don't block API
- Efficient model file storage and management
- Metrics tracking for all training runs

---

## Status Codes

| Status | Description |
|--------|-------------|
| `initiating` | Training job created, about to start |
| `training` | Training in progress |
| `completed` | Training finished successfully |
| `aggregating` | Model aggregation in progress |
| `active` | Model is currently serving predictions |
| `archived` | Previous model, no longer active |
| `failed` | Training or aggregation failed |

---

## Authentication

All endpoints except `GET /api/ml/central-model` require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer {your_jwt_token}
```

Obtain tokens via: `POST /api/auth/login`

---

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details"
}
```

Common status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (training/model doesn't exist)
- `500`: Server error
