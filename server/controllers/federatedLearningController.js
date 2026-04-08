/**
 * Federated Learning Controller (server-side)
 *
 * Responsibilities:
 *  - Store/query round metadata in MongoDB for admin dashboard
 *  - Record when a client submits weights (no weights pass through here)
 *  - Proxy FL server status for the dashboard
 *
 * What this does NOT do:
 *  - Spawn Python processes
 *  - Handle model weights
 *  - Start/stop FL training
 */

const axios = require('axios');
const FederatedLearning = require('../models/FederatedLearning');

const FL_SERVER = process.env.FL_SERVER_URL || 'http://localhost:6000';

/**
 * Admin: create a new round record in the DB and notify FL server to start training.
 * No weights are involved — this is metadata only.
 */
const initiateRound = async (req, res) => {
  try {
    let { clientList = [] } = req.body;

    // If no explicit client list provided, auto-discover all unique clients from previous rounds
    if (clientList.length === 0) {
      const allRounds = await FederatedLearning.find({}).sort({ roundNumber: -1 });
      const uniqueClients = new Set();
      
      allRounds.forEach(round => {
        if (round.clientList && Array.isArray(round.clientList)) {
          round.clientList.forEach(client => {
            if (client.clientId) uniqueClients.add(client.clientId);
          });
        }
      });
      
      clientList = Array.from(uniqueClients);
      console.log(`[FL] Auto-discovered ${clientList.length} unique clients:`, clientList);
    }

    if (clientList.length === 0) {
      return res.status(400).json({ success: false, message: 'No clients to invite. Please specify clientList or previous rounds must exist.' });
    }

    // Get current highest round number
    const last = await FederatedLearning.findOne({}).sort({ roundNumber: -1 });
    const nextRound = last ? last.roundNumber + 1 : 1;

    // Get the previous round's global model version or start with 1.0.0
    const previousRound = last ? last.globalModelVersion : '0.0.0';
    const versionParts = previousRound.split('.').map(Number);
    versionParts[1]++; // Increment minor version
    const newVersion = versionParts.join('.');

    const round = await FederatedLearning.create({
      roundNumber: nextRound,
      status: 'initiated',
      globalModelVersion: newVersion,
      roundStartTime: new Date(),
      clientList: clientList.map((id) => ({ clientId: id, status: 'invited' })),
      participatingClients: clientList.length,
      totalClients: clientList.length,
      aggregationMethod: 'FedAvg'
    });

    // Notify FL server to initiate training for this round
    try {
      const flServerUrl = process.env.FL_SERVER_URL || 'http://localhost:6000';
      const flRes = await axios.post(`${flServerUrl}/api/round/initiate-training`, {}, { timeout: 5000 });
      console.log('[FL Server Response]', flRes.data);
    } catch (flError) {
      console.error('Warning: Could not notify FL server:', flError.message);
      // Don't fail the round creation if FL server is unreachable
    }

    res.status(201).json({ success: true, round });
  } catch (e) {
    console.error('Error initiating round:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

const getAllRounds = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = status ? { status } : {};
    const [rounds, total] = await Promise.all([
      FederatedLearning.find(filter)
        .sort({ roundNumber: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      FederatedLearning.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        rounds,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getRoundDetails = async (req, res) => {
  try {
    const round = await FederatedLearning.findById(req.params.id);
    if (!round) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, round });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTrainingStatus = async (req, res) => {
  try {
    // Proxy real-time status from FL server
    const resp = await axios.get(`${FL_SERVER}/api/round/status`, { timeout: 5000 });
    res.json({ success: true, ...resp.data });
  } catch (e) {
    // Fallback to DB record
    const record = await FederatedLearning.findById(req.params.trainingId);
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, status: record.status, round: record.roundNumber });
  }
};

const getAnalytics = async (req, res) => {
  try {
    // Get both completed AND active rounds for complete analytics
    const allRounds = await FederatedLearning.find({}).sort({ roundNumber: -1 });
    const completedRounds = allRounds.filter(r => r.status === 'completed');
    const activeRound = allRounds.find(r => r.status === 'in-progress' || r.status === 'initiated');
    
    const analytics = {
      totalRounds: allRounds.length,
      completedRounds: completedRounds.length,
      averageAccuracy: completedRounds.length
        ? (completedRounds.reduce((s, r) => s + (r.globalModelPerformance?.accuracy || 0), 0) / completedRounds.length * 100).toFixed(1)
        : 0,
      bestAccuracy: completedRounds.length
        ? (Math.max(...completedRounds.map((r) => r.globalModelPerformance?.accuracy || 0)) * 100).toFixed(1)
        : 0,
      activeClientsCount: activeRound ? (activeRound.totalClients || 0) : 0,
      activeRound: activeRound ? {
        roundNumber: activeRound.roundNumber,
        status: activeRound.status,
        totalClients: activeRound.totalClients || 0,
        participatingClients: activeRound.participatingClients || 0,
        completedClients: (activeRound.clientList || []).filter(c => c.status === 'submitted' || c.status === 'trained').length,
        startTime: activeRound.roundStartTime,
        clients: (activeRound.clientList || []).map(c => ({
          clientId: c.clientId,
          status: c.status,
          samplesUsed: c.samplesUsed || 0,
        }))
      } : null,
      accuracyTrend: completedRounds.map((r) => ({
        round: r.roundNumber,
        accuracy: (r.globalModelPerformance?.accuracy || 0) * 100,
      })),
      lossTrend: completedRounds.map((r) => ({
        round: r.roundNumber,
        loss: r.globalModelPerformance?.loss || 0,
      })),
      clientParticipation: allRounds.map((r) => ({
        round: r.roundNumber,
        clients: r.participatingClients || 0,
      })),
    };
    res.json({ success: true, analytics });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * Desktop client calls this AFTER successfully uploading weights to FL server.
 * We only record metadata – no weight data passes through here.
 */
const recordClientSubmission = async (req, res) => {
  try {
    const { clientId, round, numSamples } = req.body;
    if (!clientId || !round) {
      return res.status(400).json({ success: false, message: 'clientId and round required' });
    }

    // Upsert round record
    await FederatedLearning.findOneAndUpdate(
      { roundNumber: round },
      {
        $setOnInsert: { roundNumber: round, status: 'active', roundStartTime: new Date() },
        $addToSet: {
          clientList: { clientId, status: 'submitted', samplesUsed: numSamples },
        },
        $inc: { participatingClients: 1 },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Submission recorded' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * Called by FL server when a round completes.
 * Updates the round record with accuracy/loss metrics and marks as 'completed'.
 */
const completeRound = async (req, res) => {
  try {
    const { roundNumber, globalModelPerformance = {} } = req.body;
    if (!roundNumber) {
      return res.status(400).json({ success: false, message: 'roundNumber required' });
    }

    const updated = await FederatedLearning.findOneAndUpdate(
      { roundNumber },
      {
        status: 'completed',
        roundEndTime: new Date(),
        globalModelPerformance: {
          accuracy: globalModelPerformance.accuracy || 0,
          loss: globalModelPerformance.loss || 0,
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Round not found' });
    }

    res.json({ success: true, message: 'Round completed', round: updated });
  } catch (e) {
    console.error('Error completing round:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * Admin: Stop an ongoing round
 */
const stopRound = async (req, res) => {
  try {
    const { roundNumber } = req.body;
    if (!roundNumber) {
      return res.status(400).json({ success: false, message: 'roundNumber required' });
    }

    const updated = await FederatedLearning.findOneAndUpdate(
      { roundNumber, status: { $in: ['initiated', 'in-progress'] } },
      {
        status: 'completed',
        roundEndTime: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Round not found or already completed' });
    }

    // Notify FL server to stop this round
    try {
      await axios.post(`${FL_SERVER}/api/round/stop`, { roundNumber }, { timeout: 5000 });
    } catch (err) {
      console.warn('Could not notify FL server to stop round:', err.message);
    }

    res.json({ success: true, message: 'Round stopped', round: updated });
  } catch (e) {
    console.error('Error stopping round:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = {
  getAllRounds,
  getRoundDetails,
  getTrainingStatus,
  getAnalytics,
  recordClientSubmission,
  initiateRound,
  completeRound,
  stopRound,
};
