import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await buildApp({ config });

const shutdown = async (signal) => {
  app.log.info({ signal }, 'Shutting down CounterLens API');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
  if (!config.monitoringToken) {
    app.log.warn('Monitoring dashboard data is disabled until MONITORING_TOKEN is configured.');
  }
} catch (error) {
  app.log.error({ errorMessage: error.message }, 'CounterLens API failed to start');
  await app.close();
  process.exit(1);
}
