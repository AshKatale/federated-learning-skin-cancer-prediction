# API Endpoints Reference

Complete API endpoint documentation for the Skin Cancer Detection Backend.

## Base URL
```
http://localhost:3001/api
```

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "age": 35,
  "gender": "M",
  "role": "user",
  "organization": "Hospital Name (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "User already exists with that email"
}
```

---

### POST /auth/login
Authenticate user and retrieve JWT token.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### GET /auth/me
Get current authenticated user's profile.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "age": 35,
    "gender": "M",
    "role": "user",
    "organization": "Hospital Name",
    "phone": "+1-555-0123",
    "verified": true,
    "createdAt": "2024-01-15T08:30:00.000Z"
  }
}
```

---

### PUT /auth/profile
Update user profile information.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body (all optional):**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "age": 36,
  "gender": "M",
  "phone": "+1-555-0124",
  "organization": "Medical Center",
  "bio": "Dermatologist with 10 years experience"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "age": 36,
    "phone": "+1-555-0124",
    "organization": "Medical Center",
    "updatedAt": "2024-01-16T10:45:00.000Z"
  }
}
```

---

### PUT /auth/change-password
Change user password.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456",
  "confirmPassword": "newPassword456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

---

## Prediction Endpoints

### POST /predictions/predict
Submit a single image for skin cancer prediction.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Form Data:**
```
image: <image_file> (JPEG, PNG, WebP)
```

**Response (200):**
```json
{
  "success": true,
  "message": "Prediction completed",
  "prediction": {
    "id": "607f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "image": {
      "filename": "skin_lesion_20240115.jpg",
      "size": 245678,
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "prediction": {
      "className": "mel",
      "classId": 4,
      "classLabel": "Melanoma",
      "confidence": 0.87,
      "allProbabilities": {
        "akiec": 0.02,
        "bcc": 0.03,
        "bkl": 0.04,
        "df": 0.01,
        "mel": 0.87,
        "nv": 0.02,
        "vasc": 0.01
      }
    },
    "riskAssessment": {
      "riskLevel": "High",
      "riskScore": 0.87,
      "recommendation": "Urgent dermatological consultation recommended"
    },
    "gradCAM": {
      "imageUrl": "/uploads/gradcam_607f1f77bcf86cd799439012.jpg",
      "heatmapUrl": "/uploads/heatmap_607f1f77bcf86cd799439012.jpg"
    },
    "processingTime": 1234,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "No image provided"
}
```

**Error (503):**
```json
{
  "success": false,
  "message": "ML service unavailable"
}
```

---

### POST /predictions/batch
Submit multiple images for batch prediction.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Form Data:**
```
images: <image_file_1>
images: <image_file_2>
images: <image_file_3>
...
```

**Response (200):**
```json
{
  "success": true,
  "message": "Batch prediction completed",
  "results": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "predictions": [
      {
        "filename": "image1.jpg",
        "class": "mel",
        "confidence": 0.87,
        "riskLevel": "High"
      },
      {
        "filename": "image2.jpg",
        "class": "nv",
        "confidence": 0.92,
        "riskLevel": "Low"
      },
      {
        "filename": "image3.jpg",
        "class": "bcc",
        "confidence": 0.76,
        "riskLevel": "Medium"
      }
    ],
    "processingTime": 3456,
    "completedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

---

### GET /predictions/history
Retrieve user's prediction history with pagination and filtering.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
```
page=1                    # Page number (default: 1)
limit=10                  # Items per page (default: 10)
riskLevel=High            # Filter: Low, Medium, High (optional)
sortBy=createdAt          # Sort field (default: createdAt)
sortOrder=desc            # desc or asc (default: desc)
```

**Example Request:**
```
GET /predictions/history?page=1&limit=10&riskLevel=High&sortBy=createdAt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Prediction history retrieved",
  "data": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3,
    "predictions": [
      {
        "id": "607f1f77bcf86cd799439012",
        "filename": "skin_lesion_20240115.jpg",
        "className": "mel",
        "confidence": 0.87,
        "riskLevel": "High",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "607f1f77bcf86cd799439013",
        "filename": "skin_lesion_20240114.jpg",
        "className": "nv",
        "confidence": 0.92,
        "riskLevel": "Low",
        "createdAt": "2024-01-14T14:20:00.000Z"
      }
    ]
  }
}
```

---

### GET /predictions/stats
Get prediction statistics and analytics.

**Access:** Protected

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Statistics retrieved",
  "stats": {
    "totalPredictions": 42,
    "averageConfidence": 0.823,
    "byRiskLevel": {
      "Low": {
        "count": 18,
        "percentage": 42.86
      },
      "Medium": {
        "count": 16,
        "percentage": 38.10
      },
      "High": {
        "count": 8,
        "percentage": 19.05
      }
    },
    "byClass": {
      "mel": {
        "count": 8,
        "percentage": 19.05,
        "avgConfidence": 0.854
      },
      "nv": {
        "count": 15,
        "percentage": 35.71,
        "avgConfidence": 0.889
      },
      "bcc": {
        "count": 10,
        "percentage": 23.81,
        "avgConfidence": 0.761
      },
      "bkl": {
        "count": 5,
        "percentage": 11.90,
        "avgConfidence": 0.742
      },
      "akiec": {
        "count": 2,
        "percentage": 4.76,
        "avgConfidence": 0.814
      },
      "df": {
        "count": 1,
        "percentage": 2.38,
        "avgConfidence": 0.699
      },
      "vasc": {
        "count": 1,
        "percentage": 2.38,
        "avgConfidence": 0.756
      }
    },
    "averageProcessingTime": 1289,
    "lastPrediction": "2024-01-16T11:45:00.000Z"
  }
}
```

---

### GET /predictions/:id
Retrieve a specific prediction result.

**Access:** Protected (Users see own, Doctors/Admins see all)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
```
id: prediction ID (e.g., 607f1f77bcf86cd799439012)
```

**Response (200):**
```json
{
  "success": true,
  "message": "Prediction retrieved",
  "prediction": {
    "id": "607f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "image": {
      "filename": "skin_lesion_20240115.jpg",
      "size": 245678,
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "prediction": {
      "className": "mel",
      "classId": 4,
      "confidence": 0.87,
      "allProbabilities": {
        "akiec": 0.02,
        "bcc": 0.03,
        "bkl": 0.04,
        "df": 0.01,
        "mel": 0.87,
        "nv": 0.02,
        "vasc": 0.01
      }
    },
    "riskAssessment": {
      "riskLevel": "High",
      "riskScore": 0.87
    },
    "doctorsReport": {
      "verified": false,
      "notes": null,
      "verifiedBy": null
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Federated Learning Endpoints

### GET /federated-learning/rounds
Get all federated learning rounds.

**Access:** Protected (Admin/Doctor only)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
```
page=1              # Page number (default: 1)
limit=10            # Items per page (default: 10)
status=completed    # Filter: pending, active, completed (optional)
sortBy=roundNumber  # Sort field (default: roundNumber)
sortOrder=desc      # desc or asc (default: desc)
```

**Response (200):**
```json
{
  "success": true,
  "message": "FL rounds retrieved",
  "data": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "rounds": [
      {
        "id": "607f1f77bcf86cd799439020",
        "roundNumber": 5,
        "status": "completed",
        "globalModel": {
          "version": "5.0",
          "weightsHash": "abc123def456...",
          "accuracy": 0.867,
          "loss": 0.342
        },
        "clientCount": 8,
        "startedAt": "2024-01-16T09:00:00.000Z",
        "completedAt": "2024-01-16T10:30:00.000Z",
        "duration": 5400
      }
    ]
  }
}
```

---

### GET /federated-learning/rounds/:id
Get details of a specific FL round.

**Access:** Protected (Admin/Doctor only)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
```
id: round ID (e.g., 607f1f77bcf86cd799439020)
```

**Response (200):**
```json
{
  "success": true,
  "message": "FL round details retrieved",
  "round": {
    "id": "607f1f77bcf86cd799439020",
    "roundNumber": 5,
    "status": "completed",
    "globalModel": {
      "version": "5.0",
      "weightsHash": "abc123def456...",
      "accuracy": 0.867,
      "loss": 0.342
    },
    "clients": [
      {
        "id": "client-1",
        "status": "completed",
        "samplesUsed": 1500,
        "trainAccuracy": 0.871,
        "trainLoss": 0.331,
        "completedAt": "2024-01-16T10:15:00.000Z"
      },
      {
        "id": "client-2",
        "status": "completed",
        "samplesUsed": 2100,
        "trainAccuracy": 0.859,
        "trainLoss": 0.348,
        "completedAt": "2024-01-16T10:20:00.000Z"
      }
    ],
    "aggregation": {
      "method": "FedAvg",
      "weights": "weighted_by_samples",
      "secureAggregation": true
    },
    "privacy": {
      "differentialPrivacy": {
        "enabled": true,
        "epsilon": 4.5,
        "delta": 0.00001
      },
      "secureAggregation": true
    },
    "metrics": {
      "globalAccuracy": 0.867,
      "globalLoss": 0.342,
      "convergence": true,
      "convergenceRound": 4
    },
    "startedAt": "2024-01-16T09:00:00.000Z",
    "completedAt": "2024-01-16T10:30:00.000Z"
  }
}
```

---

### POST /federated-learning/rounds/initiate
Start a new federated learning round.

**Access:** Protected (Admin only)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "clientList": ["client-1", "client-2", "client-3"],
  "aggregationMethod": "FedAvg"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "FL round initiated successfully",
  "round": {
    "id": "607f1f77bcf86cd799439021",
    "roundNumber": 6,
    "status": "active",
    "clientCount": 3,
    "startedAt": "2024-01-16T11:00:00.000Z"
  }
}
```

---

### PUT /federated-learning/rounds/:id/update-client
Update client results for a specific FL round.

**Access:** Protected (Admin only)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**URL Parameters:**
```
id: round ID
```

**Request Body:**
```json
{
  "clientId": "client-1",
  "status": "completed",
  "samplesUsed": 1500,
  "trainAccuracy": 0.871,
  "trainLoss": 0.331,
  "weights": "base64_encoded_weights_data"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Client results updated successfully",
  "client": {
    "id": "client-1",
    "status": "completed",
    "samplesUsed": 1500,
    "trainAccuracy": 0.871,
    "trainLoss": 0.331,
    "updatedAt": "2024-01-16T11:15:00.000Z"
  }
}
```

---

### PUT /federated-learning/rounds/:id/complete
Complete a federated learning round.

**Access:** Protected (Admin only)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**URL Parameters:**
```
id: round ID
```

**Request Body:**
```json
{
  "globalAccuracy": 0.868,
  "globalLoss": 0.340,
  "convergence": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "FL round completed successfully",
  "round": {
    "id": "607f1f77bcf86cd799439021",
    "roundNumber": 6,
    "status": "completed",
    "globalAccuracy": 0.868,
    "globalLoss": 0.340,
    "convergence": true,
    "completedAt": "2024-01-16T11:30:00.000Z"
  }
}
```

---

### GET /federated-learning/analytics
Get federated learning analytics and metrics.

**Access:** Protected (Admin/Doctor only)

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "success": true,
  "message": "FL analytics retrieved",
  "analytics": {
    "totalRounds": 6,
    "activeRounds": 1,
    "completedRounds": 5,
    "averageAccuracy": 0.851,
    "bestAccuracy": 0.868,
    "convergenceRounds": 4,
    "averageClientsPerRound": 8.2,
    "totalClientsParticipated": 12,
    "accuracyTrend": [
      {"round": 1, "accuracy": 0.742},
      {"round": 2, "accuracy": 0.794},
      {"round": 3, "accuracy": 0.821},
      {"round": 4, "accuracy": 0.845},
      {"round": 5, "accuracy": 0.859},
      {"round": 6, "accuracy": 0.868}
    ],
    "lossTrend": [
      {"round": 1, "loss": 0.512},
      {"round": 2, "loss": 0.421},
      {"round": 3, "loss": 0.389},
      {"round": 4, "loss": 0.362},
      {"round": 5, "loss": 0.348},
      {"round": 6, "loss": 0.340}
    ],
    "clientParticipationRate": 0.92
  }
}
```

---

## System Endpoints

### GET /health
Server health check.

**Access:** Public

**Response (200):**
```json
{
  "status": "healthy",
  "server": "running",
  "timestamp": "2024-01-16T12:00:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

---

### GET /health/ml
Check ML service availability.

**Access:** Public

**Response (200):**
```json
{
  "status": "healthy",
  "service": "ml-api",
  "details": {
    "model": "EfficientNet-B0",
    "classes": 7,
    "accuracy": 0.876
  },
  "timestamp": "2024-01-16T12:00:00.000Z"
}
```

**Response (503):**
```json
{
  "status": "unavailable",
  "service": "ml-api",
  "error": "connect ECONNREFUSED 127.0.0.1:5000",
  "timestamp": "2024-01-16T12:00:00.000Z"
}
```

---

### GET /health/fl
Check FL service availability.

**Access:** Public

**Response (200):**
```json
{
  "status": "healthy",
  "service": "fl-api",
  "details": {
    "server": "running",
    "activeRounds": 1
  },
  "timestamp": "2024-01-16T12:00:00.000Z"
}
```

---

### GET /model/info
Get ML model information.

**Access:** Public

**Response (200):**
```json
{
  "success": true,
  "model": {
    "name": "EfficientNet-B0",
    "version": "1.0.0",
    "architecture": "EfficientNet-B0",
    "classes": 7,
    "accuracy": 0.876,
    "parameters": 5300000
  },
  "classes": {
    "akiec": "Actinic Keratosis",
    "bcc": "Basal Cell Carcinoma",
    "bkl": "Benign Keratosis",
    "df": "Dermatofibroma",
    "mel": "Melanoma",
    "nv": "Nevus",
    "vasc": "Vascular"
  }
}
```

---

### GET /classes
Get available skin lesion classification classes.

**Access:** Public

**Response (200):**
```json
{
  "success": true,
  "classes": {
    "0": {
      "id": 0,
      "name": "akiec",
      "label": "Actinic Keratosis",
      "riskLevel": "Medium"
    },
    "1": {
      "id": 1,
      "name": "bcc",
      "label": "Basal Cell Carcinoma",
      "riskLevel": "High"
    },
    "2": {
      "id": 2,
      "name": "bkl",
      "label": "Benign Keratosis",
      "riskLevel": "Low"
    },
    "3": {
      "id": 3,
      "name": "df",
      "label": "Dermatofibroma",
      "riskLevel": "Low"
    },
    "4": {
      "id": 4,
      "name": "mel",
      "label": "Melanoma",
      "riskLevel": "High"
    },
    "5": {
      "id": 5,
      "name": "nv",
      "label": "Nevus",
      "riskLevel": "Low"
    },
    "6": {
      "id": 6,
      "name": "vasc",
      "label": "Vascular",
      "riskLevel": "Low"
    }
  }
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error context"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

Currently not rate limited. To be implemented in production.

---

## Pagination

Endpoints supporting pagination use:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `pages`: Total number of pages (in response)
- `total`: Total items (in response)

---

## Quick cURL Examples

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Test123!",
    "firstName":"John",
    "lastName":"Doe",
    "role":"user",
    "age":30,
    "gender":"M"
  }'
```

### Login & Save Token
```bash
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### Make Authenticated Request
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Upload Image
```bash
curl -X POST http://localhost:3001/api/predictions/predict \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/image.jpg"
```

---

## API Versioning

Current API version: `v1`
All endpoints use: `/api/` without version prefix currently
Future versions will use: `/api/v2/`, `/api/v3/`, etc.

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Authentication endpoints
- Prediction endpoints
- Federated Learning endpoints
- System health checks
