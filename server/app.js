import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import requestLogger from './middleware/requestLogger.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { globalLimiter, authLimiter } from './middleware/rateLimiters.js';
import otpRoutes from './routes/otpRoutes.js';
import authRoutes from './routes/authRoutes.js';
import estimateRoutes from './routes/estimateRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import hierarchyRoutes from './routes/hierarchyRoutes.js';
import signatureRoutes from './routes/signatureRoutes.js';
import { getHealthStatus, getMetrics, formatPrometheus } from './services/monitoringService.js';
import { connectDB, getConnectionStatus } from './config/db.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new AppError('Not allowed by CORS', 403, 'CORS_ERROR'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(requestLogger);
app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);

app.get('/api/health', async (req, res) => {
  const dbStatus = getConnectionStatus();
  const healthCheck = {
    status: dbStatus ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus ? 'connected' : 'disconnected',
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    },
    environment: process.env.NODE_ENV,
  };

  const statusCode = dbStatus ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

app.get('/api/health/detailed', async (req, res) => {
  const health = await getHealthStatus();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.get('/api/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(formatPrometheus());
});

app.get('/api/metrics/json', (req, res) => {
  res.json(getMetrics());
});

app.use('/uploads', authMiddleware, express.static(path.resolve('uploads')));

app.use('/api/otp', otpRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/signatures', signatureRoutes);

app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

app.use(errorHandler);

export default app;
