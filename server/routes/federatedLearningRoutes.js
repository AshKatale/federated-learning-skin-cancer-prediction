/**
 * Federated Learning Routes (server-side)
 *
 * The Node.js backend does NOT handle model weights.
 * It only tracks round metadata in the database for the admin dashboard.
 * All weight operations go directly between desktop clients and the FL server.
 */

const express = require('express');
const {
  getAllRounds,
  getRoundDetails,
  getAnalytics,
  getTrainingStatus,
  recordClientSubmission,
  initiateRound,
  completeRound,
  stopRound,
} = require('../controllers/federatedLearningController');
const { protectRoute, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protectRoute);

// Dashboard/analytics (read-only)
router.get('/rounds', authorize('admin', 'doctor'), getAllRounds);
router.get('/rounds/:id', authorize('admin', 'doctor'), getRoundDetails);
router.get('/analytics', authorize('admin', 'doctor'), getAnalytics);
router.get('/:trainingId/status', getTrainingStatus);

// Admin: manually initiate a new round (creates DB record, does NOT touch weights)
router.post('/rounds/initiate', authorize('admin'), initiateRound);

// Admin: stop an ongoing round
router.post('/rounds/stop', authorize('admin'), stopRound);

// FL Server calls this when round completes (updates analytics)
router.post('/rounds/complete', completeRound);

// Desktop client calls this to log that it submitted weights to FL server
// NO weights pass through here – just metadata
router.post('/client/submitted', protectRoute, recordClientSubmission);

module.exports = router;
