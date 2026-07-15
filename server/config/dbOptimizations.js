import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const TTL_CONFIGS = {
  Otp: { field: 'expiresAt', seconds: 0 },
  AuditLog: { field: 'createdAt', seconds: 365 * 24 * 60 * 60 },
};

const applyTTLIndexes = async () => {
  for (const [collection, config] of Object.entries(TTL_CONFIGS)) {
    try {
      const model = mongoose.model(collection);
      if (model) {
        await model.collection.createIndex(
          { [config.field]: 1 },
          { expireAfterSeconds: config.seconds, background: true }
        );
        logger.info('Database', `TTL index applied on ${collection}.${config.field}`);
      }
    } catch (err) {
      if (err.code !== 85) {
        logger.warn('Database', `TTL index on ${collection} skipped`, { error: err.message });
      }
    }
  }
};

const createCompoundIndexes = async () => {
  const indexes = [
    { collection: 'estimates', index: { status: 1, createdAt: -1 }, name: 'status_created' },
    { collection: 'estimates', index: { managerId: 1, status: 1 }, name: 'manager_status' },
    { collection: 'estimates', index: { region: 1, zone: 1, status: 1 }, name: 'location_status' },
    { collection: 'estimatemovements', index: { estimateId: 1, createdAt: -1 }, name: 'estimate_timeline' },
    { collection: 'auditlogs', index: { userId: 1, createdAt: -1 }, name: 'user_audit' },
    { collection: 'auditlogs', index: { entity: 1, entityId: 1, createdAt: -1 }, name: 'entity_audit' },
    { collection: 'otps', index: { managerId: 1, verified: 1, expiresAt: -1 }, name: 'otp_lookup' },
    { collection: 'notifications', index: { userId: 1, read: 1, createdAt: -1 }, name: 'notification_lookup' },
  ];

  for (const { collection, index, name } of indexes) {
    try {
      await mongoose.connection.db.collection(collection).createIndex(index, { name, background: true });
    } catch (err) {
      if (err.code !== 85) {
        logger.debug('Database', `Index ${name} on ${collection} skipped`, { error: err.message });
      }
    }
  }
};

export const applyDatabaseOptimizations = async () => {
  if (mongoose.connection.readyState !== 1) return;
  await applyTTLIndexes();
  await createCompoundIndexes();
  logger.info('Database', 'Database optimizations applied');
};
