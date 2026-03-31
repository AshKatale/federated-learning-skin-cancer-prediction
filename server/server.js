/**
 * Express Server - Main Application
 * Full-stack AI application for Federated Learning-based Skin Cancer Detection
 * 
 * Structure:
 * - User Authentication (JWT)
 * - Prediction Management
 * - Federated Learning Simulation
 * - ML Service Integration
 * - Database Management
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/authRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const federatedLearningRoutes = require('./routes/federatedLearningRoutes');
const mlRoutes = require('./routes/mlRoutes');

// Import database config
const { connectDB } = require('./config/database');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;
const ML_API = process.env.ML_API || 'http://localhost:5000';
const FL_SERVER = process.env.FL_SERVER_URL || 'http://localhost:6000'; // standalone FL server

// Create upload directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Database Connection
connectDB();

// Middleware
app.use(morgan('combined'));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Electron main process)
    if (!origin) return callback(null, true);

    const allowed = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    // Default dev origins — covers browser + Electron (127.0.0.1) + any port 3000-3010
    const defaults = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    ];

    const isAllowed =
      allowed.includes(origin) ||
      defaults.some(re => re.test(origin));

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use('/uploads', express.static(uploadDir));

// ==========================================
// API ROUTES
// ==========================================

// Authentication Routes
app.use('/api/auth', authRoutes);

// Prediction Routes
app.use('/api/predictions', predictionRoutes);

// Federated Learning Routes
app.use('/api/federated-learning', federatedLearningRoutes);

// ML Training & Model Routes
app.use('/api/ml', mlRoutes);

// ==========================================
// HEALTH CHECK & SYSTEM ENDPOINTS
// ==========================================

/**
 * Server Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

/**
 * Check ML API Health
 */
app.get('/api/health/ml', async (req, res) => {
  try {
    const response = await axios.get(`${ML_API}/api/health`, { timeout: 5000 });
    res.json({
      status: 'healthy',
      service: 'ml-api',
      details: response.data,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unavailable',
      service: 'ml-api',
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * Check FL Server Health (standalone cloud service)
 */
app.get('/api/health/fl', async (req, res) => {
  try {
    const response = await axios.get(`${FL_SERVER}/health`, { timeout: 5000 });
    res.json({ status: 'healthy', service: 'fl-server', details: response.data, timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', service: 'fl-server', error: error.message, timestamp: new Date() });
  }
});

/**
 * Get Model Information
 */
app.get('/api/model/info', async (req, res) => {
  try {
    const response = await axios.get(`${ML_API}/api/model/info`, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model information',
      error: error.message
    });
  }
});

/**
 * Get Available Classes
 */
app.get('/api/classes', async (req, res) => {
  try {
    const response = await axios.get(`${ML_API}/api/classes`, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classification classes',
      error: error.message
    });
  }
});

// ==========================================
// FRONTEND ROUTING (SPA)
// ==========================================

app.get('/', (req, res) => {
  const distPath = path.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(distPath)) {
    res.sendFile(distPath);
  } else {
    res.json({ message: 'Server is running. Frontend build not found.' });
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==========================================
// START SERVER
// ==========================================

const server = app.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════════════╗
║  Skin Cancer Detection & Classification System             ║
║  Federated Learning-Based Medical AI Platform              ║
╚═════════════════════════════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}
📦 Environment: ${process.env.NODE_ENV || 'development'}
🗄️  Database: MongoDB
🤖 ML Service: ${ML_API}
🔗 FL Service: ${FL_SERVER}

📚 API Documentation:
   - POST   /api/auth/register
   - POST   /api/auth/login
   - GET    /api/auth/me
   - PUT    /api/auth/profile
   - POST   /api/predictions/predict
   - GET    /api/predictions/history
   - GET    /api/predictions/stats
   - POST   /api/predictions/batch
   - GET    /api/federated-learning/rounds
   - POST   /api/federated-learning/rounds/initiate

🏥 System Status:
   - Server Health: /api/health
   - ML Service: /api/health/ml
   - FL Service: /api/health/fl
   - Model Info: /api/model/info
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📛 SIGTERM received. Starting graceful shutdown...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📛 SIGINT received. Starting graceful shutdown...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
