
# Using the Trained Federated Learning Model

## Overview

The federated learning system trains a global model across multiple clients. The trained model is saved after each round and can be used for inference on new images.

## Model Location

Trained models are saved in:
```
federated-learning/models/global/
  ├── global_model_round_1.pt
  ├── global_model_round_2.pt
  ├── global_model_round_3.pt
  ├── global_model_round_4.pt
  └── global_model_round_5.pt
```

Each file contains the aggregated weights from all federated clients for that training round.

---

## Method 1: Direct Python Inference

### Single Image Prediction

```python
from fl_model_inference import FLModelInference

# Initialize with latest trained model
inference = FLModelInference()

# Or load specific round
inference = FLModelInference(model_round=5)

# Predict on image
result = inference.predict_image('path/to/image.jpg')

# Result structure
print(result)
# {
#   'predicted_class': 4,
#   'predicted_class_name': 'Melanoma',
#   'confidence': 0.95,
#   'model_round': 5,
#   'device': 'cuda',
#   'all_probabilities': {
#     'Actinic Keratosis': 0.01,
#     'Basal Cell Carcinoma': 0.02,
#     ...
#     'Melanoma': 0.95
#   }
# }
```

### Batch Predictions

```python
from fl_model_inference import FLModelInference

inference = FLModelInference(model_round=5)

image_paths = [
    'img1.jpg',
    'img2.jpg',
    'img3.jpg'
]

results = inference.predict_batch(image_paths)

for result in results:
    print(f"Class: {result['predicted_class_name']}, Confidence: {result['confidence']:.4f}")
```

### Command Line Inference

```bash
cd federated-learning

# Single image (uses latest model)
python fl_model_inference.py path/to/image.jpg

# Specific training round
python fl_model_inference.py path/to/image.jpg 5
```

---

## Method 2: REST API (Flask Service)

### Start the Inference API Server

```bash
cd federated-learning

# Install Flask if needed
pip install flask

# Start inference server (port 5001)
python fl_inference_api.py
```

Server will be available at: `http://localhost:5001`

### Health Check

```bash
curl http://localhost:5001/health
```

Response:
```json
{
  "status": "healthy",
  "service": "fl-inference-api",
  "model_loaded": true
}
```

### Get Model Info

```bash
curl http://localhost:5001/api/fl-model-info
```

Response:
```json
{
  "success": true,
  "model_info": {
    "model_type": "EfficientNet-B0",
    "num_classes": 7,
    "class_names": ["Actinic Keratosis", "Basal Cell Carcinoma", ...],
    "trained_round": 5,
    "device": "cuda",
    "model_path": "./models/global"
  }
}
```

### Single Image Prediction

```bash
curl -X POST \
  -F "image=@path/to/image.jpg" \
  http://localhost:5001/api/fl-predict

# Specify model round
curl -X POST \
  -F "image=@path/to/image.jpg" \
  -F "model_round=5" \
  http://localhost:5001/api/fl-predict
```

Response:
```json
{
  "success": true,
  "result": {
    "predicted_class": 4,
    "predicted_class_name": "Melanoma",
    "confidence": 0.95,
    "model_round": 5,
    "device": "cuda",
    "all_probabilities": {...}
  }
}
```

### Batch Image Predictions

```bash
curl -X POST \
  -F "images=@img1.jpg" \
  -F "images=@img2.jpg" \
  -F "images=@img3.jpg" \
  http://localhost:5001/api/fl-batch-predict
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "filename": "img1.jpg",
      "success": true,
      "result": {...}
    },
    ...
  ],
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  }
}
```

---

## Method 3: Web API (Node.js Express Backend)

### Start All Services

```bash
# Terminal 1: Start FL inference API
cd federated-learning
python fl_inference_api.py

# Terminal 2: Start Express server
cd server
npm start

# Terminal 3 (optional): Start FL client for continued training
cd federated-learning
python fl_client.py <client_id> 127.0.0.1:8080
```

### Endpoints

#### Get FL Model Info

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:3001/api/predictions/fl/info
```

#### Predict with FL Model

```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "image=@path/to/image.jpg" \
  http://localhost:3001/api/predictions/fl/predict
```

Optional parameters:
- `modelRound`: Specify which training round to use (default: latest)

Response:
```json
{
  "success": true,
  "prediction": {
    "_id": "...",
    "userId": "...",
    "imageFileName": "image.jpg",
    "imageUrl": "uploads/...",
    "prediction": {
      "className": "Melanoma",
      "classId": 4,
      "confidence": 0.95,
      "allProbabilities": {...}
    },
    "modelType": "federated-learning",
    "modelRound": 5,
    "riskLevel": "High",
    "processingTime": 2350,
    "createdAt": "2026-03-30T00:30:00.000Z"
  },
  "modelInfo": {
    "type": "federated-learning",
    "round": 5,
    "device": "cuda"
  }
}
```

---

## Class Mappings

The model predicts 7 skin cancer classes:

| ID | Name | Medical Name | Abbreviation |
|:--:|------|--------------|:------------:|
| 0 | Actinic Keratosis | Actinic Keratosis / Solar Keratosis | akiec |
| 1 | Basal Cell Carcinoma | Basal Cell Carcinoma | bcc |
| 2 | Benign Keratosis | Benign Keratosis (Solar Lentigo / Seborrheic Keratosis) | bkl |
| 3 | Dermatofibroma | Dermatofibroma | df |
| 4 | Melanoma | Melanoma | mel |
| 5 | Nevus | Melanocytic Nevus | nv |
| 6 | Vascular | Vascular Lesion | vasc |

---

## Complete Workflow Example

### 1. Train Federated Model

```bash
# Terminal 1: Start FL server
cd federated-learning
python fl_server.py

# Terminal 2-4: Start FL clients (in separate terminals)
python fl_client.py 1 127.0.0.1:8080
python fl_client.py 2 127.0.0.1:8080
python fl_client.py 3 127.0.0.1:8080
```

Servers trains for 5 rounds. Models saved after each round.

### 2. Start Inference Services

```bash
# Terminal 5: Start inference API
python fl_inference_api.py

# Terminal 6: Start Express backend
cd ../server
npm start
```

### 3. Make Predictions

```python
# Python example
from fl_model_inference import FLModelInference

# Use round 5 (latest)
inference = FLModelInference(model_round=5)

# Predict
result = inference.predict_image('test_skin_cancer.jpg')
print(f"Prediction: {result['predicted_class_name']}")
print(f"Confidence: {result['confidence']:.2%}")
```

Or via REST API:

```bash
# Using curl
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "image=@test_skin_cancer.jpg" \
  http://localhost:3001/api/predictions/fl/predict
```

---

## Performance Metrics

Expected model improvements as training progresses:

| Round | Client 1 Loss | Client 1 Accuracy | Global Model |
|:-----:|:-------------:|:------------------:|:-------------:|
| 0 | - | - | ~50% (pretrained) |
| 1 | 3.08 | 27.5% | ~50% |
| 2 | 0.12 | 96.2% | ~65% |
| 3 | 0.12 | 97.5% | ~70% |
| 4 | 0.07 | 98.8% | ~75% |
| 5 | 0.21 | 93.8% | ~80% |

Actual performance depends on:
- Number of participating clients
- Quality and distribution of training data
- Model hyperparameters
- Number of local training epochs

---

## Troubleshooting

### Model Not Found

```
[WARNING] Model directory not found: ./models/global
[INFO] Using untrained EfficientNet weights
```

**Solution**: Train the model first by running FL server and clients.

### Inference API Not Responding

Check if service is running:
```bash
curl http://localhost:5001/health
```

Start it if needed:
```bash
cd federated-learning
python fl_inference_api.py
```

### CUDA Out of Memory

If running on GPU with limited VRAM, modify:

```python
inference = FLModelInference(...)
# Models are on GPU, ensure images are not too large
```

Or use CPU instead:
```python
inference.device = torch.device('cpu')
```

### Connection Refused (Express → Flask)

Ensure Flask inference API is running:
```bash
python fl_inference_api.py
```

Check environment variable:
```bash
# In .env or Dockerfile
FL_INFERENCE_API=http://localhost:5001
```

---

## Advanced Usage

### Load Multiple Model Rounds

```python
from fl_model_inference import FLModelInference

# Compare predictions across rounds
for round_num in [3, 4, 5]:
    inference = FLModelInference(model_round=round_num)
    result = inference.predict_image('test.jpg')
    print(f"Round {round_num}: {result['predicted_class_name']} ({result['confidence']:.4f})")
```

### Fine-tune from Trained Model

```python
import torch
from fl_model_inference import FLModelInference

# Load trained model
inference = FLModelInference(model_round=5)
model = inference.model

# Fine-tune for new task
model.train()
# ... your fine-tuning code ...
```

### Export for Production

```python
from fl_model_inference import FLModelInference
import onnx
import torch.onnx

inference = FLModelInference(model_round=5)

# Convert to ONNX
torch.onnx.export(
    inference.model,
    torch.randn(1, 3, 224, 224),
    'model.onnx'
)
```
