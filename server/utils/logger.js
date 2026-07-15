const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;

const timestamp = () => new Date().toISOString();

const formatMessage = (level, module, message, meta) => {
  const base = `[${timestamp()}] [${level.toUpperCase()}] [${module}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
};

const sanitizeMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return meta;
  const sensitive = ['password', 'token', 'otp', 'otpHash', 'secret', 'authorization'];
  const cleaned = { ...meta };
  for (const key of Object.keys(cleaned)) {
    if (sensitive.includes(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    }
  }
  return cleaned;
};

const logger = {
  error: (module, message, meta) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(formatMessage('error', module, message, sanitizeMeta(meta)));
    }
  },
  warn: (module, message, meta) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', module, message, sanitizeMeta(meta)));
    }
  },
  info: (module, message, meta) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(formatMessage('info', module, message, sanitizeMeta(meta)));
    }
  },
  debug: (module, message, meta) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', module, message, sanitizeMeta(meta)));
    }
  },
};

export default logger;
