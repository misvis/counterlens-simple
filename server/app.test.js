import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createSyntheticClassroomView, DEFAULT_CLASSROOM_ID, DEFAULT_DATASET_VERSION } from '../shared/classroomDataset.js';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { validateClassroomView } from './datasets/registry.js';

test('MongoDB classroom lifecycle and collection boundaries', async (t) => {
  // Always use a fresh, unmistakably test-only database. Never drop a configured demo DB.
  const dbName = `counterlens_test_${randomUUID().replaceAll('-', '')}`;
  const config = {
    ...loadConfig({}),
    nodeEnv: 'test',
    mongoDbName: dbName,
    monitoringToken: 'test-console-token',
  };
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  let app;
  t.after(async () => {
    if (app) await app.close();
    if (/^counterlens_test_[a-f0-9]{32}$/.test(dbName))
      await client.db(dbName).dropDatabase();
    await client.close();
  });
  app = await buildApp({ config, logger: false });
  const auth = { authorization: 'Bearer test-console-token' };
  const event = {
    classroomId: DEFAULT_CLASSROOM_ID,
    name: 'page_view',
    datasetId: 'admissions-demo',
    datasetVersion: DEFAULT_DATASET_VERSION,
    policyId: 'academic',
    locale: 'en',
    theme: 'light',
  };
  const submission = {
    classroomId: DEFAULT_CLASSROOM_ID,
    submissionId: randomUUID(),
    questionnaireId: 'ethics-exit-ticket',
    questionnaireVersion: 'demo-v1',
    locale: 'en',
    consent: true,
    answers: { policy: 'holistic', confidence: 4, reflection: 'Test response' },
  };

  await t.test('serves persisted data and database readiness', async () => {
    assert.equal((await app.inject('/readyz')).json().database.status, 'ok');
    const res = await app.inject('/api/v1/classroom-view/admissions-demo');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().records.length, 72);
    assert.equal(res.json().dataset.version, DEFAULT_DATASET_VERSION);
    assert.ok(res.json().records.every(record => typeof record.referenceOutcome === 'boolean'));
    assert.equal(
      await client.db(dbName).collection('classroom_records').countDocuments(),
      72,
    );
    assert.equal(
      (await app.inject(`/api/v1/classrooms/${DEFAULT_CLASSROOM_ID}`)).json().questionnaire
        .version,
      'demo-v1',
    );
  });
  await t.test('new reference-label releases preserve existing classroom bindings', async () => {
    const legacy = createSyntheticClassroomView();
    legacy.dataset.version = 'synthetic-1973-v1';
    legacy.features = legacy.features.filter(feature => feature.key !== 'referenceOutcome');
    legacy.records = legacy.records.map(record => {
      const copy = { ...record };
      delete copy.referenceOutcome;
      return copy;
    });
    const releaseId = `${legacy.dataset.id}:${legacy.dataset.version}`;
    const metadata = { ...legacy };
    delete metadata.records;
    const db = client.db(dbName);
    await db.collection('dataset_releases').insertOne({ _id: releaseId, ...metadata, published: true, createdAt: new Date(0) });
    await db.collection('classroom_records').insertMany(legacy.records.map(record => ({ releaseId, ...record })));
    await db.collection('classrooms').insertOne({ _id: 'local-demo', title: 'Previous demo', releaseId, status: 'open', questionnaireId: 'ethics-exit-ticket:demo-v1', createdAt: new Date(0) });
    await app.classroomStore.initialize();
    const oldView = (await app.inject('/api/v1/classroom-view/admissions-demo?classroomId=local-demo')).json();
    assert.deepEqual(oldView.records, legacy.records);
    assert.equal(oldView.dataset.version, 'synthetic-1973-v1');
    const newView = (await app.inject(`/api/v1/classroom-view/admissions-demo?classroomId=${DEFAULT_CLASSROOM_ID}`)).json();
    assert.equal(newView.dataset.version, DEFAULT_DATASET_VERSION);
    assert.ok(newView.records.every(record => typeof record.referenceOutcome === 'boolean'));
    assert.equal((await app.classroomStore.createClassroom('New release test')).releaseId, `${newView.dataset.id}:${DEFAULT_DATASET_VERSION}`);
  });
  await t.test(
    'protects console data and rejects private event fields',
    async () => {
      const wrongType = await app.inject({ method: 'POST', url: '/api/v1/events', headers: { 'content-type': 'application/xml' }, payload: '<event />' });
      assert.equal(wrongType.statusCode, 415);
      assert.equal(
        (await app.inject('/api/v1/monitoring/summary')).statusCode,
        401,
      );
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: { ...event, studentRecordId: 'S01' },
          })
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: event,
          })
        ).statusCode,
        202,
      );
    },
  );
  await t.test(
    'validates question versions, choices, types, and explicit submission agreement',
    async () => {
      for (const payload of [
        { ...submission, consent: false },
        { ...submission, questionnaireVersion: 'old-v0' },
        { ...submission, answers: { policy: 'unknown', confidence: 4 } },
        { ...submission, answers: { policy: 'academic', confidence: '4' } },
        {
          ...submission,
          answers: {
            policy: 'academic',
            confidence: 4,
            email: 'not-allowed@example.com',
          },
        },
      ])
        assert.equal(
          (
            await app.inject({
              method: 'POST',
              url: '/api/v1/responses',
              payload,
            })
          ).statusCode,
          400,
        );
    },
  );
  await t.test(
    'saves answers exactly once on a retried submission',
    async () => {
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/responses',
            payload: submission,
          })
        ).statusCode,
        201,
      );
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/responses',
            payload: submission,
          })
        ).json().duplicate,
        true,
      );
      assert.equal(
        await client.db(dbName).collection('responses').countDocuments(),
        1,
      );
      const data = (
        await app.inject({ url: '/api/v1/monitoring/summary', headers: auth })
      ).json();
      assert.equal(data.surveys.count, 1);
      assert.equal(data.surveys.choices[0].name, 'holistic');
      assert.equal(data.privacy.storesIpAddresses, false);
    },
  );
  await t.test(
    'isolates classroom sessions and honors collection closure',
    async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/classrooms',
        headers: auth,
        payload: { title: 'Test classroom' },
      });
      assert.equal(created.statusCode, 201);
      const id = created.json().id;
      assert.equal(
        (
          await app.inject({
            url: `/api/v1/monitoring/summary?classroomId=${id}`,
            headers: auth,
          })
        ).json().surveys.count,
        0,
      );
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/monitoring/classrooms/${id}`,
        headers: auth,
        payload: { status: 'closed' },
      });
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/responses',
            payload: { ...submission, classroomId: id },
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: { ...event, classroomId: id },
          })
        ).statusCode,
        409,
      );
    },
  );
  await t.test(
    'marks showcase data and prevents live answers from mixing with it',
    async () => {
      const room = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/monitoring/showcase',
          headers: auth,
        })
      ).json();
      const data = (
        await app.inject({
          url: `/api/v1/monitoring/summary?classroomId=${room.id}`,
          headers: auth,
        })
      ).json();
      assert.equal(data.classroom.synthetic, true);
      assert.equal(data.surveys.count, 24);
      assert.equal(data.events.total, 186);
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/responses',
            payload: { ...submission, classroomId: room.id },
          })
        ).statusCode,
        409,
      );
    },
  );
  await t.test(
    'filters expired answers even before asynchronous TTL deletion',
    async () => {
      await client
        .db(dbName)
        .collection('responses')
        .insertOne({
          ...submission,
          submissionId: randomUUID(),
          recordedAt: new Date(),
          expiresAt: new Date(Date.now() - 1000),
        });
      assert.equal(
        (
          await app.inject({ url: '/api/v1/monitoring/summary', headers: auth })
        ).json().surveys.count,
        1,
      );
      const indexes = await client.db(dbName).collection('responses').indexes();
      assert.ok(indexes.some((index) => index.expireAfterSeconds === 0));
    },
  );
  await t.test(
    'retains records and answers after closing and reopening the backend',
    async () => {
      await app.close();
      app = await buildApp({ config, logger: false });
      assert.equal(
        await client
          .db(dbName)
          .collection('classroom_records')
          .countDocuments({ releaseId: `admissions-demo:${DEFAULT_DATASET_VERSION}` }),
        72,
      );
      assert.equal(await client.db(dbName).collection('classroom_records').countDocuments({ releaseId: 'admissions-demo:synthetic-1973-v1' }), 72);
      assert.equal(
        (
          await app.inject({ url: '/api/v1/monitoring/summary', headers: auth })
        ).json().surveys.count,
        1,
      );
    },
  );
  await t.test('returns 429 when the event limit is exceeded', async () => {
    let response;
    for (let i = 0; i < 91; i++)
      response = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        payload: event,
      });
    assert.equal(response.statusCode, 429);
  });
  await t.test(
    'reports unavailable storage without returning a healthy readiness response',
    async () => {
      await app.classroomStore.close();
      assert.equal((await app.inject('/readyz')).statusCode, 503);
    },
  );
});

test('refuses non-approved releases and undeclared fields', () => {
  const unsafe = createSyntheticClassroomView();
  unsafe.privacy.approvedForPublicDisplay = false;
  assert.throws(
    () => validateClassroomView(unsafe),
    /approved for public display/,
  );
  unsafe.privacy.approvedForPublicDisplay = true;
  unsafe.records[0].email = 'student@example.edu';
  assert.throws(() => validateClassroomView(unsafe), /unpublished field/);
});

test('reference outcomes cannot be used as policy inputs or counterfactual controls', () => {
  const view = createSyntheticClassroomView();
  view.policies[0].weights.referenceOutcome = 10;
  assert.throws(() => validateClassroomView(view), /non-input feature/);
  delete view.policies[0].weights.referenceOutcome;
  view.features.find(feature => feature.key === 'referenceOutcome').allowedUses.push('counterfactual');
  assert.throws(() => validateClassroomView(view), /cannot be counterfactual/);
});

test('does not expose the development console token on a public listener', async () => {
  await assert.rejects(
    () =>
      buildApp({
        config: { ...loadConfig({}), host: '0.0.0.0' },
        logger: false,
      }),
    /only allowed on a local/,
  );
});
