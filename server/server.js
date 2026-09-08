require('dotenv').config();
const app = require('./app');
const { startSlaChecker } = require('./jobs/sla-checker');

const PORT = process.env.PORT || 5001;

process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled promise rejection:`, reason);
});

process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception:`, err);
});

app.listen(PORT, () => {
  console.log(`HMWSSB server running on port ${PORT}`);
  startSlaChecker();
});
