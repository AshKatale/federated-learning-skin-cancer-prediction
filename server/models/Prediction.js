/**
 * Prediction Model Schema
 * Stores prediction history and results for each user
 */

const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    // User Reference (UUID from PostgreSQL)
    userId: {
      type: String,
      required: true,
      index: true
    },
    
    // Image Information
    imageFileName: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String, // Stored in cloud storage (S3, Azure Blob, etc.)
      required: true
    },
    imageSize: {
      type: Number, // In bytes
      default: 0
    },
    
    // Prediction Results
    prediction: {
      className: {
        type: String,
        enum: ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc'],
        required: true
      },
      classId: {
        type: Number,
        required: true
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        required: true
      },
      // All probabilities for each class
      allProbabilities: {
        akiec: Number,
        bcc: Number,
        bkl: Number,
        df: Number,
        mel: Number,
        nv: Number,
        vasc: Number
      }
    },
    
    // Risk Assessment
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low'
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    // Explainability (Grad-CAM)
    gradcamUrl: {
      type: String, // URL to heatmap image
      default: null
    },
    gradcamData: {
      type: String, // Base64 encoded heatmap
      default: null
    },
    
    // Model Metadata
    modelVersion: {
      type: String,
      default: '1.0.0'
    },
    processingTime: {
      type: Number, // In milliseconds
      default: 0
    },
    
    // Medical Notes
    doctorNotes: {
      type: String,
      default: ''
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedBy: {
      type: String,
      default: null
    },
    
    // Report Generation
    reportGenerated: {
      type: Boolean,
      default: false
    },
    reportUrl: {
      type: String,
      default: null
    },
    
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

// Index for fast queries
predictionSchema.index({ userId: 1, createdAt: -1 });
predictionSchema.index({ 'prediction.className': 1 });
predictionSchema.index({ riskLevel: 1 });

// Method: Calculate risk level based on confidence and class
predictionSchema.methods.calculateRiskLevel = function () {
  const className = this.prediction.className;
  const confidence = this.prediction.confidence;
  
  // High-risk conditions
  const highRiskClasses = ['mel']; // Melanoma is always high risk
  if (highRiskClasses.includes(className)) {
    this.riskLevel = 'High';
    this.riskScore = Math.round(confidence * 100);
    return;
  }
  
  // Medium-risk conditions
  const mediumRiskClasses = ['bcc', 'akiec']; // Basal Cell Carcinoma, Actinic Keratosis
  if (mediumRiskClasses.includes(className)) {
    if (confidence > 0.7) {
      this.riskLevel = 'Medium';
      this.riskScore = Math.round(confidence * 80);
    } else {
      this.riskLevel = 'Low';
      this.riskScore = Math.round(confidence * 40);
    }
    return;
  }
  
  // Low-risk conditions
  this.riskLevel = 'Low';
  this.riskScore = Math.round(confidence * 30);
};

module.exports = mongoose.model('Prediction', predictionSchema);
