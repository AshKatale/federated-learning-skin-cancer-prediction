/**
 * Federated Learning Round Model
 * Tracks federated learning training rounds and aggregations
 */

const mongoose = require('mongoose');

const federatedLearningSchema = new mongoose.Schema(
  {
    // Round Information
    roundNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['initiated', 'in-progress', 'completed', 'failed'],
      default: 'initiated'
    },
    
    // Global Model
    globalModelVersion: {
      type: String,
      required: true
    },
    globalWeightsUrl: {
      type: String, // URL to stored model weights
      default: null
    },
    globalWeightsHash: {
      type: String, // For data integrity verification
      default: null
    },
    
    // Round Metadata
    roundStartTime: {
      type: Date,
      default: Date.now
    },
    roundEndTime: {
      type: Date,
      default: null
    },
    roundDuration: {
      type: Number, // In seconds
      default: 0
    },
    
    // Client Participation
    totalClients: {
      type: Number,
      default: 0
    },
    participatingClients: {
      type: Number,
      default: 0
    },
    clientList: [
      {
        clientId: String,
        clientName: String,
        status: {
          type: String,
          enum: ['invited', 'accepted', 'trained', 'failed'],
          default: 'invited'
        },
        samplesUsed: Number,
        trainingTime: Number, // In seconds
        localModelPerformance: {
          accuracy: Number,
          loss: Number,
          f1Score: Number
        },
        parametersHash: String // Hash of trained parameters
      }
    ],
    
    // Aggregation Results
    aggregationMethod: {
      type: String,
      enum: ['FedAvg', 'FedProx', 'FedAdam'],
      default: 'FedAvg'
    },
    aggregationStrategy: {
      weightedByDataSize: {
        type: Boolean,
        default: true
      },
      learningRate: {
        type: Number,
        default: 0.01
      },
      momentum: {
        type: Number,
        default: 0.9
      }
    },
    
    // Global Model Performance
    globalModelPerformance: {
      accuracy: Number,
      loss: Number,
      precision: Number,
      recall: Number,
      f1Score: Number,
      evaluationTime: Number, // In milliseconds
      testSize: Number
    },
    
    // Privacy Metrics
    dpEpsilon: {
      type: Number, // Differential Privacy epsilon
      default: null
    },
    dpDelta: {
      type: Number,
      default: null
    },
    encryptionEnabled: {
      type: Boolean,
      default: false
    },
    secureAggregationUsed: {
      type: Boolean,
      default: false
    },
    
    // Quality Metrics
    convergenceGap: Number, // Difference from previous round
    isConverged: {
      type: Boolean,
      default: false
    },
    
    // Error Handling
    errors: [
      {
        clientId: String,
        error: String,
        timestamp: Date
      }
    ],
    
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('FederatedLearning', federatedLearningSchema);
