import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSyntheticClassroomView, createSyntheticRecords, DEFAULT_DATASET_VERSION } from './classroomDataset.js';
import { buildExplorerDemoView, EXPLORER_DEMO_RECORD_COUNT } from './explorerDemoDataset.js';
import { toPercentileClassroomView, satScoreToPercentile } from './satPercentiles.js';
import { EXPLORER_FEATURES, enrichExplorerRecords, buildIncomeBins, buildExplorerGroups } from './featureExplorer.js';
import { EXPLORER_SIMULATION_POLICIES } from './explorerPolicies.js';
import { getDecision } from './admissionModel.js';

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test('The persisted v2 default remains the same 72-record release', () => {
  const view = createSyntheticClassroomView();
  assert.equal(view.dataset.version, 'synthetic-1973-v2');
  assert.equal(DEFAULT_DATASET_VERSION, view.dataset.version);
  assert.equal(view.dataset.recordCount, 72);
  assert.equal(view.records.length, 72);
  assert.equal(Object.hasOwn(view, 'preview'), false);
  assert.equal(createHash('sha256').update(JSON.stringify(view.records)).digest('hex'),
    '749bb986b7d6565a8a6940d3ea25234be4f3ebc4ca26b225912373a647612d68');
});

test('Counted generation is deterministic, keeps every prefix, and validates its input', () => {
  const records = createSyntheticRecords(EXPLORER_DEMO_RECORD_COUNT);
  assert.equal(EXPLORER_DEMO_RECORD_COUNT, 200);
  assert.deepEqual(records, createSyntheticRecords(200));
  assert.deepEqual(records.slice(0, 72), createSyntheticClassroomView().records);
  for (const count of [1, 72, 73, 200, 256]) {
    assert.deepEqual(createSyntheticRecords(count), createSyntheticRecords(256).slice(0, count));
  }
  assert.equal(new Set(records.map(record => record.id)).size, 200);
  assert.equal(records[72].id, 'S73');
  assert.equal(records.at(-1).id, 'S200');
  assert.deepEqual(records[72], {
    id: 'S73', gpa: 3.41, sat: 1340, firstGen: false, athlete: false, resident: true, referenceOutcome: true,
  });
  for (const count of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '200', null, {}]) {
    assert.throws(() => createSyntheticRecords(count), { name: 'RangeError' });
  }
});

test('Every appended record has valid values and the original independent teaching-label stream', () => {
  let referenceState = 2026;
  const records = createSyntheticRecords(200);
  const allowedKeys = Object.keys(createSyntheticClassroomView().records[0]);
  records.forEach(record => {
    assert.deepEqual(Object.keys(record), allowedKeys);
    assert(Number.isFinite(record.gpa) && record.gpa >= 2.4 && record.gpa <= 4);
    assert(Number.isFinite(record.sat) && record.sat >= 950 && record.sat <= 1600 && record.sat % 10 === 0);
    for (const key of ['firstGen', 'athlete', 'resident', 'referenceOutcome']) assert.equal(typeof record[key], 'boolean');
    referenceState = (1664525 * referenceState + 1013904223) >>> 0;
    const expected = record.gpa * 18 + record.sat / 1600 * 20 + referenceState / 4294967296 * 15 > 72;
    assert.equal(record.referenceOutcome, expected);
  });
  assert.equal(records.filter(record => record.referenceOutcome).length, 182);
});

test('The preview preserves original records and provenance without mutating the source', () => {
  const source = freeze(createSyntheticClassroomView());
  const before = JSON.stringify(source);
  const preview = buildExplorerDemoView(source);
  assert.notEqual(preview, source);
  assert.equal(preview.dataset.recordCount, 200);
  assert.equal(preview.records.length, 200);
  assert.equal(preview.dataset.version, source.dataset.version);
  assert.equal(JSON.stringify(preview.records.slice(0, 72)), JSON.stringify(source.records));
  source.records.forEach((record, index) => assert.equal(preview.records[index], record));
  assert.equal(preview.privacy, source.privacy);
  assert.equal(preview.features, source.features);
  assert.equal(preview.policies, source.policies);
  assert.deepEqual(preview.preview, {
    kind: 'explorer-synthetic-expansion', browserOnly: true,
    sourceDatasetId: source.dataset.id, sourceDatasetVersion: source.dataset.version,
    sourceReleaseVersion: 'synthetic-1973-v2', sourceRecordCount: 72, recordCount: 200,
  });
  assert.equal(buildExplorerDemoView(preview), preview);
  const serialized = JSON.parse(JSON.stringify(preview));
  assert.equal(buildExplorerDemoView(serialized), serialized);
  assert.equal(JSON.stringify(source), before);
  assert.equal(createSyntheticClassroomView().records.length, 72);
});

test('Expansion before and after SAT conversion produces identical records in the correct units', () => {
  const raw = createSyntheticClassroomView();
  const source = freeze(toPercentileClassroomView(raw));
  const preview = buildExplorerDemoView(source);
  const convertedPreview = toPercentileClassroomView(buildExplorerDemoView(raw));
  assert.deepEqual(preview.records, convertedPreview.records);
  assert.deepEqual(preview.dataset, convertedPreview.dataset);
  assert.equal(preview.dataset.version, source.dataset.version);
  assert.equal(preview.preview.sourceDatasetVersion, source.dataset.version);
  assert.equal(preview.preview.sourceReleaseVersion, raw.dataset.version);
  assert.equal(buildExplorerDemoView(convertedPreview), convertedPreview);
  source.records.forEach((record, index) => assert.equal(preview.records[index], record));
  const rawRecords = createSyntheticRecords(200);
  preview.records.forEach((record, index) => {
    assert.equal(record.sat, satScoreToPercentile(rawRecords[index].sat));
    assert.equal(record.referenceOutcome, rawRecords[index].referenceOutcome);
    assert(Number.isFinite(record.sat) && record.sat >= 0 && record.sat <= 100);
  });
});

test('Real, unknown, changed, incomplete, and already larger datasets are returned untouched', () => {
  const changes = [
    view => { view.dataset.id = 'real-cohort'; },
    view => { view.dataset.version = 'synthetic-1973-v1'; },
    view => { view.dataset.sourceType = 'de-identified'; },
    view => { view.dataset.releaseStatus = 'private'; },
    view => { view.dataset.recordCount = 71; },
    view => { view.schemaVersion = 2; },
    view => { view.privacy.representation = 'de-identified'; },
    view => { view.privacy.containsDirectIdentifiers = true; },
    view => { view.privacy.approvedForPublicDisplay = false; },
    view => { view.records[0].gpa += 0.01; },
    view => { view.records[0].referenceOutcome = !view.records[0].referenceOutcome; },
    view => { view.records[0].id = 'unknown'; },
    view => { view.records[0].ethnicity = 'Asian'; },
    view => { view.records[0].extra = undefined; },
    view => { delete view.records[0].resident; },
    view => { view.records.reverse(); },
    view => { view.records.pop(); },
    view => { view.records.length = 73; },
    view => { view.records[71] = view.records[0]; },
    view => { view.features.find(feature => feature.key === 'sat').unit = 'percentile'; },
    view => { view.policies[0].threshold += 1; },
    view => { view.preview = null; },
    view => { view.records = createSyntheticRecords(200); view.dataset.recordCount = 200; },
  ];
  for (const change of changes) {
    const view = createSyntheticClassroomView();
    change(view);
    assert.equal(buildExplorerDemoView(view), view);
  }
  for (const view of [null, undefined, {}, { dataset: {} }]) assert.equal(buildExplorerDemoView(view), view);
  const reorderedKeys = createSyntheticClassroomView();
  reorderedKeys.records = reorderedKeys.records.map(record => Object.fromEntries(Object.entries(record).reverse()));
  assert.equal(buildExplorerDemoView(reorderedKeys).records.length, 200);
});

test('All 200 records enrich and group consistently across the six background features', () => {
  const view = buildExplorerDemoView(toPercentileClassroomView(createSyntheticClassroomView()));
  const records = enrichExplorerRecords(view.records);
  assert.deepEqual(records.slice(0, 72), enrichExplorerRecords(toPercentileClassroomView(createSyntheticClassroomView()).records));
  assert.deepEqual(records, enrichExplorerRecords(view.records));
  records.forEach(record => {
    EXPLORER_FEATURES.forEach(feature => {
      if (feature.key === 'zipIncome') assert(Number.isFinite(record.zipIncome) && record.zipIncome >= 28000 && record.zipIncome <= 160000);
      else assert(feature.values.some(option => option.value === record[feature.key]));
    });
  });
  assert.deepEqual(EXPLORER_SIMULATION_POLICIES.map(policy => records.filter(record => getDecision(record, policy)).length), [116, 99, 116]);
  for (const method of ['fixed', 'quantile']) {
    const incomeBins = buildIncomeBins(records, { method, count: 4 });
    const grouped = buildExplorerGroups({ records, incomeBins,
      layout: { columns: 'residency', rows: 'ethnicity', sections: ['zipIncome', 'major', 'transfer', 'mathStatus'] } });
    const members = grouped.sections.flatMap(section => section.panels.flatMap(panel => panel.members));
    assert.equal(members.length, 200);
    assert.equal(new Set(members.map(record => record.id)).size, 200);
    assert.equal(grouped.panelCount, 3072);
  }
});
