/**
 * Database Connection Configuration
 * PostgreSQL: User authentication and authorization
 * MongoDB: Predictions, Federated Learning, and other data
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');

let mongoConnection = null;
let postgresConnection = null;

const connectPostgres = async () => {
  try {
    // Option 1: Use connection string (NeonDB)
    const connectionString = process.env.PG_CONNECTION_STRING;
    
    if (connectionString) {
      postgresConnection = new Sequelize(connectionString, {
        dialect: 'postgres',
        logging: false,
        ssl: true,
        native: false,
      });
    } else {
      // Option 2: Use individual components
      const PG_USER = process.env.PG_USER || 'postgres';
      const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
      const PG_HOST = process.env.PG_HOST || 'localhost';
      const PG_PORT = process.env.PG_PORT || 5432;
      const PG_DATABASE = process.env.PG_DATABASE || 'skin_cancer_db';

      postgresConnection = new Sequelize(PG_DATABASE, PG_USER, PG_PASSWORD, {
        host: PG_HOST,
        port: PG_PORT,
        dialect: 'postgres',
        logging: false,
        ssl: process.env.NODE_ENV === 'production' ? { require: true } : false,
      });
    }

    await postgresConnection.authenticate();
    await postgresConnection.sync();
    
    console.log('✅ PostgreSQL connected successfully');
    return postgresConnection;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    throw error;
  }
};

const connectMongo = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/skin-cancer-db';
    
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    mongoConnection = mongoose.connection;
    console.log('✅ MongoDB connected successfully');
    return mongoConnection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

const connectDB = async () => {
  try {
    await connectPostgres();
    await connectMongo();
    console.log('✅ All databases connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    if (postgresConnection) {
      await postgresConnection.close();
      console.log('✅ PostgreSQL disconnected');
    }
    if (mongoConnection) {
      await mongoose.disconnect();
      console.log('✅ MongoDB disconnected');
    }
  } catch (error) {
    console.error('❌ Database disconnection error:', error.message);
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  getPostgresConnection: () => postgresConnection,
  getMongoConnection: () => mongoConnection,
};
