/**
 * Federated Learning Routes
 */

const express = require('express');
const {
  initiateRound,
  getAllRounds,
  getRoundDetails,
  updateClientResults,
  completeRound,
  getAnalytics,
  trainGlobal,
  trainLocal,
  getTrainingStatus
} = require('../controllers/federatedLearningController');
const { protectRoute, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Training modes (main endpoints)
router.post('/train-global', authorize('admin'), trainGlobal);
router.post('/train-local', trainLocal);

// Training status and analytics
router.get('/:trainingId/status', getTrainingStatus);
router.get('/analytics', authorize('admin', 'doctor'), getAnalytics);

// Legacy endpoints
router.post('/rounds/initiate', authorize('admin'), initiateRound);
router.put('/rounds/:id/complete', authorize('admin'), completeRound);
router.put('/rounds/:id/update-client', authorize('admin'), updateClientResults);
router.get('/rounds', authorize('admin', 'doctor'), getAllRounds);
router.get('/rounds/:id', authorize('admin', 'doctor'), getRoundDetails);

module.exports = router;
