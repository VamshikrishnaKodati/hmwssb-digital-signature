import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please configure them in the .env file before starting the server.');
  process.exit(1);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  console.error('Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

import app from './app.js';
import { connectDB } from './config/db.js';
import { applyDatabaseOptimizations } from './config/dbOptimizations.js';
import { seedUsers } from './controllers/authController.js';
import { seedItems } from './controllers/itemController.js';
import { seedHierarchy } from './controllers/seedHierarchy.js';
import { cleanupExpiredOtps } from './services/otpService.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  const db = await connectDB();

  if (db) {
    await seedUsers();
    await seedItems();
    await seedHierarchy();
    await applyDatabaseOptimizations();
    logger.info('Server', 'Database seeded and optimized');

    setInterval(cleanupExpiredOtps, 60 * 60 * 1000);
  } else {
    logger.warn('Server', 'Starting without database connection');
  }

  app.listen(PORT, () => {
    logger.info('Server', `Server running on port ${PORT}`, {
      environment: process.env.NODE_ENV || 'development',
      database: db ? 'connected' : 'disconnected',
    });
  });
};

start().catch(err => {
  logger.error('Server', 'Failed to start server', { error: err.message });
  process.exit(1);
});
