import test from 'node:test';
import assert from 'node:assert/strict';
import { deserialize, serialize } from 'node:v8';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { toPercentileClassroomView } from './satPercentiles.js';
import { EXPLORER_SIMULATION_POLICIES } from './explorerPolicies.js';
import {
  EXPLORER_FEATURES, enrichExplorerRecords, buildIncomeBins, getExplorerOptions,
  buildExplorerGroups, recordMatchesExplorerContext, summarizeExplorerOutcomes,
  buildExplorerIncomeRepresentatives, buildExplorerPanelProfile,
} from './featureExplorer.js';
import { scoreStudent, backgroundScore, admissionBoundary, confusionMatrix } from './admissionModel.js';

const source = toPercentileClassroomView(createSyntheticClassroomView());
const records = enrichExplorerRecords(source.records);
const policy = EXPLORER_SIMULATION_POLICIES.find(policy => policy.id === 'holistic');
const clone = value => deserialize(serialize(value));
const option = (value, min, max) => ({ value, min, max });
const panels = result => result.sections.flatMap(section => section.panels);
const contained = (value, bin) => Number.isFinite(value) && value >= bin.min && value < bin.max;

test('Income representatives use full-cohort bin medians and do not depend on cohort order or other panel groups', () => {
  const cohort = Object.freeze([
    { id: 'a', zipIncome: 30000, residency: 'instate' },
    { id: 'b', zipIncome: 40000, residency: 'outofstate' },
    { id: 'c', zipIncome: 60000, residency: 'instate' },
    { id: 'd', zipIncome: 80000, residency: 'outofstate' },
    { id: 'e', zipIncome: 90000, residency: 'outofstate' },
    { id: 'f', zipIncome: 130000, residency: 'instate' },
    { id: 'g', zipIncome: null, residency: 'instate' },
  ].map(Object.freeze));
  const bins = buildIncomeBins(cohort, { method: 'fixed', count: 3 });
  const reps = buildExplorerIncomeRepresentatives(cohort, bins, policy);
  assert.deepEqual([...reps.values()], [35000, 80000, 130000, null]);
  assert.deepEqual(reps, buildExplorerIncomeRepresentatives([...cohort].reverse(), bins, policy));
  for (const selection of [undefined, ['instate'], ['outofstate']]) {
    const groups = buildExplorerGroups({ records: cohort, incomeBins: bins,
      layout: { columns: 'zipIncome', rows: 'residency' }, selectedValues: { residency: selection } });
    for (const panel of panels(groups)) {
      const lineProfile = buildExplorerPanelProfile({ zipIncome: 999999 }, panel.context, reps, policy);
      const bin = panel.context.find(item => item.key === 'zipIncome').option;
      assert.equal(lineProfile.zipIncome, reps.get(bin.value));
      assert.ok(recordMatchesExplorerContext(lineProfile, panel.context));
    }
  }
});

test('Empty-bin fallback representatives remain inside finite and open half-open intervals', () => {
  const bins = [
    option('low', -Infinity, 20000), option('middle', 20000, 30000),
    option('high', 200000, Infinity), option('all', -Infinity, Infinity),
    option('small', 1, 1 + Number.EPSILON), option('negative', -Infinity, 0),
    option('max', Number.MAX_VALUE, Infinity), option('impossible', -Infinity, -Number.MAX_VALUE),
    option('invalid', 50000, 50000), { value: 'missing', missing: true },
  ];
  const reps = buildExplorerIncomeRepresentatives([], bins, policy);
  assert.equal(reps.get('low'), 10000);
  assert.equal(reps.get('middle'), 25000);
  assert.equal(reps.get('high'), 200000);
  assert.equal(reps.get('all'), 87500);
  assert.equal(reps.get('small'), 1);
  assert.equal(reps.get('negative'), -125000);
  assert.equal(reps.get('max'), Number.MAX_VALUE);
  for (const bin of bins.slice(0, 7)) assert.ok(contained(reps.get(bin.value), bin), bin.value);
  for (const key of ['impossible', 'invalid', 'missing']) assert.equal(reps.get(key), null);
  const tiny = [option('tiny', 0, 2 * Number.MIN_VALUE)];
  const tinyReps = buildExplorerIncomeRepresentatives([{ zipIncome: Number.MIN_VALUE }, { zipIncome: Number.MIN_VALUE }], tiny, policy);
  assert.equal(tinyReps.get('tiny'), Number.MIN_VALUE);
});

test('Every six-dimensional panel gets a matching immutable line profile and exact cutoff', () => {
  const original = Object.freeze({ ...records.find(record => record.id === 'S47') });
  const bins = buildIncomeBins(records, { count: 3 });
  const reps = buildExplorerIncomeRepresentatives(records, bins, policy);
  const groups = buildExplorerGroups({ records, incomeBins: bins,
    layout: { columns: 'zipIncome', rows: 'ethnicity', sections: ['residency', 'major', 'transfer', 'mathStatus'] } });
  assert.equal(groups.panelCount, 2304);
  for (const panel of panels(groups)) {
    const snapshot = clone(panel);
    const scenario = buildExplorerPanelProfile(original, panel.context, reps, policy);
    assert.notEqual(scenario, original);
    assert.ok(recordMatchesExplorerContext(scenario, panel.context));
    for (const key of ['id', 'gpa', 'sat', 'firstGen', 'athlete', 'resident', 'referenceOutcome']) assert.equal(scenario[key], original[key]);
    const line = admissionBoundary(policy, backgroundScore(scenario, policy));
    for (const point of line.points) assert.ok(Math.abs(scoreStudent({ ...scenario, gpa: point.x, sat: point.y }, policy) - policy.threshold) < 1e-8);
    assert.deepEqual(panel, snapshot);
  }
});

test('Grouped fields override the line profile while every ungrouped draft value stays exact', () => {
  const original = records.find(record => record.id === 'S47');
  const draft = Object.freeze({ ...original, zipIncome: 220000, transfer: 'no', gpa: 3.27, mathStatus: 'None' });
  const major = getExplorerOptions('major', records).find(item => item.value === 'CompEng');
  const context = [{ key: 'major', option: major }];
  const scenario = buildExplorerPanelProfile(draft, context, new Map(), policy);
  assert.equal(scenario.major, 'CompEng');
  for (const key of Object.keys(draft).filter(key => key !== 'major')) assert.equal(scenario[key], draft[key]);
  const anotherMajorDraft = { ...draft, major: 'Psychology' };
  assert.deepEqual(buildExplorerPanelProfile(anotherMajorDraft, context, new Map(), policy), scenario);
  const transferDraft = { ...draft, transfer: 'yes' };
  const changed = buildExplorerPanelProfile(transferDraft, context, new Map(), policy);
  assert.equal(backgroundScore(changed, policy) - backgroundScore(scenario, policy), 4);
  assert.deepEqual(buildExplorerPanelProfile(draft, [], new Map(), policy), draft);
});

test('Raw and missing category values are preserved without leaking option IDs or legacy boolean changes', () => {
  for (const raw of ['unlisted-major', 7, true]) {
    const options = getExplorerOptions('major', [{ major: raw }]);
    const item = options.find(candidate => Object.hasOwn(candidate, 'rawValue') && Object.is(candidate.rawValue, raw));
    const scenario = buildExplorerPanelProfile({ major: 'BiologicalSci' }, [{ key: 'major', option: item }], new Map(), policy);
    assert.equal(scenario.major, raw);
  }
  const missing = getExplorerOptions('major', [{ major: null }]).find(item => item.missing);
  assert.equal(buildExplorerPanelProfile({ major: 'BiologicalSci' }, [{ key: 'major', option: missing }], new Map(), policy).major, null);
  const missingIncome = { value: '__missing__', missing: true };
  assert.equal(buildExplorerPanelProfile({ zipIncome: 100000 }, [{ key: 'zipIncome', option: missingIncome }], new Map(), policy).zipIncome, null);
  const mathOptions = getExplorerOptions('mathStatus', [{ mathStatus: null }]);
  const none = mathOptions.find(item => item.value === 'None');
  const missingMath = mathOptions.find(item => item.missing);
  assert.equal(buildExplorerPanelProfile({ mathStatus: 'Enrolled' }, [{ key: 'mathStatus', option: none }], new Map(), policy).mathStatus, 'None');
  assert.equal(buildExplorerPanelProfile({ mathStatus: 'Enrolled' }, [{ key: 'mathStatus', option: missingMath }], new Map(), policy).mathStatus, null);
  const outofstate = getExplorerOptions('residency', records).find(item => item.value === 'outofstate');
  const context = [{ key: 'residency', option: outofstate }];
  const draft = Object.freeze({ residency: 'instate', resident: true });
  assert.deepEqual(buildExplorerPanelProfile(draft, context, new Map(), policy), { residency: 'outofstate', resident: true });
  assert.deepEqual(buildExplorerPanelProfile(draft, context, new Map(), source.policies[1]), { residency: 'outofstate', resident: false });
  assert.deepEqual(draft, { residency: 'instate', resident: true });
});

test('Panel line profiles never change original records, draft predictions, membership, summaries or confusion matrices', () => {
  const cohort = records.map(record => Object.freeze({ ...record }));
  const originalSnapshot = clone(cohort);
  const draft = Object.freeze({ ...cohort[46], zipIncome: 175000, ethnicity: 'Asian', major: 'CompEng' });
  const draftSnapshot = clone(draft);
  const bins = buildIncomeBins(cohort, { method: 'quantile', count: 4 });
  const reps = buildExplorerIncomeRepresentatives(cohort, bins, policy);
  const groups = buildExplorerGroups({ records: cohort, incomeBins: bins,
    layout: { columns: 'zipIncome', rows: 'major', sections: ['transfer'] } });
  const membershipSnapshot = panels(groups).map(panel => panel.members.map(record => record.id));
  const matrix = confusionMatrix(cohort, policy, 'referenceOutcome');
  const summaries = summarizeExplorerOutcomes({ records: cohort, policy, incomeBins: bins });
  const score = scoreStudent(draft, policy);
  for (const panel of panels(groups)) {
    const scenario = buildExplorerPanelProfile(draft, panel.context, reps, policy);
    assert.ok(recordMatchesExplorerContext(scenario, panel.context));
    assert.equal(scenario.ethnicity, draft.ethnicity);
  }
  assert.equal(scoreStudent(draft, policy), score);
  assert.deepEqual(cohort, originalSnapshot);
  assert.deepEqual(draft, draftSnapshot);
  assert.deepEqual(confusionMatrix(cohort, policy, 'referenceOutcome'), matrix);
  assert.deepEqual(summarizeExplorerOutcomes({ records: cohort, policy, incomeBins: bins }), summaries);
  assert.deepEqual(panels(groups).map(panel => panel.members.map(record => record.id)), membershipSnapshot);
  assert.equal(EXPLORER_FEATURES.length, 6);
});
