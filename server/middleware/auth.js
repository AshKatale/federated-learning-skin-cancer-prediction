/**
 * JWT Authentication Middleware
 * Handles token validation and user authentication
 * Uses PostgreSQL for user lookups
 */

const jwt = require('jsonwebtoken');
const { getPostgresConnection } = require('../config/database');
const { DataTypes } = require('sequelize');

let User = null;

const initializeUserModel = () => {
  if (!User) {
    const sequelize = getPostgresConnection();
    
    User = sequelize.define('User', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        lowercase: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      gender: {
        type: DataTypes.ENUM('male', 'female', 'other'),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('user', 'doctor', 'admin'),
        defaultValue: 'user',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    }, {
      tableName: 'users',
      timestamps: true,
      underscored: true,
    });
  }
  return User;
};

/**
 * Middleware: Verify JWT token
 */
const protectRoute = async (req, res, next) => {
  try {
    User = initializeUserModel();
    
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = await User.findByPk(decoded.id);

    if (!req.user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      error: error.message
    });
  }
};

/**
 * Middleware: Check if user has specific role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

/**
 * Utility: Generate JWT token
 */
const generateToken = (userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
  return token;
};

/**
 * Utility: Verify JWT token (without middleware)
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = {
  protectRoute,
  authorize,
  generateToken,
  verifyToken
};
