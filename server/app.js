import { timingSafeEqual } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { DEFAULT_DATASET_ID } from '../shared/classroomDataset.js';
import { loadConfig } from './config.js';
import { getClassroomView, getDatasetQuality } from './datasets/registry.js';
import { monitoringPage } from './monitoring/page.js';
import { createMonitoringStore } from './monitoring/store.js';

export const ALLOWED_EVENT_NAMES = [
  'page_view',
  'policy_selected',
  'borderline_cases_opened',
  'student_selected',
  'counterfactual_flipped',
  'language_changed',
  'theme_changed',
];

const bearerToken = (authorization = '') => (
  authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
);

const tokensMatch = (supplied, expected) => {
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
};

const normalizeOrigin = (origin) => origin?.replace(/\/$/, '');

export const buildApp = async (options = {}) => {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: options.logger ?? {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'headers.authorization'],
    },
    logController: new LogController({ disableRequestLogging: true }),
    ajv: {
      customOptions: { removeAdditional: false },
    },
  });
  const store = options.monitoringStore ?? createMonitoringStore({
    databasePath: config.monitoringDbPath,
    retentionDays: config.monitoringRetentionDays,
  });
  const allowedOrigins = new Set(config.allowedOrigins.map(normalizeOrigin));
  const isDevelopmentLoopback = (origin) => (
    config.nodeEnv !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  );

  await app.register(cors, {
    origin(origin, callback) {
      const normalized = normalizeOrigin(origin);
      callback(null, !origin || allowedOrigins.has(normalized) || isDevelopmentLoopback(normalized));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  await app.register(rateLimit, { global: false });

  app.decorateRequest('metricStartedAt', null);
  app.addHook('onRequest', async (request) => {
    request.metricStartedAt = process.hrtime.bigint();
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    return payload;
  });
  app.addHook('onResponse', async (request, reply) => {
    try {
      if (typeof request.metricStartedAt !== 'bigint') return;
      const elapsed = Number(process.hrtime.bigint() - request.metricStartedAt) / 1_000_000;
      store.recordRequest({
        route: request.routeOptions?.url ?? 'unmatched',
        method: request.method,
        statusCode: reply.statusCode,
        durationMs: elapsed,
      });
    } catch (error) {
      app.log.error({ errorMessage: error.message }, 'Unable to store request metric');
    }
  });

  app.get('/healthz', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return {
      status: 'ok',
      service: 'counterlens-api',
      schemaVersion: 1,
      time: new Date().toISOString(),
    };
  });

  app.get('/api/v1/classroom-view/:datasetId', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    schema: {
      params: {
        type: 'object',
        additionalProperties: false,
        required: ['datasetId'],
        properties: {
          datasetId: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[a-z0-9-]+$' },
        },
      },
    },
  }, async (request, reply) => {
    const view = getClassroomView(request.params.datasetId);
    if (!view) {
      return reply.code(404).send({ error: 'dataset_not_found', message: 'Classroom dataset not found.' });
    }
    reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return view;
  });

  app.post('/api/v1/events', {
    config: { rateLimit: { max: 90, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'datasetId', 'datasetVersion', 'policyId', 'locale', 'theme'],
        properties: {
          name: { type: 'string', enum: ALLOWED_EVENT_NAMES },
          datasetId: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[a-z0-9-]+$' },
          datasetVersion: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9._-]+$' },
          policyId: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[a-z0-9-]+$' },
          locale: { type: 'string', enum: ['en', 'zh', 'es'] },
          theme: { type: 'string', enum: ['light', 'graphite', 'summer'] },
        },
      },
    },
  }, async (request, reply) => {
    const view = getClassroomView(request.body.datasetId);
    if (
      !view ||
      view.dataset.version !== request.body.datasetVersion ||
      !view.policies.some((policy) => policy.id === request.body.policyId)
    ) {
      return reply.code(400).send({
        error: 'unknown_release_context',
        message: 'The event does not match a published dataset and policy version.',
      });
    }
    store.recordEvent(request.body);
    reply.header('Cache-Control', 'no-store');
    return reply.code(202).send({ accepted: true });
  });

  app.get('/monitoring', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    );
    return reply.type('text/html; charset=utf-8').send(monitoringPage);
  });

  app.get('/api/v1/monitoring/summary', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          windowHours: { type: 'integer', minimum: 1, maximum: 168, default: 24 },
        },
      },
    },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!config.monitoringToken) {
      return reply.code(503).send({
        error: 'monitoring_disabled',
        message: 'Set MONITORING_TOKEN on the server to enable monitoring access.',
      });
    }
    if (!tokensMatch(bearerToken(request.headers.authorization), config.monitoringToken)) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid monitoring token.' });
    }

    return store.getSummary({
      windowHours: request.query.windowHours ?? 24,
      datasetQuality: getDatasetQuality(DEFAULT_DATASET_ID),
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'invalid_request', message: 'The request did not match the API contract.' });
    }
    app.log.error({ requestId: request.id, errorMessage: error.message }, 'Unhandled API error');
    return reply.code(500).send({ error: 'internal_error', message: 'The server could not complete the request.' });
  });

  app.addHook('onClose', async () => {
    store.close();
  });

  return app;
};
