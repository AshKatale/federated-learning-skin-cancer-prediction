/**
 * ML Model Schema
 * Stores training records, model versions, and aggregation history
 */

const mongoose = require('mongoose');

const mlModelSchema = new mongoose.Schema(
  {
    // Model identification
    modelName: {
      type: String,
      required: true,
      default: 'skin_cancer_model'
    },
    version: {
      type: String,
      required: true,
      unique: true
    },

    // Training information
    status: {
      type: String,
      enum: ['initiating', 'training', 'completed', 'aggregating', 'active', 'archived', 'failed'],
      default: 'initiating',
      index: true
    },
    trainingParams: {
      epochs: Number,
      batchSize: Number,
      learningRate: Number,
      datasetType: {
        type: String,
        enum: ['sample', 'full'],
        default: 'full'
      },
      optimizer: {
        type: String,
        default: 'adam'
      }
    },

    // Timing
    startTime: Date,
    endTime: Date,
    duration: Number, // in seconds

    // Model file path
    modelPath: String,

    // Performance metrics
    accuracy: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    metrics: {
      trainingLoss: Number,
      validationLoss: Number,
      trainingAccuracy: Number,
      validationAccuracy: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
      confusionMatrix: [[Number]], // 7x7 for 7 classes
      GPU: String,
      trainingTime: Number,
      device: String
    },

    // Aggregation info
    isAggregated: {
      type: Boolean,
      default: false,
      index: true
    },
    aggregatedFrom: [String], // Version strings of models that were aggregated
    aggregationMetadata: {
      numModels: Number,
      weights: [Number], // Weight given to each model (default: equal)
      aggregationType: {
        type: String,
        enum: ['simple_average', 'weighted_average', 'fedavg'],
        default: 'simple_average'
      }
    },

    // Model activation
    isActive: {
      type: Boolean,
      default: false,
      index: true
    },
    activatedAt: Date,
    deactivatedAt: Date,

    // Architecture info
    architecture: {
      baseModel: {
        type: String,
        default: 'EfficientNet-B0'
      },
      numClasses: {
        type: Number,
        default: 7
      },
      classNames: {
        type: [String],
        default: [
          'Actinic Keratosis',
          'Basal Cell Carcinoma',
          'Benign Keratosis',
          'Dermatofibroma',
          'Melanoma',
          'Nevus',
          'Vascular'
        ]
      },
      inputSize: {
        type: Number,
        default: 224
      },
      parameters: Number // Total model parameters
    },

    // Error tracking
    error: String,
    errorStack: String,

    // Metadata
    description: String,
    tags: [String],
    author: String,
    notes: String
  },
  {
    timestamps: true,
    collection: 'ml_models'
  }
);

// Index for efficient querying
mlModelSchema.index({ status: 1, createdAt: -1 });
mlModelSchema.index({ version: 1 });
mlModelSchema.index({ isActive: 1, updatedAt: -1 });

// Pre-save middleware to validate
mlModelSchema.pre('save', function(next) {
  // Ensure version is unique
  if (!this.version) {
    this.version = `v${Date.now()}`;
  }
  next();
});

// Static method to get active model
mlModelSchema.statics.getActiveModel = function() {
  return this.findOne({ 
    status: 'active',
    isAggregated: true 
  }).sort({ activatedAt: -1 });
};

// Static method to get recent completed models
mlModelSchema.statics.getRecentModels = function(limit = 5) {
  return this.find({ 
    status: 'completed',
    modelPath: { $exists: true } 
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to calculate aggregation weights
mlModelSchema.methods.calculateWeights = function() {
  if (!this.aggregatedFrom || this.aggregatedFrom.length === 0) return [];
  
  // Equal weights by default
  const numModels = this.aggregatedFrom.length;
  return Array(numModels).fill(1 / numModels);
};

const MLModel = mongoose.model('MLModel', mlModelSchema);

module.exports = MLModel;
