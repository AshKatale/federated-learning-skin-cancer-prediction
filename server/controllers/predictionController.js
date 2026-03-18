/**
 * Predictions Controller
 * Handles prediction submissions, history, and result retrieval
 */

const Prediction = require('../models/Prediction');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ML_API = process.env.ML_API || 'http://localhost:5000';

/**
 * @desc    Submit prediction for an image
 * @route   POST /api/predictions/predict
 * @access  Private
 */
const submitPrediction = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    const startTime = Date.now();

    // Send image to ML service
    const formData = new FormData();
    formData.append('image', new Blob([req.file.buffer]), req.file.originalname);

    const mlResponse = await axios.post(`${ML_API}/api/predict`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });

    const processingTime = Date.now() - startTime;

    if (!mlResponse.data.prediction) {
      return res.status(500).json({
        success: false,
        message: 'Prediction failed',
        details: mlResponse.data.error
      });
    }

    // Create prediction record (userId is UUID from PostgreSQL)
    const prediction = new Prediction({
      userId: req.user.id,
      imageFileName: req.file.originalname,
      imageUrl: req.file.path || `uploads/${req.file.filename}`,
      imageSize: req.file.size,
      prediction: {
        className: mlResponse.data.prediction.className || mlResponse.data.prediction.class_name,
        classId: mlResponse.data.prediction.classId || mlResponse.data.prediction.class_id,
        confidence: mlResponse.data.prediction.confidence,
        allProbabilities: mlResponse.data.prediction.allProbabilities || mlResponse.data.prediction.all_probabilities
      },
      gradcamUrl: mlResponse.data.gradCAM?.imageUrl || mlResponse.data.gradcam_url || null,
      gradcamData: mlResponse.data.gradCAM?.heatmapUrl || mlResponse.data.gradcam_data || null,
      riskLevel: mlResponse.data.prediction.riskLevel || 'Low',
      processingTime
    });

    // Save prediction
    await prediction.save();

    res.status(201).json({
      success: true,
      prediction: prediction,
      message: 'Prediction completed successfully'
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Prediction failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get prediction history for current user
 * @route   GET /api/predictions/history
 * @access  Private
 */
const getPredictionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', riskLevel } = req.query;

    // Build filter (userId is UUID from PostgreSQL)
    const filter = { userId: req.user.id };
    if (riskLevel) {
      filter.riskLevel = riskLevel;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get predictions
    const predictions = await Prediction.find(filter)
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Prediction.countDocuments(filter);

    res.status(200).json({
      success: true,
      predictions,
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
      message: 'Failed to fetch prediction history',
      error: error.message
    });
  }
};

/**
 * @desc    Get a specific prediction by ID
 * @route   GET /api/predictions/:id
 * @access  Private
 */
const getPredictionById = async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Prediction not found'
      });
    }

    // Check authorization (userId is UUID string from PostgreSQL)
    if (prediction.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this prediction'
      });
    }

    res.status(200).json({
      success: true,
      prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction',
      error: error.message
    });
  }
};

/**
 * @desc    Batch prediction for multiple images
 * @route   POST /api/predictions/batch
 * @access  Private
 */
const batchPrediction = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    const results = [];

    // Process each image
    for (const file of req.files) {
      try {
        const startTime = Date.now();

        // Send to ML service
        const formData = new FormData();
        formData.append('image', new Blob([file.buffer]), file.originalname);

        const mlResponse = await axios.post(`${ML_API}/api/predict`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        });

        const processingTime = Date.now() - startTime;

        // Create prediction record (userId is UUID from PostgreSQL)
        const prediction = new Prediction({
          userId: req.user.id,
          imageFileName: file.originalname,
          imageUrl: file.path || `uploads/${file.filename}`,
          imageSize: file.size,
          prediction: {
            className: mlResponse.data.prediction.className || mlResponse.data.prediction.class_name,
            classId: mlResponse.data.prediction.classId || mlResponse.data.prediction.class_id,
            confidence: mlResponse.data.prediction.confidence,
            allProbabilities: mlResponse.data.prediction.allProbabilities || mlResponse.data.prediction.all_probabilities
          },
          gradcamUrl: mlResponse.data.gradCAM?.imageUrl || mlResponse.data.gradcam_url || null,
          riskLevel: mlResponse.data.prediction.riskLevel || 'Low',
          processingTime
        });

        await prediction.save();

        results.push({
          success: true,
          prediction,
          filename: file.originalname
        });
      } catch (fileError) {
        results.push({
          success: false,
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Batch prediction failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get prediction statistics for current user
 * @route   GET /api/predictions/stats
 * @access  Private
 */
const getPredictionStats = async (req, res) => {
  try {
    const predictions = await Prediction.find({ userId: req.user.id });

    const stats = {
      total: predictions.length,
      byRiskLevel: {
        Low: predictions.filter(p => p.riskLevel === 'Low').length,
        Medium: predictions.filter(p => p.riskLevel === 'Medium').length,
        High: predictions.filter(p => p.riskLevel === 'High').length
      },
      byClass: {
        akiec: predictions.filter(p => p.prediction.className === 'akiec').length,
        bcc: predictions.filter(p => p.prediction.className === 'bcc').length,
        bkl: predictions.filter(p => p.prediction.className === 'bkl').length,
        df: predictions.filter(p => p.prediction.className === 'df').length,
        mel: predictions.filter(p => p.prediction.className === 'mel').length,
        nv: predictions.filter(p => p.prediction.className === 'nv').length,
        vasc: predictions.filter(p => p.prediction.className === 'vasc').length
      },
      averageConfidence: predictions.length > 0 
        ? (predictions.reduce((acc, p) => acc + p.prediction.confidence, 0) / predictions.length).toFixed(4)
        : 0,
      averageProcessingTime: predictions.length > 0 
        ? Math.round(predictions.reduce((acc, p) => acc + p.processingTime, 0) / predictions.length)
        : 0
    };

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

module.exports = {
  submitPrediction,
  getPredictionHistory,
  getPredictionById,
  batchPrediction,
  getPredictionStats
};
