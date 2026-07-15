import logger from '../utils/logger.js';

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map(e => e.message);
  return new AppError(`Validation failed: ${messages.join(', ')}`, 400, 'VALIDATION_ERROR');
};

const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  return new AppError(`Duplicate value for field: ${field}`, 409, 'DUPLICATE_KEY');
};

const handleCastError = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
};

const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (err.name === 'ValidationError') error = handleValidationError(err);
  else if (err.code === 11000) error = handleDuplicateKeyError(err);
  else if (err.name === 'CastError') error = handleCastError(err);
  else if (err.name === 'JsonWebTokenError') error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  else if (err.name === 'TokenExpiredError') error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  else if (!err.isOperational) error = new AppError('Internal server error', 500, 'INTERNAL_ERROR');

  const statusCode = error.statusCode || 500;
  const logLevel = statusCode >= 500 ? 'error' : 'warn';

  logger[logLevel]('ErrorHandler', `${req.method} ${req.originalUrl} - ${error.message}`, {
    statusCode,
    code: error.code,
    ip: req.ip,
    userId: req.user?.id,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    message: error.isOperational ? error.message : 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export { AppError, errorHandler };
