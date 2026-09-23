import { timingSafeEqual } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './config.js';
import { createClassroomStore } from './monitoring/store.js';
import { validateAnswers } from '../shared/questionnaire.js';

export const ALLOWED_EVENT_NAMES = [
  'page_view',
  'policy_selected',
  'borderline_cases_opened',
  'student_selected',
  'counterfactual_flipped',
  'language_changed',
  'theme_changed',
];
const idSchema = {
  type: 'string',
  pattern: '^[a-z0-9-]+$',
  minLength: 1,
  maxLength: 80,
};
const versionSchema = {
  type: 'string',
  pattern: '^[A-Za-z0-9._-]+$',
  minLength: 1,
  maxLength: 80,
};
const localeSchema = { type: 'string', enum: ['en', 'zh', 'es'] };
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

export const buildApp = async (options = {}) => {
  const config = options.config ?? loadConfig();
  if (
    config.monitoringToken === 'counterlens-local-demo' &&
    (config.nodeEnv === 'production' ||
      !['127.0.0.1', 'localhost', '::1'].includes(config.host))
  ) {
    throw new Error(
      'The demo console token is only allowed on a local development listener.',
    );
  }
  const store = options.store ?? (await createClassroomStore(config));
  const app = Fastify({
    logger: options.logger ?? {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'headers.authorization'],
    },
    bodyLimit: 16384,
    logController: new LogController({ disableRequestLogging: true }),
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  app.decorate('classroomStore', store);
  const origins = new Set(
    config.allowedOrigins.map((origin) => origin.replace(/\/$/, '')),
  );
  await app.register(cors, {
    origin(origin, callback) {
      callback(
        null,
        !origin ||
          origins.has(origin.replace(/\/$/, '')) ||
          (config.nodeEnv !== 'production' &&
            /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)),
      );
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  await app.register(rateLimit, { global: false });
  const limited = (max) => ({ rateLimit: { max, timeWindow: '1 minute' } });
  const admin = async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!config.monitoringToken)
      return reply
        .code(503)
        .send({ message: 'Console access is not configured.' });
    const supplied = Buffer.from(
      (request.headers.authorization || '').replace(/^Bearer /, ''),
    );
    const expected = Buffer.from(config.monitoringToken);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return reply.code(401).send({ message: 'Invalid console token.' });
    }
  };
  const openClassroom = async (id, reply) => {
    const classroom = await store.getClassroom(id);
    if (!classroom) {
      reply.code(404).send({ message: 'Classroom not found.' });
      return null;
    }
    if (classroom.status !== 'open') {
      reply
        .code(409)
        .send({ message: 'This classroom is closed for collection.' });
      return null;
    }
    if (classroom.synthetic) {
      reply
        .code(409)
        .send({
          message: 'Showcase classrooms contain simulated records only.',
        });
      return null;
    }
    return classroom;
  };

  app.decorateRequest('metricStartedAt', null);
  app.addHook('onRequest', async (request) => {
    request.metricStartedAt = process.hrtime.bigint();
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY');
    return payload;
  });
  app.addHook('onResponse', async (request, reply) => {
    // Console polling and health probes must not inflate classroom/API traffic.
    const route = request.routeOptions?.url ?? 'unmatched';
    if (
      route.startsWith('/api/v1/monitoring') ||
      ['/healthz', '/readyz', '/monitoring'].includes(route) ||
      request.method === 'OPTIONS'
    )
      return;
    try {
      await store.recordRequest({
        route,
        method: request.method,
        statusCode: reply.statusCode,
        durationMs:
          Number(process.hrtime.bigint() - request.metricStartedAt) / 1e6,
      });
    } catch {
      app.log.warn('A request metric could not be stored.');
    }
  });

  app.get('/healthz', { config: limited(120) }, async () => ({
    status: 'ok',
    service: 'counterlens-api',
    time: new Date(),
  }));
  app.get('/readyz', { config: limited(120) }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      return { status: 'ok', database: await store.ping() };
    } catch {
      return reply
        .code(503)
        .send({ status: 'degraded', database: { status: 'unavailable' } });
    }
  });
  app.get('/monitoring', async (_request, reply) =>
    reply.redirect(config.consoleUrl),
  );

  app.get(
    '/api/v1/classroom-view/:datasetId',
    {
      config: limited(120),
      schema: {
        params: object({ datasetId: idSchema }),
        querystring: object({ classroomId: idSchema }, []),
      },
    },
    async (request, reply) => {
      const classroom = request.query.classroomId
        ? await store.getClassroom(request.query.classroomId)
        : null;
      if (request.query.classroomId && !classroom)
        return reply.code(404).send({ message: 'Classroom not found.' });
      const view = classroom
        ? await store.getRelease(classroom.releaseId)
        : await store.getView(request.params.datasetId);
      if (!view || view.dataset.id !== request.params.datasetId)
        return reply
          .code(404)
          .send({ message: 'Classroom dataset not found.' });
      reply.header('Cache-Control', 'no-store');
      return view;
    },
  );
  app.get(
    '/api/v1/classrooms/:id',
    { config: limited(120), schema: { params: object({ id: idSchema }) } },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const classroom = await store.getClassroom(request.params.id);
      return (
        classroom ?? reply.code(404).send({ message: 'Classroom not found.' })
      );
    },
  );
  app.post(
    '/api/v1/events',
    {
      config: limited(90),
      schema: {
        body: object({
          name: { type: 'string', enum: ALLOWED_EVENT_NAMES },
          classroomId: idSchema,
          datasetId: idSchema,
          datasetVersion: versionSchema,
          policyId: idSchema,
          locale: localeSchema,
          theme: { type: 'string', enum: ['light', 'graphite', 'summer'] },
        }),
      },
    },
    async (request, reply) => {
      const classroom = await openClassroom(request.body.classroomId, reply);
      if (!classroom) return;
      const view = await store.getRelease(classroom.releaseId);
      if (
        !view ||
        view.dataset.id !== request.body.datasetId ||
        view.dataset.version !== request.body.datasetVersion ||
        !view.policies.some((p) => p.id === request.body.policyId)
      ) {
        return reply
          .code(400)
          .send({ message: 'Event does not match this classroom release.' });
      }
      await store.recordEvent({ ...request.body, synthetic: false });
      return reply.code(202).send({ accepted: true });
    },
  );
  app.post(
    '/api/v1/responses',
    {
      config: limited(20),
      schema: {
        body: object({
          classroomId: idSchema,
          submissionId: { type: 'string', pattern: '^[0-9a-f-]{36}$' },
          questionnaireId: idSchema,
          questionnaireVersion: versionSchema,
          locale: localeSchema,
          consent: { const: true },
          answers: { type: 'object', maxProperties: 30 },
        }),
      },
    },
    async (request, reply) => {
      const classroom = await openClassroom(request.body.classroomId, reply);
      if (!classroom) return;
      const q = classroom.questionnaire;
      if (
        q.id !== request.body.questionnaireId ||
        q.version !== request.body.questionnaireVersion ||
        !validateAnswers(request.body.answers, q)
      ) {
        return reply
          .code(400)
          .send({
            message: 'Answers do not match this questionnaire version.',
          });
      }
      const created = await store.recordResponse({
        ...request.body,
        releaseId: classroom.releaseId,
        synthetic: false,
      });
      return reply
        .code(created ? 201 : 200)
        .send({ accepted: true, duplicate: !created });
    },
  );

  app.get(
    '/api/v1/monitoring/classrooms',
    { preHandler: admin, config: limited(60) },
    async () => store.listClassrooms(),
  );
  app.post(
    '/api/v1/monitoring/classrooms',
    {
      preHandler: admin,
      config: limited(10),
      schema: {
        body: object({
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            pattern: '\\S',
          },
        }),
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await store.createClassroom(request.body.title.trim())),
  );
  app.patch(
    '/api/v1/monitoring/classrooms/:id',
    {
      preHandler: admin,
      config: limited(30),
      schema: {
        params: object({ id: idSchema }),
        body: object({ status: { enum: ['open', 'closed'] } }),
      },
    },
    async (request, reply) => {
      if (
        !(await store.setClassroomStatus(
          request.params.id,
          request.body.status,
        ))
      )
        return reply.code(404).send({ message: 'Classroom not found.' });
      return { updated: true };
    },
  );
  app.post(
    '/api/v1/monitoring/showcase',
    { preHandler: admin, config: limited(3) },
    async (_request, reply) => {
      if (config.nodeEnv === 'production')
        return reply
          .code(403)
          .send({ message: 'Showcase generation is disabled in production.' });
      return reply.code(201).send(await store.seedShowcase());
    },
  );
  app.get(
    '/api/v1/monitoring/summary',
    {
      preHandler: admin,
      config: limited(60),
      schema: {
        querystring: object(
          {
            windowHours: { type: 'string', enum: ['1', '24', '72', '168'] },
            classroomId: idSchema,
          },
          [],
        ),
      },
    },
    async (request, reply) => {
      const classroomId = request.query.classroomId || 'local-demo';
      if (!(await store.getClassroom(classroomId)))
        return reply.code(404).send({ message: 'Classroom not found.' });
      return store.getSummary({
        windowHours: Number(request.query.windowHours || 24),
        classroomId,
      });
    },
  );
  app.setErrorHandler((error, _request, reply) => {
    if (error.validation)
      return reply
        .code(400)
        .send({
          error: 'invalid_request',
          message: 'The request did not match the API contract.',
        });
    if (error.statusCode === 429)
      return reply
        .code(429)
        .send({ message: 'Too many requests. Please try again shortly.' });
    if (error.statusCode === 413)
      return reply.code(413).send({ message: 'Request is too large.' });
    if (error.statusCode >= 400 && error.statusCode < 500)
      return reply.code(error.statusCode).send({ message: 'Unsupported or invalid request.' });
    // Do not log database URIs, submitted answers, or raw driver error messages.
    app.log.error({ errorType: error.name }, 'Request failed');
    return reply
      .code(503)
      .send({ message: 'The service is temporarily unavailable.' });
  });
  app.addHook('onClose', async () => store.close());
  return app;
};
