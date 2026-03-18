/**
 * Authentication Routes
 */

const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { protectRoute } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Private routes
router.get('/me', protectRoute, getMe);
router.put('/profile', protectRoute, updateProfile);
router.put('/change-password', protectRoute, changePassword);

module.exports = router;
