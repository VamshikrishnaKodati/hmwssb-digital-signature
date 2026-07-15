import { getRedis } from '../config/redis.js';
import { isRedisConnected } from '../config/redis.js';
import { getConnectionStatus } from '../config/db.js';
import logger from '../utils/logger.js';

const metrics = {
  counters: {},
  gauges: {},
  histograms: {},
};

const startupTime = Date.now();

export const incCounter = (name, labels = {}, delta = 1) => {
  const key = `${name}:${JSON.stringify(labels)}`;
  metrics.counters[key] = (metrics.counters[key] || 0) + delta;
};

export const setGauge = (name, value, labels = {}) => {
  const key = `${name}:${JSON.stringify(labels)}`;
  metrics.gauges[key] = value;
};

export const observeHistogram = (name, value, labels = {}) => {
  const key = `${name}:${JSON.stringify(labels)}`;
  if (!metrics.histograms[key]) {
    metrics.histograms[key] = { values: [], count: 0, sum: 0, min: Infinity, max: -Infinity };
  }
  const h = metrics.histograms[key];
  h.values.push(value);
  h.count += 1;
  h.sum += value;
  if (value < h.min) h.min = value;
  if (value > h.max) h.max = value;
  if (h.values.length > 1000) {
    h.values = h.values.slice(-500);
  }
};

export const getMetrics = () => {
  const uptimeMs = Date.now() - startupTime;
  const mem = process.memoryUsage();

  const counters = {};
  for (const [key, value] of Object.entries(metrics.counters)) {
    counters[key] = value;
  }

  const gauges = { ...metrics.gauges };
  gauges['system.uptime_ms'] = uptimeMs;
  gauges['system.memory.heap_used_mb'] = Math.round(mem.heapUsed / 1024 / 1024);
  gauges['system.memory.heap_total_mb'] = Math.round(mem.heapTotal / 1024 / 1024);
  gauges['system.memory.rss_mb'] = Math.round(mem.rss / 1024 / 1024);
  gauges['system.memory.external_mb'] = Math.round(mem.external / 1024 / 1024);

  const histograms = {};
  for (const [key, h] of Object.entries(metrics.histograms)) {
    const sorted = [...h.values].sort((a, b) => a - b);
    histograms[key] = {
      count: h.count,
      sum: h.sum,
      avg: h.count > 0 ? h.sum / h.count : 0,
      min: h.min === Infinity ? 0 : h.min,
      max: h.max === -Infinity ? 0 : h.max,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    };
  }

  return { counters, gauges, histograms };
};

export const getHealthStatus = async () => {
  const dbOk = getConnectionStatus();
  const redisOk = isRedisConnected();
  const mem = process.memoryUsage();
  const heapUsedPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  let status = 'healthy';
  const checks = {
    database: { status: dbOk ? 'up' : 'down' },
    redis: { status: redisOk ? 'up' : 'down' },
    memory: { status: heapUsedPercent > 90 ? 'critical' : heapUsedPercent > 75 ? 'warning' : 'ok', heapUsedPercent },
    uptime: { seconds: Math.floor((Date.now() - startupTime) / 1000) },
  };

  if (!dbOk) status = 'degraded';
  if (heapUsedPercent > 90) status = 'degraded';

  return { status, checks, timestamp: new Date().toISOString() };
};

export const formatPrometheus = () => {
  const m = getMetrics();
  const lines = [];

  for (const [key, value] of Object.entries(m.counters)) {
    const safeName = key.replace(/[:".]/g, '_').replace(/_+/g, '_');
    lines.push(`# TYPE ${safeName} counter`);
    lines.push(`${safeName} ${value}`);
  }

  for (const [key, value] of Object.entries(m.gauges)) {
    const safeName = key.replace(/[:".]/g, '_').replace(/_+/g, '_');
    lines.push(`# TYPE ${safeName} gauge`);
    lines.push(`${safeName} ${value}`);
  }

  for (const [key, h] of Object.entries(m.histograms)) {
    const safeName = key.replace(/[:".]/g, '_').replace(/_+/g, '_');
    lines.push(`# TYPE ${safeName} summary`);
    lines.push(`${safeName}_count ${h.count}`);
    lines.push(`${safeName}_sum ${h.sum}`);
    lines.push(`${safeName}{quantile="0.5"} ${h.p50}`);
    lines.push(`${safeName}{quantile="0.95"} ${h.p95}`);
    lines.push(`${safeName}{quantile="0.99"} ${h.p99}`);
  }

  return lines.join('\n') + '\n';
};

export const resetMetrics = () => {
  metrics.counters = {};
  metrics.gauges = {};
  metrics.histograms = {};
};
