import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticClassroomView } from '../shared/classroomDataset.js';
import { buildApp } from './app.js';
import { validateClassroomView } from './datasets/registry.js';
import { createMonitoringStore } from './monitoring/store.js';

const createTestApp = async () => buildApp({
  logger: false,
  config: {
    host: '127.0.0.1',
    port: 8787,
    nodeEnv: 'test',
    logLevel: 'silent',
    allowedOrigins: ['http://localhost:5173'],
    monitoringToken: 'test-monitor-token',
    monitoringDbPath: ':memory:',
    monitoringRetentionDays: 30,
  },
  monitoringStore: createMonitoringStore({ databasePath: ':memory:', retentionDays: 30 }),
});

test('serves a healthy, public-safe classroom view', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  const health = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, 'ok');

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/classroom-view/admissions-demo',
    headers: { origin: 'http://localhost:5173' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.records.length, 72);
  assert.equal(body.dataset.recordCount, 72);
  assert.equal(body.privacy.containsDirectIdentifiers, false);
  assert.equal(body.privacy.approvedForPublicDisplay, true);
  assert.equal('name' in body.records[0], false);
  assert.equal('email' in body.records[0], false);
});

test('rejects unknown datasets and non-contract event fields', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  const missing = await app.inject({
    method: 'GET',
    url: '/api/v1/classroom-view/not-a-dataset',
  });
  assert.equal(missing.statusCode, 404);

  const invalidEvent = await app.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: {
      name: 'student_selected',
      datasetId: 'admissions-demo',
      datasetVersion: 'synthetic-1973-v1',
      policyId: 'academic',
      locale: 'en',
      theme: 'light',
      studentRecordId: 'S01',
    },
  });
  assert.equal(invalidEvent.statusCode, 400);
  assert.equal(invalidEvent.json().error, 'invalid_request');
});

test('stores only allow-listed events and protects monitoring summaries', async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  const accepted = await app.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: {
      name: 'page_view',
      datasetId: 'admissions-demo',
      datasetVersion: 'synthetic-1973-v1',
      policyId: 'academic',
      locale: 'en',
      theme: 'light',
    },
  });
  assert.equal(accepted.statusCode, 202);

  const unauthorized = await app.inject({
    method: 'GET',
    url: '/api/v1/monitoring/summary',
  });
  assert.equal(unauthorized.statusCode, 401);

  const authorized = await app.inject({
    method: 'GET',
    url: '/api/v1/monitoring/summary?windowHours=24',
    headers: { authorization: 'Bearer test-monitor-token' },
  });
  const summary = authorized.json();

  assert.equal(authorized.statusCode, 200);
  assert.equal(summary.events.counts.find((row) => row.name === 'page_view').count, 1);
  assert.equal(summary.dataset.recordCount, 72);
  assert.equal(summary.privacy.storesIpAddresses, false);
  assert.equal(summary.privacy.storesStudentRecordIds, false);
  assert.equal(summary.privacy.storesReflectionText, false);
  assert.equal(JSON.stringify(summary).includes('S01'), false);
});

test('refuses to publish a dataset that is not approved for public display', () => {
  const unsafeView = createSyntheticClassroomView();
  unsafeView.privacy.approvedForPublicDisplay = false;

  assert.throws(
    () => validateClassroomView(unsafeView),
    /approved for public display/,
  );
});

test('refuses unpublished record fields even when the release flag is set', () => {
  const unsafeView = createSyntheticClassroomView();
  unsafeView.records[0].email = 'student@example.edu';

  assert.throws(
    () => validateClassroomView(unsafeView),
    /contains unpublished field email/,
  );
});
