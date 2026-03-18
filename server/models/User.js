/**
 * User Model Schema
 * Stores user authentication and profile information
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // Authentication
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // Don't include password by default
    },
    
    // Profile Information
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      min: 0,
      max: 150
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', null],
      default: null
    },
    
    // Medical Information
    medicalHistory: {
      type: String,
      default: ''
    },
    skinType: {
      type: String,
      enum: ['Dry', 'Oily', 'Combination', 'Sensitive', null],
      default: null
    },
    
    // Role-based Access
    role: {
      type: String,
      enum: ['user', 'doctor', 'admin'],
      default: 'user'
    },
    
    // Organization (for hospitals/clinics)
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null
    },
    
    // Account Status
    isActive: {
      type: Boolean,
      default: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
      select: false
    },
    
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now
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

// Middleware: Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method: Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method: Get user profile (without sensitive data)
userSchema.methods.getProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationToken;
  return userObject;
};

// Virtual: Full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', userSchema);
