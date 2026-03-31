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

    // Flatten prediction object for frontend
    const flatPrediction = {
      ...prediction.toObject(),
      className: prediction.prediction.className,
      class_name: prediction.prediction.className,
      classId: prediction.prediction.classId,
      class_id: prediction.prediction.classId,
      confidence: prediction.prediction.confidence,
      allProbabilities: prediction.prediction.allProbabilities,
      all_probabilities: prediction.prediction.allProbabilities,
      gradcamData: prediction.gradcamData,
      gradcamUrl: prediction.gradcamUrl
    };

    res.status(201).json({
      success: true,
      prediction: flatPrediction,
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

    // Flatten prediction objects for frontend
    const flatPredictions = predictions.map(pred => ({
      ...pred.toObject(),
      className: pred.prediction.className,
      class_name: pred.prediction.className,
      classId: pred.prediction.classId,
      class_id: pred.prediction.classId,
      confidence: pred.prediction.confidence,
      allProbabilities: pred.prediction.allProbabilities,
      all_probabilities: pred.prediction.allProbabilities,
      gradcamData: pred.gradcamData,
      gradcamUrl: pred.gradcamUrl
    }));

    res.status(200).json({
      success: true,
      data: {
        predictions: flatPredictions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
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

    // Flatten prediction object for frontend
    const flatPrediction = {
      ...prediction.toObject(),
      className: prediction.prediction.className,
      class_name: prediction.prediction.className,
      classId: prediction.prediction.classId,
      class_id: prediction.prediction.classId,
      confidence: prediction.prediction.confidence,
      allProbabilities: prediction.prediction.allProbabilities,
      all_probabilities: prediction.prediction.allProbabilities,
      gradcamData: prediction.gradcamData,
      gradcamUrl: prediction.gradcamUrl
    };

    res.status(200).json({
      success: true,
      prediction: flatPrediction
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
      totalPredictions: predictions.length,
      total: predictions.length,
      byRiskLevel: {
        Low: { count: predictions.filter(p => p.riskLevel === 'Low').length },
        Medium: { count: predictions.filter(p => p.riskLevel === 'Medium').length },
        High: { count: predictions.filter(p => p.riskLevel === 'High').length }
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
        ? parseFloat((predictions.reduce((acc, p) => acc + p.prediction.confidence, 0) / predictions.length).toFixed(4))
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

/**
 * @desc    Predict using trained Federated Learning model
 * @route   POST /api/predictions/fl/predict
 * @access  Private
 */
const predictWithFLModel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    const { modelRound } = req.body;
    const startTime = Date.now();

    // Save the uploaded file temporarily
    const tempFilePath = path.join('./uploads', `temp_${Date.now()}_${req.file.originalname}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    try {
      // Call Python Flask service for FL model inference
      const formData = new FormData();
      formData.append('image', new Blob([req.file.buffer]), req.file.originalname);
      if (modelRound) {
        formData.append('model_round', modelRound);
      }

      const flInferenceAPI = process.env.FL_INFERENCE_API || 'http://localhost:5001';
      const flResponse = await axios.post(`${flInferenceAPI}/api/fl-predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      const processingTime = Date.now() - startTime;

      if (!flResponse.data.success) {
        return res.status(500).json({
          success: false,
          message: 'FL Model prediction failed',
          details: flResponse.data.error
        });
      }

      const predictionData = flResponse.data.result;

      // Create prediction record
      const prediction = new Prediction({
        userId: req.user.id,
        imageFileName: req.file.originalname,
        imageUrl: `uploads/${req.file.filename}`,
        imageSize: req.file.size,
        prediction: {
          className: predictionData.predicted_class_name,
          classId: predictionData.predicted_class,
          confidence: predictionData.confidence,
          allProbabilities: predictionData.all_probabilities
        },
        modelType: 'federated-learning',
        modelRound: predictionData.model_round,
        riskLevel: predictionData.confidence > 0.8 ? 'High' : predictionData.confidence > 0.6 ? 'Medium' : 'Low',
        processingTime
      });

      await prediction.save();

      res.status(201).json({
        success: true,
        prediction: prediction,
        modelInfo: {
          type: 'federated-learning',
          round: predictionData.model_round,
          device: predictionData.device
        },
        message: 'FL Model prediction completed successfully'
      });
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    console.error('FL Model prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'FL Model prediction failed',
      error: error.message
    });
  }
};

/**
 * @desc    Get FL Model information
 * @route   GET /api/predictions/fl/info
 * @access  Private
 */
const getFLModelInfo = async (req, res) => {
  try {
    const flInferenceAPI = process.env.FL_INFERENCE_API || 'http://localhost:5001';
    
    const response = await axios.get(`${flInferenceAPI}/api/fl-model-info`, {
      timeout: 5000
    });

    res.status(200).json({
      success: true,
      modelInfo: response.data
    });
  } catch (error) {
    console.error('Failed to get FL model info:', error);
    
    // Return default info if API is unavailable
    res.status(200).json({
      success: true,
      modelInfo: {
        model_type: 'EfficientNet-B0',
        num_classes: 7,
        class_names: ['Actinic Keratosis', 'Basal Cell Carcinoma', 'Benign Keratosis',
                     'Dermatofibroma', 'Melanoma', 'Nevus', 'Vascular'],
        trained_round: 'unknown',
        device: 'unknown',
        available: false,
        error: error.message
      }
    });
  }
};

module.exports = {
  submitPrediction,
  getPredictionHistory,
  getPredictionById,
  batchPrediction,
  getPredictionStats,
  predictWithFLModel,
  getFLModelInfo
}
