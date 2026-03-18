#!/usr/bin/env node

/**
 * Database Initialization Script
 * Initializes PostgreSQL tables and sets up MongoDB collections
 */

require('dotenv').config();
const { connectDB, getPostgresConnection } = require('../config/database');
const { DataTypes } = require('sequelize');

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing databases...\n');

    // Connect to both databases
    await connectDB();

    // Create PostgreSQL User table
    const sequelize = getPostgresConnection();
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

    await sequelize.sync({ alter: true });
    console.log('✅ PostgreSQL User table initialized');

    // MongoDB collections will be created automatically on first insert
    console.log('✅ MongoDB collections ready (auto-created on first insert)');

    console.log('\n✅ All databases initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

initializeDatabase();
