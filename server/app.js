const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const estimateRoutes = require('./routes/estimates');
const workflowRoutes = require('./routes/workflow');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const lookupsRoutes = require('./routes/lookups');
const exportsRoutes = require('./routes/exports');
const tenderRoutes = require('./routes/tender');
const bidsRoutes = require('./routes/bids');
const agencyRoutes = require('./routes/agency');
const billingRoutes = require('./routes/billing');
const financeRoutes = require('./routes/finance');
const progressRoutes = require('./routes/progress');
const measurementRoutes = require('./routes/measurement');
const dashboardRoutes = require('./routes/dashboard');
const usersRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const deletedEstimateRoutes = require('./routes/deletedEstimates');
const estimateDocumentRoutes = require('./routes/estimateDocuments');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin: (origin, cb) => { if (!origin || allowedOrigins.includes(origin)) cb(null, true); else cb(new Error('Not allowed by CORS')); }, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Single response convention enforced at the API boundary:
//   success -> { success: true, data }
//   failure -> { success: false, error: { code, message } }
const ERROR_CODES = { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'UNPROCESSABLE_ENTITY', 429: 'TOO_MANY_REQUESTS' };
app.use((req, res, next) => {
  const send = res.json.bind(res);
  res.json = (body) => {
    const isError = body && typeof body === 'object' && (body.success === false || 'error' in body);
    if (!isError) return send({ success: true, data: body });
    const e = body.error && typeof body.error === 'object' ? body.error : {};
    const message = typeof body.error === 'string' ? body.error : e.message || body.message || 'Request failed';
    const extra = { ...body };
    delete extra.error;
    delete extra.message;
    delete extra.success;
    delete extra.code;
    return send({ success: false, error: { code: e.code || body.code || ERROR_CODES[res.statusCode] || 'ERROR', message, ...extra } });
  };
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/lookups', lookupsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/tender', tenderRoutes);
app.use('/api/bids', bidsRoutes);
app.use('/api/agency', agencyRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/measurement', measurementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/deleted-estimates', deletedEstimateRoutes);
app.use('/api/estimate-documents', estimateDocumentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SLA checker started from server.js, not here (app.js is imported by tests)

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

module.exports = app;
