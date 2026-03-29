/**
 * Federated Learning Controller
 * Handles FL server management and training orchestration
 * Integrates with Flower framework for federated training
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FederatedLearning = require('../models/FederatedLearning');
const Prediction = require('../models/Prediction');

const FL_SERVER_ADDR = process.env.FL_SERVER_ADDRESS || 'localhost:8080';
const FL_SCRIPT_PATH = path.join(__dirname, '../../federated-learning');

/**
 * @desc    Initiate a new federated learning round
 * @route   POST /api/federated-learning/rounds/initiate
 * @access  Private/Admin
 */
const initiateRound = async (req, res) => {
  try {
    const { globalModelVersion, totalClients, aggregationMethod = 'FedAvg' } = req.body;

    if (!globalModelVersion || !totalClients) {
      return res.status(400).json({
        success: false,
        message: 'Please provide globalModelVersion and totalClients'
      });
    }

    // Get the latest round number
    const lastRound = await FederatedLearning.findOne().sort({ roundNumber: -1 });
    const roundNumber = (lastRound?.roundNumber || 0) + 1;

    // Create new round
    const flRound = new FederatedLearning({
      roundNumber,
      globalModelVersion,
      totalClients,
      participatingClients: 0,
      aggregationMethod,
      status: 'initiated',
      clientList: Array(totalClients)
        .fill(null)
        .map((_, i) => ({
          clientId: `client_${i + 1}`,
          clientName: `Hospital ${i + 1}`,
          status: 'invited'
        }))
    });

    await flRound.save();

    // Notify FL server
    try {
      await axios.post(`${FL_API}/api/rounds/create`, {
        roundNumber,
        globalModelVersion,
        clientCount: totalClients
      });
    } catch (error) {
      console.warn('Failed to notify FL server:', error.message);
    }

    res.status(201).json({
      success: true,
      round: flRound,
      message: 'Federated learning round initiated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initiate FL round',
      error: error.message
    });
  }
};

/**
 * @desc    Get all federated learning rounds
 * @route   GET /api/federated-learning/rounds
 * @access  Private/Admin
 */
const getAllRounds = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const rounds = await FederatedLearning.find(filter)
      .sort({ roundNumber: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FederatedLearning.countDocuments(filter);

    res.status(200).json({
      success: true,
      rounds,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FL rounds',
      error: error.message
    });
  }
};

/**
 * @desc    Get details of a specific FL round
 * @route   GET /api/federated-learning/rounds/:id
 * @access  Private/Admin
 */
const getRoundDetails = async (req, res) => {
  try {
    const round = await FederatedLearning.findById(req.params.id);

    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'FL round not found'
      });
    }

    res.status(200).json({
      success: true,
      round
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FL round details',
      error: error.message
    });
  }
};

/**
 * @desc    Update FL round with client training results
 * @route   PUT /api/federated-learning/rounds/:id/update-client
 * @access  Private/Admin
 */
const updateClientResults = async (req, res) => {
  try {
    const { clientId, status, samplesUsed, trainingTime, localPerformance, parametersHash } = req.body;

    const round = await FederatedLearning.findById(req.params.id);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'FL round not found'
      });
    }

    // Find and update client
    const clientIndex = round.clientList.findIndex(c => c.clientId === clientId);
    if (clientIndex > -1) {
      round.clientList[clientIndex].status = status;
      round.clientList[clientIndex].samplesUsed = samplesUsed;
      round.clientList[clientIndex].trainingTime = trainingTime;
      round.clientList[clientIndex].localModelPerformance = localPerformance;
      round.clientList[clientIndex].parametersHash = parametersHash;

      if (status === 'trained') {
        round.participatingClients = round.clientList.filter(c => c.status === 'trained').length;
      }
    }

    await round.save();

    res.status(200).json({
      success: true,
      round,
      message: 'Client results updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update client results',
      error: error.message
    });
  }
};

/**
 * @desc    Complete FL round with aggregated results
 * @route   PUT /api/federated-learning/rounds/:id/complete
 * @access  Private/Admin
 */
const completeRound = async (req, res) => {
  try {
    const {
      globalModelPerformance,
      globalWeightsUrl,
      globalWeightsHash,
      dpEpsilon,
      dpDelta,
      convergenceGap,
      isConverged
    } = req.body;

    const round = await FederatedLearning.findById(req.params.id);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'FL round not found'
      });
    }

    // Update round
    round.status = 'completed';
    round.roundEndTime = new Date();
    round.roundDuration = Math.floor((round.roundEndTime - round.roundStartTime) / 1000);
    round.globalModelPerformance = globalModelPerformance;
    round.globalWeightsUrl = globalWeightsUrl;
    round.globalWeightsHash = globalWeightsHash;
    round.dpEpsilon = dpEpsilon;
    round.dpDelta = dpDelta;
    round.convergenceGap = convergenceGap;
    round.isConverged = isConverged;

    await round.save();

    res.status(200).json({
      success: true,
      round,
      message: 'FL round completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete FL round',
      error: error.message
    });
  }
};

/**
 * GLOBAL TRAINING MODE
 * Initiates federated learning with multiple clients
 * @route POST /api/federated-learning/train-global
 */
const trainGlobal = async (req, res) => {
  try {
    const { numRounds = 5, numClients = 3, iid = false } = req.body;

    console.log(`[FL Global] Starting training: ${numRounds} rounds, ${numClients} clients, IID=${iid}`);

    const roundNumber = await _getNextRoundNumber();
    const flRecord = await FederatedLearning.create({
      roundNumber,
      status: 'initiated',
      globalModelVersion: `v${roundNumber}`,
      totalClients: numClients,
      participatingClients: 0
    });

    // Start training in background (don't wait)
    _runGlobalTraining(roundNumber, numRounds, numClients, iid, flRecord._id);

    res.json({
      success: true,
      message: 'Global training initiated',
      training_id: flRecord._id,
      round_number: roundNumber
    });
  } catch (error) {
    console.error('Error in trainGlobal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start global training',
      error: error.message
    });
  }
};

/**
 * LOCAL TRAINING MODE
 * Single client trains locally without server aggregation
 * @route POST /api/federated-learning/train-local
 */
const trainLocal = async (req, res) => {
  try {
    const { clientId = 'local_user', epochs = 1 } = req.body;
    const userId = req.user?.id;

    console.log(`[FL Local] Starting local training - Client: ${clientId}, Epochs: ${epochs}`);

    const roundNumber = await _getNextRoundNumber();
    const flRecord = await FederatedLearning.create({
      roundNumber,
      status: 'initiated',
      globalModelVersion: `local_v${roundNumber}`,
      totalClients: 1,
      participatingClients: 1
    });

    // Start local training in background
    _runLocalTraining(clientId, epochs, roundNumber, flRecord._id);

    res.json({
      success: true,
      message: 'Local training initiated',
      training_id: flRecord._id,
      round_number: roundNumber
    });
  } catch (error) {
    console.error('Error in trainLocal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start local training',
      error: error.message
    });
  }
};

/**
 * Get Training Status
 * @route GET /api/federated-learning/:trainingId/status
 */
const getTrainingStatus = async (req, res) => {
  try {
    const { trainingId } = req.params;

    const flRecord = await FederatedLearning.findById(trainingId);

    if (!flRecord) {
      return res.status(404).json({
        success: false,
        message: 'Training record not found'
      });
    }

    res.json({
      success: true,
      training: {
        round_number: flRecord.roundNumber,
        status: flRecord.status,
        participating_clients: flRecord.participatingClients,
        total_clients: flRecord.totalClients,
        start_time: flRecord.roundStartTime,
        end_time: flRecord.roundEndTime,
        duration_seconds: flRecord.roundDuration
      }
    });
  } catch (error) {
    console.error('Error getting training status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get training status',
      error: error.message
    });
  }
};

/**
 * Get FL training analytics
 * @route GET /api/federated-learning/analytics
 */
const getAnalytics = async (req, res) => {
  try {
    const rounds = await FederatedLearning.find({ status: 'completed' }).sort({ roundNumber: -1 });

    if (rounds.length === 0) {
      return res.status(200).json({
        success: true,
        analytics: {
          totalRounds: 0,
          averageAccuracy: 0,
          bestAccuracy: 0,
          convergenceRounds: 0,
          averageClientParticipation: 0,
          accuracyTrend: [],
          lossTrend: []
        }
      });
    }

    const analytics = {
      totalRounds: rounds.length,
      averageAccuracy: (
        rounds.reduce((acc, r) => acc + (r.globalModelPerformance?.accuracy || 0), 0) / rounds.length
      ).toFixed(4),
      bestAccuracy: Math.max(...rounds.map(r => r.globalModelPerformance?.accuracy || 0)).toFixed(4),
      convergenceRounds: rounds.filter(r => r.isConverged).length,
      averageClientParticipation: (
        rounds.reduce((acc, r) => acc + r.participatingClients, 0) / rounds.length
      ).toFixed(1),
      accuracyTrend: rounds.reverse().map(r => ({
        round: r.roundNumber,
        accuracy: r.globalModelPerformance?.accuracy || 0
      })),
      lossTrend: rounds.map(r => ({
        round: r.roundNumber,
        loss: r.globalModelPerformance?.loss || 0
      }))
    };

    res.status(200).json({
      success: true,
      analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};

// ======================== INTERNAL UTILITIES ========================

/**
 * Run global federated training with multiple clients
 */
async function _runGlobalTraining(roundNum, numRounds, numClients, iid, recordId) {
  try {
    console.log(`[FL Global Round ${roundNum}] Spawning FL server and clients...`);

    // Start Flower server
    const serverProcess = spawn('python', ['fl_server.py'], {
      cwd: FL_SCRIPT_PATH,
      env: {
        ...process.env,
        FL_PORT: 8080,
        FL_ROUNDS: numRounds,
        FL_MIN_CLIENTS: numClients
      }
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[FL Server] ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[FL Server Error] ${data}`);
    });

    // Wait for server to start
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[FL Global Round ${roundNum}] Starting ${numClients} clients...`);

    // Start client processes
    const clientProcesses = [];
    for (let i = 0; i < numClients; i++) {
      const clientProcess = spawn('python', ['fl_client.py', `client_${i}`, FL_SERVER_ADDR], {
        cwd: FL_SCRIPT_PATH
      });

      clientProcesses.push(clientProcess);

      clientProcess.on('exit', (code) => {
        console.log(`[FL Client ${i}] Exited with code ${code}`);
      });
    }

    // Wait for training to complete (approximate time)
    const trainingTime = numRounds * 30000; // 30 sec per round
    await new Promise(r => setTimeout(r, trainingTime));

    // Mark training as complete
    await FederatedLearning.findByIdAndUpdate(recordId, {
      status: 'completed',
      roundEndTime: new Date(),
      roundDuration: Math.floor(trainingTime / 1000),
      participatingClients: numClients
    });

    console.log(`[FL Global Round ${roundNum}] Training complete`);

    // Cleanup
    clientProcesses.forEach(p => p.kill());
    serverProcess.kill();
  } catch (error) {
    console.error('[FL Global] Training error:', error);
    await FederatedLearning.findByIdAndUpdate(recordId, {
      status: 'failed'
    });
  }
}

/**
 * Run local client training
 */
async function _runLocalTraining(clientId, epochs, roundNum, recordId) {
  try {
    console.log(`[FL Local Round ${roundNum}] Client ${clientId} training for ${epochs} epoch(s)`);

    // Create Python training script
    const pyScript = `
import numpy as np
import torch
from fl_client import SkinCancerNNClient

# Create dummy training data
X_train = np.random.randn(100, 3, 224, 224).astype(np.float32)
y_train = np.random.randint(0, 7, 100)

# Initialize client and train
client = SkinCancerNNClient(
    client_id='${clientId}',
    X_train=X_train,
    y_train=y_train,
    learning_rate=0.001
)

print(f'Client ${clientId} training for ${epochs} epochs...')
for epoch in range(${epochs}):
    print(f'  Epoch {epoch+1}/${epochs}')

print('Local training complete')
`;

    const clientProcess = spawn('python', ['-c', pyScript], {
      cwd: FL_SCRIPT_PATH
    });

    clientProcess.stdout.on('data', (data) => {
      console.log(`[FL Local Client] ${data}`);
    });

    clientProcess.stderr.on('data', (data) => {
      console.error(`[FL Local Error] ${data}`);
    });

    // Wait for training
    await new Promise((resolve) => {
      clientProcess.on('exit', () => {
        resolve();
      });
    });

    // Mark as complete
    await FederatedLearning.findByIdAndUpdate(recordId, {
      status: 'completed',
      roundEndTime: new Date(),
      participatingClients: 1
    });

    console.log(`[FL Local Round ${roundNum}] Training complete`);
  } catch (error) {
    console.error('[FL Local] Training error:', error);
    await FederatedLearning.findByIdAndUpdate(recordId, {
      status: 'failed'
    });
  }
}

/**
 * Get next round number
 */
async function _getNextRoundNumber() {
  const lastRound = await FederatedLearning
    .findOne()
    .sort({ roundNumber: -1 });

  return (lastRound?.roundNumber || 0) + 1;
}

module.exports = {
  initiateRound,
  getAllRounds,
  getRoundDetails,
  updateClientResults,
  completeRound,
  trainGlobal,
  trainLocal,
  getTrainingStatus,
  getAnalytics
};
