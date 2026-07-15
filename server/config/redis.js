import logger from '../utils/logger.js';

let redis = null;
let isConnected = false;
let memoryStore = new Map();
let memoryExpiry = new Map();

const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false' && REDIS_URL;

const cleanupExpiredKeys = () => {
  const now = Date.now();
  for (const [key, expiry] of memoryExpiry) {
    if (expiry <= now) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
    }
  }
};

setInterval(cleanupExpiredKeys, 30000).unref();

const createMemoryAdapter = () => ({
  async get(key) {
    cleanupExpiredKeys();
    if (memoryExpiry.has(key) && memoryExpiry.get(key) <= Date.now()) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
      return null;
    }
    return memoryStore.get(key) ?? null;
  },

  async set(key, value, ...args) {
    memoryStore.set(key, value);
    if (args[0] === 'EX' && args[1] !== undefined && args[1] !== null) {
      const ttlSeconds = Number(args[1]);
      if (ttlSeconds <= 0) {
        memoryStore.delete(key);
        memoryExpiry.delete(key);
      } else {
        memoryExpiry.set(key, Date.now() + ttlSeconds * 1000);
      }
    } else {
      memoryExpiry.delete(key);
    }
    return 'OK';
  },

  async del(...keys) {
    for (const key of keys) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
    }
    return keys.length;
  },

  async incr(key) {
    const val = parseInt(memoryStore.get(key) || '0', 10) + 1;
    memoryStore.set(key, String(val));
    return val;
  },

  async expire(key, seconds) {
    memoryExpiry.set(key, Date.now() + seconds * 1000);
    return 1;
  },

  async ttl(key) {
    if (!memoryExpiry.has(key)) return -1;
    const remaining = Math.ceil((memoryExpiry.get(key) - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  },

  async keys(pattern) {
    cleanupExpiredKeys();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return [...memoryStore.keys()].filter(k => regex.test(k));
  },

  async ping() {
    return 'PONG';
  },

  on() {},
  disconnect() {},

  get status() { return 'ready'; },
});

let adapter = createMemoryAdapter();

const initRedis = async () => {
  if (!REDIS_ENABLED) {
    logger.info('Redis', 'Redis disabled, using in-memory fallback', { url: REDIS_URL || 'not set' });
    adapter = createMemoryAdapter();
    return adapter;
  }

  try {
    const { default: Redis } = await import('ioredis');
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on('connect', () => {
      isConnected = true;
      logger.info('Redis', 'Connected');
    });

    redis.on('error', (err) => {
      if (isConnected) {
        isConnected = false;
        logger.warn('Redis', 'Connection lost, falling back to memory', { error: err.message });
        adapter = createMemoryAdapter();
      }
    });

    redis.on('close', () => {
      isConnected = false;
    });

    await redis.connect();
    adapter = redis;
    return redis;
  } catch (err) {
    logger.warn('Redis', 'Failed to connect, using in-memory fallback', { error: err.message });
    adapter = createMemoryAdapter();
    return adapter;
  }
};

const getRedis = () => adapter;

const isRedisConnected = () => isConnected;

const shutdownRedis = async () => {
  if (redis) {
    try {
      await redis.quit();
    } catch {}
    redis = null;
    isConnected = false;
  }
  memoryStore.clear();
  memoryExpiry.clear();
};

export { initRedis, getRedis, isRedisConnected, shutdownRedis, createMemoryAdapter };
export default adapter;
