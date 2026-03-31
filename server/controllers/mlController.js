/**
 * ML Model Training Controller
 * Handles model training, aggregation, and central model management
 * supports distributed training with model averaging (FedAvg for ML models)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const MLModel = require('../models/MLModel');
const Prediction = require('../models/Prediction');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const ML_PATH = path.join(__dirname, '../../ml-model');
const MODELS_DIR = path.join(ML_PATH, 'models');

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

/**
 * TRAIN ML MODEL ENDPOINT
 * Triggers distributed training across multiple clients/datasets
 * @route POST /api/ml/train
 * @access Private/Admin
 */
const trainMLModel = async (req, res) => {
  try {
    const { 
      modelName = 'skin_cancer_model', 
      epochs = 5, 
      batchSize = 32, 
      learningRate = 0.001,
      datasetType = 'full', // 'sample' or 'full'
      useAggregation = true // Use model averaging from multiple training runs
    } = req.body;

    console.log(`[ML] Starting training: ${modelName}, epochs=${epochs}`);

    // Create training record
    const trainRecord = await MLModel.create({
      modelName,
      version: `v${Date.now()}`,
      status: 'initiating',
      trainingParams: {
        epochs,
        batchSize,
        learningRate,
        datasetType
      },
      startTime: new Date()
    });

    // Start training in background
    _triggerMLTraining(
      trainRecord._id,
      modelName,
      epochs,
      batchSize,
      learningRate,
      datasetType,
      useAggregation
    );

    res.json({
      success: true,
      message: 'ML model training initiated',
      training_id: trainRecord._id,
      model_name: modelName,
      status: 'training_started'
    });
  } catch (error) {
    console.error('[ML] Training error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start ML training',
      error: error.message
    });
  }
};

/**
 * GET TRAINING STATUS
 * @route GET /api/ml/train/:trainingId
 * @access Private
 */
const getTrainingStatus = async (req, res) => {
  try {
    const { trainingId } = req.params;

    const record = await MLModel.findById(trainingId);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Training record not found'
      });
    }

    res.json({
      success: true,
      training_id: record._id,
      status: record.status,
      modelName: record.modelName,
      version: record.version,
      startTime: record.startTime,
      endTime: record.endTime,
      duration: record.duration,
      metrics: record.metrics,
      accuracy: record.accuracy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get training status',
      error: error.message
    });
  }
};

/**
 * AGGREGATE MODELS
 * Averages weights from multiple trained models (federated averaging)
 * @route POST /api/ml/aggregate
 * @access Private/Admin
 */
const aggregateModels = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Model aggregation endpoint is not implemented',
    note: 'Use federated learning server at fl-server/ for aggregation operations'
  });
};

/**
 * GET CENTRAL MODEL INFO
 * Returns the current active central model for predictions
 * @route GET /api/ml/central-model
 * @access Public
 */
const getCentralModel = async (req, res) => {
  try {
    // Get the latest active model
    const centralModel = await MLModel.findOne({
      status: 'active',
      isAggregated: true
    }).sort({ updatedAt: -1 });

    if (!centralModel) {
      return res.status(404).json({
        success: false,
        message: 'No active central model found'
      });
    }

    res.json({
      success: true,
      model: {
        version: centralModel.version,
        name: centralModel.modelName,
        accuracy: centralModel.accuracy,
        createdAt: centralModel.createdAt,
        aggregatedFrom: centralModel.aggregatedFrom,
        architectureInfo: {
          baseModel: 'EfficientNet-B0',
          numClasses: 7,
          classes: [
            'Actinic Keratosis',
            'Basal Cell Carcinoma',
            'Benign Keratosis',
            'Dermatofibroma',
            'Melanoma',
            'Nevus',
            'Vascular'
          ]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get central model',
      error: error.message
    });
  }
};

/**
 * GET ALL TRAINED MODELS
 * @route GET /api/ml/models
 * @access Private
 */
const getAllModels = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const models = await MLModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MLModel.countDocuments(filter);

    res.json({
      success: true,
      models,
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
      message: 'Failed to get models',
      error: error.message
    });
  }
};

/**
 * ACTIVATE MODEL
 * Sets a trained model as the active central model for predictions
 * @route PUT /api/ml/models/:modelId/activate
 * @access Private/Admin
 */
const activateModel = async (req, res) => {
  try {
    const { modelId } = req.params;

    // Deactivate previous active model
    await MLModel.updateMany(
      { status: 'active' },
      { status: 'archived' }
    );

    // Activate new model
    const model = await MLModel.findByIdAndUpdate(
      modelId,
      { 
        status: 'active',
        activatedAt: new Date()
      },
      { new: true }
    );

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    console.log(`[ML] Model ${model.version} activated`);

    res.json({
      success: true,
      message: 'Model activated successfully',
      model: {
        version: model.version,
        accuracy: model.accuracy,
        activatedAt: model.activatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to activate model',
      error: error.message
    });
  }
};

// ============================================================================
// BACKGROUND FUNCTIONS
// ============================================================================

/**
 * Trigger ML training process
 * Runs training script and collects results
 */
async function _triggerMLTraining(
  recordId,
  modelName,
  epochs,
  batchSize,
  learningRate,
  datasetType,
  useAggregation
) {
  try {
    await MLModel.findByIdAndUpdate(recordId, { status: 'training' });

    // Spawn training process with unbuffered output
    const trainProcess = spawn('python', ['-u', 'train_model.py'], {
      cwd: ML_PATH,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1', // Disable Python output buffering
        CUDA_VISIBLE_DEVICES: '0', // Use first GPU if available
        TORCH_HOME: ML_PATH,
        EPOCHS: epochs,
        BATCH_SIZE: batchSize,
        LEARNING_RATE: learningRate,
        DATASET_TYPE: datasetType
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let trainedModelPath = null;

    trainProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`[ML Training] ${output}`);
      
      // Parse model path from output
      if (output.includes('MODEL_SAVED:')) {
        trainedModelPath = output.split('MODEL_SAVED:')[1].trim();
      }
    });

    trainProcess.stderr.on('data', (data) => {
      console.log(`[ML Training Error] ${data}`);
    });

    trainProcess.on('close', async (code) => {
      if (code === 0) {
        console.log(`[ML] Training completed successfully`);

        const metrics = {
          trainingTime: Date.now(),
          GPU: 'Available',
          batchSize,
          learningRate
        };

        // Get training metrics from saved file
        const metricsFile = path.join(ML_PATH, 'models', 'latest_metrics.json');
        if (fs.existsSync(metricsFile)) {
          const savedMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
          Object.assign(metrics, savedMetrics);
        }

        // Update record with success
        await MLModel.findByIdAndUpdate(recordId, {
          status: 'completed',
          endTime: new Date(),
          duration: Math.floor((Date.now() - recordId.createdAt) / 1000),
          modelPath: trainedModelPath || `${MODELS_DIR}/latest_model.pth`,
          metrics,
          accuracy: metrics.accuracy || 0
        });

        // If aggregation enabled, aggregate this model with recent ones
        if (useAggregation) {
          _aggregateWithRecent(recordId);
        }
      } else {
        console.error(`[ML] Training failed with code ${code}`);
        await MLModel.findByIdAndUpdate(recordId, {
          status: 'failed',
          endTime: new Date()
        });
      }
    });
  } catch (error) {
    console.error('[ML] Training trigger error:', error);
    await MLModel.findByIdAndUpdate(recordId, {
      status: 'failed',
      error: error.message
    });
  }
}

/**
 * Model Aggregation - DEPRECATED
 * The federated-learning folder has been removed.
 * For model aggregation, use the federated learning server at fl-server/
 */

/**
 * Automatically aggregate newly trained model with recent ones
 */
async function _aggregateWithRecent(newModelId) {
  try {
    // Get last 3 completed models
    const recentModels = await MLModel.find({
      status: 'completed',
      isAggregated: false,
      _id: { $ne: newModelId }
    })
      .sort({ createdAt: -1 })
      .limit(2);

    if (recentModels.length > 0) {
      const modelsToAggregate = [
        newModelId.toString(),
        ...recentModels.map(m => m._id.toString())
      ];

      console.log(`[ML] Auto-aggregating with ${recentModels.length} recent models`);
      
      // Create aggregation request
      const aggregateRecord = await MLModel.create({
        modelName: 'aggregated_skin_cancer_model',
        version: `aggregated_auto_v${Date.now()}`,
        status: 'aggregating',
        aggregatedFrom: modelsToAggregate,
        startTime: new Date()
      });

      console.log('[ML] Auto-aggregation skipped - use fl-server for aggregation');
    }
  } catch (error) {
    console.error('[ML] Auto-aggregation error:', error);
  }
}

module.exports = {
  trainMLModel,
  getTrainingStatus,
  aggregateModels,
  getCentralModel,
  getAllModels,
  activateModel
};
