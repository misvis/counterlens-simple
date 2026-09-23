const parsePositiveInteger = (value, fallback, name) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const parseOrigins = (value) => {
  const defaults = ['http://localhost:5173', 'https://misvis.github.io'];
  if (!value) return defaults;
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

export const loadConfig = (env = process.env) => ({
  host: env.HOST || '127.0.0.1',
  port: parsePositiveInteger(env.PORT, 8787, 'PORT'),
  nodeEnv: env.NODE_ENV || 'development',
  logLevel: env.LOG_LEVEL || 'info',
  allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
  monitoringToken:
    env.MONITORING_TOKEN ||
    (env.NODE_ENV === 'production' ? '' : 'counterlens-local-demo'),
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongoDbName: env.MONGODB_DB || 'counterlens_demo',
  consoleUrl: env.CONSOLE_URL || 'http://localhost:5173/?view=console',
  monitoringRetentionDays: parsePositiveInteger(
    env.MONITORING_RETENTION_DAYS,
    30,
    'MONITORING_RETENTION_DAYS',
  ),
});
