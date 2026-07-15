import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hmwssb';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let isConnected = false;

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

export const connectDB = async (retryCount = 0) => {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(MONGO_URI, options);
    isConnected = !!db.connections[0].readyState;
    logger.info('DB', `MongoDB connected: ${db.connection.host}/${db.connection.name}`);
    return db;
  } catch (error) {
    logger.error('DB', `MongoDB connection error (attempt ${retryCount + 1}): ${error.message}`);
    isConnected = false;

    if (retryCount < RECONNECT_DELAYS.length) {
      const delay = RECONNECT_DELAYS[retryCount];
      logger.info('DB', `Reconnecting in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB(retryCount + 1);
    }

    logger.error('DB', 'Max reconnect attempts reached.');
    return null;
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('DB', 'MongoDB disconnected');
  isConnected = false;
});

mongoose.connection.on('error', (err) => {
  logger.error('DB', `MongoDB error: ${err.message}`);
  isConnected = false;
});

export const getConnectionStatus = () => isConnected;
