/**
 * ML Model Training Routes
 * Endpoints for training, aggregation, and model management
 */

const express = require('express');
const router = express.Router();
const {
  trainMLModel,
  getTrainingStatus,
  aggregateModels,
  getCentralModel,
  getAllModels,
  activateModel
} = require('../controllers/mlController');
const { protectRoute, authorize } = require('../middleware/auth');

// Public routes
router.get('/central-model', getCentralModel); // Get active model for predictions

// Protected routes
router.post('/train', protectRoute, authorize('admin'), trainMLModel); // Start training
router.get('/train/:trainingId', protectRoute, getTrainingStatus); // Check training status
router.post('/aggregate', protectRoute, authorize('admin'), aggregateModels); // Aggregate models
router.get('/models', protectRoute, getAllModels); // List all trained models
router.put('/models/:modelId/activate', protectRoute, authorize('admin'), activateModel); // Activate model

module.exports = router;
