/**
 * Federated Learning REST API Integration Guide
 * 
 * Base URL: http://localhost:3001/api/federated-learning
 * All endpoints require authentication (Bearer token in Authorization header)
 */

// ==================== FEDERATED LEARNING ENDPOINTS ====================

/**
 * POST /train-global
 * Start global federated learning training with multiple clients
 * 
 * Request:
 * {
 *   "numRounds": 5,           // Number of FL rounds (default: 5)
 *   "numClients": 3,          // Number of clients to simulate (default: 3)
 *   "iid": false              // IID data distribution (default: false for non-IID)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Global training initiated",
 *   "training_id": "507f1f77bcf86cd799439011",
 *   "round_number": 1
 * }
 * 
 * Example:
 * fetch('http://localhost:3001/api/federated-learning/train-global', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${token}`,
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({
 *     numRounds: 5,
 *     numClients: 3,
 *     iid: false
 *   })
 * })
 */

/**
 * POST /train-local
 * Start local federated learning training for single client
 * 
 * Request:
 * {
 *   "clientId": "user_123",    // Client identifier (default: 'local_user')
 *   "epochs": 1                // Training epochs (default: 1)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Local training initiated",
 *   "training_id": "507f1f77bcf86cd799439011",
 *   "round_number": 1
 * }
 * 
 * Example:
 * fetch('http://localhost:3001/api/federated-learning/train-local', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${token}`,
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({
 *     clientId: 'user_123',
 *     epochs: 1
 *   })
 * })
 */

/**
 * GET /{trainingId}/status
 * Get current status of a training session
 * 
 * Response:
 * {
 *   "success": true,
 *   "training": {
 *     "round_number": 1,
 *     "status": "in-progress",        // initiated, in-progress, completed, failed
 *     "participating_clients": 3,
 *     "total_clients": 3,
 *     "start_time": "2024-01-15T10:30:00Z",
 *     "end_time": null,
 *     "duration_seconds": 120
 *   }
 * }
 * 
 * Example:
 * fetch('http://localhost:3001/api/federated-learning/training_id_here/status', {
 *   headers: {
 *     'Authorization': `Bearer ${token}`
 *   }
 * })
 */

/**
 * GET /analytics
 * Get federated learning training analytics
 * 
 * Response:
 * {
 *   "success": true,
 *   "analytics": {
 *     "totalRounds": 5,
 *     "averageAccuracy": 0.92,
 *     "bestAccuracy": 0.95,
 *     "convergenceRounds": 2,
 *     "averageClientParticipation": 2.8,
 *     "accuracyTrend": [
 *       { "round": 1, "accuracy": 0.85 },
 *       { "round": 2, "accuracy": 0.90 },
 *       { "round": 3, "accuracy": 0.92 }
 *     ],
 *     "lossTrend": [
 *       { "round": 1, "loss": 0.45 },
 *       { "round": 2, "loss": 0.35 },
 *       { "round": 3, "loss": 0.25 }
 *     ]
 *   }
 * }
 * 
 * Example:
 * fetch('http://localhost:3001/api/federated-learning/analytics', {
 *   headers: {
 *     'Authorization': `Bearer ${token}`
 *   }
 * })
 */

// ==================== REACT COMPONENT EXAMPLES ====================

// Example 1: Start Global Training
function startGlobalTraining() {
  const handleStartGlobal = async () => {
    try {
      const response = await fetch('/api/federated-learning/train-global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          numRounds: 5,
          numClients: 3,
          iid: false
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Training started:', data.training_id);
        // Poll for status
        await pollTrainingStatus(data.training_id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <button onClick={handleStartGlobal}>
      Train Global Model
    </button>
  );
}

// Example 2: Start Local Training
function startLocalTraining() {
  const handleStartLocal = async () => {
    try {
      const response = await fetch('/api/federated-learning/train-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          clientId: 'user_local',
          epochs: 1
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Local training started:', data.training_id);
        // Poll for status
        await pollTrainingStatus(data.training_id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <button onClick={handleStartLocal}>
      Train Locally
    </button>
  );
}

// Example 3: Poll Training Status
async function pollTrainingStatus(trainingId, intervalMs = 5000) {
  return new Promise((resolve) => {
    const pollId = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/federated-learning/${trainingId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        const data = await response.json();
        
        if (data.training) {
          console.log('Status:', data.training.status);
          
          if (data.training.status === 'completed' || 
              data.training.status === 'failed') {
            clearInterval(pollId);
            resolve(data.training);
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, intervalMs);
  });
}

// Example 4: Display Analytics
async function displayAnalytics() {
  try {
    const response = await fetch(
      '/api/federated-learning/analytics',
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    const data = response.json();
    
    if (data.success) {
      const analytics = data.analytics;
      console.log('Total Rounds:', analytics.totalRounds);
      console.log('Average Accuracy:', analytics.averageAccuracy);
      console.log('Best Accuracy:', analytics.bestAccuracy);
      
      // Plot accuracy trend
      analytics.accuracyTrend.forEach(point => {
        console.log(`Round ${point.round}: ${point.accuracy}`);
      });
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
  }
}

// ==================== USING WITH ELECTRON ====================

// In Electron renderer process (with IPC bridge):

async function useElectronAPI() {
  // Start training via IPC
  const result = await window.electronAPI.startTraining('global', {
    numRounds: 5,
    numClients: 3,
    iid: false
  });

  if (result.success) {
    // Get training status
    const status = await window.electronAPI.getTrainingStatus(
      result.training_id
    );
    console.log('Training status:', status);
  }
}
