import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_ENV = {
  JWT_SECRET: 'Used for authentication tokens. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  MONGO_URI: 'MongoDB connection string. Example: mongodb://localhost:27017/hmwssb',
};

const missing = Object.keys(REQUIRED_ENV).filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('\n========================================');
  console.error('  Missing required environment variables');
  console.error('========================================\n');
  for (const key of missing) {
    console.error(`  ✖ ${key}`);
    console.error(`    ${REQUIRED_ENV[key]}\n`);
  }
  console.error('Fix: Create a .env file in the server/ directory (see .env.example)');
  console.error('     or set these as environment variables.\n');
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('\n========================================');
  console.error('  JWT_SECRET must be at least 32 characters');
  console.error('========================================\n');
  console.error('  Generate a secure secret:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
  process.exit(1);
}

import app from './app.js';
import { connectDB } from './config/db.js';
import { initRedis } from './config/redis.js';
import { applyDatabaseOptimizations } from './config/dbOptimizations.js';
import { seedUsers } from './controllers/authController.js';
import { seedItems } from './controllers/itemController.js';
import { seedHierarchy } from './controllers/seedHierarchy.js';
import { cleanupExpiredOtps } from './services/otpService.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await initRedis();
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
