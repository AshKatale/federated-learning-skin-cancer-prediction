/**
 * Federated Learning Controller
 * Handles FL round management and training simulation
 */

const FederatedLearning = require('../models/FederatedLearning');
const Prediction = require('../models/Prediction');
const axios = require('axios');

const FL_API = process.env.FL_API || 'http://localhost:6000';

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
 * @desc    Get FL training analytics
 * @route   GET /api/federated-learning/analytics
 * @access  Private/Admin
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

module.exports = {
  initiateRound,
  getAllRounds,
  getRoundDetails,
  updateClientResults,
  completeRound,
  getAnalytics
};
