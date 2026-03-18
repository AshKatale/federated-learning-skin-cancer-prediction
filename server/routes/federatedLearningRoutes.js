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
  getAnalytics
} = require('../controllers/federatedLearningController');
const { protectRoute, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Admin-only endpoints
router.post('/rounds/initiate', authorize('admin'), initiateRound);
router.put('/rounds/:id/complete', authorize('admin'), completeRound);
router.put('/rounds/:id/update-client', authorize('admin'), updateClientResults);

// Admin and doctor can view
router.get('/rounds', authorize('admin', 'doctor'), getAllRounds);
router.get('/rounds/:id', authorize('admin', 'doctor'), getRoundDetails);
router.get('/analytics', authorize('admin', 'doctor'), getAnalytics);

module.exports = router;
