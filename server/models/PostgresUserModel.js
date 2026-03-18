/**
 * PostgreSQL User Model
 * Handles authentication and authorization
 */

const { DataTypes } = require('sequelize');
const { getPostgresConnection } = require('../config/database');

const createUserModel = () => {
  const sequelize = getPostgresConnection();
  
  if (!sequelize) {
    throw new Error('PostgreSQL connection not initialized');
  }

  const User = sequelize.define('User', {
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
      validate: {
        isEmail: true,
      },
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
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  });

  return User;
};

module.exports = { createUserModel };
