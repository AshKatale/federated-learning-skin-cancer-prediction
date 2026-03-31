/**
 * Predictions Routes
 */

const express = require('express');
const multer = require('multer');
const {
  submitPrediction,
  getPredictionHistory,
  getPredictionById,
  batchPrediction,
  getPredictionStats,
  predictWithFLModel,
  getFLModelInfo
} = require('../controllers/predictionController');
const { protectRoute } = require('../middleware/auth');

const router = express.Router();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// All routes require authentication
router.use(protectRoute);

// Single prediction
router.post('/predict', upload.single('image'), submitPrediction);

// Batch prediction
router.post('/batch', upload.array('images', 50), batchPrediction);

// Get prediction history
router.get('/history', getPredictionHistory);

// Get prediction statistics
router.get('/stats', getPredictionStats);

// Get specific prediction
router.get('/:id', getPredictionById);

// ==========================================
// FEDERATED LEARNING MODEL ROUTES
// ==========================================

// Predict with trained FL model
router.post('/fl/predict', upload.single('image'), predictWithFLModel);

// Get FL model information
router.get('/fl/info', getFLModelInfo);

module.exports = router;
