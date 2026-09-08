// server/jobs/sla-checker.js
// Background SLA checker — runs every 5 minutes
const { checkSlas } = require('../utils/sla');

let intervalId = null;

function startSlaChecker(intervalMs) {
  if (intervalId) return;
  const ms = intervalMs || parseInt(process.env.SLA_CHECK_INTERVAL_MS || '300000', 10); // 5 min default
  intervalId = setInterval(async () => {
    try {
      const results = await checkSlas();
      if (results.warnings || results.overdue || results.escalated) {
        console.log('[SLA] Check completed:', JSON.stringify(results));
      }
    } catch (err) {
      console.error('[SLA] Check failed:', err.message);
    }
  }, ms);
  console.log('[SLA] Background checker started (interval: ' + ms + 'ms)');
}

function stopSlaChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { startSlaChecker, stopSlaChecker };
