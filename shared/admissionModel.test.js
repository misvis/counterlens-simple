import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { scoreStudent, getDecision, backgroundScore, admissionBoundary, backgroundBoundaryBand, confusionMatrix, thresholdAfterDrag, studentAfterDrag } from './admissionModel.js';

const { policies, records } = createSyntheticClassroomView();
const backgrounds = Array.from({ length: 8 }, (_, i) => ({ firstGen: Boolean(i & 1), athlete: Boolean(i & 2), resident: Boolean(i & 4) }));

test('Student dragging edits only hypothetical GPA/SAT, matches slider steps, and respects chart limits', () => {
  const student = Object.freeze({ id: 'test', gpa: 3.2, sat: 1200, firstGen: true, athlete: false, resident: true, referenceOutcome: false });
  assert.deepEqual(studentAfterDrag(student, 0, 0), student);
  assert.deepEqual(studentAfterDrag(student, .1, .2), { ...student, gpa: 3.36, sat: 1330 });
  assert.deepEqual(studentAfterDrag(student, -.1, -.2), { ...student, gpa: 3.04, sat: 1070 });
  assert.deepEqual(studentAfterDrag(student, 10, -10), { ...student, gpa: 4, sat: 950 });
  assert.deepEqual(studentAfterDrag(student, -10, 10), { ...student, gpa: 2.4, sat: 1600 });
  assert.equal(studentAfterDrag(student, .01234, .02345).gpa, 3.22);
  assert.equal(studentAfterDrag(student, .01234, .02345).sat, 1220);
  assert.notEqual(studentAfterDrag(student, 0, 0), student);
  const baseline = policies.map(policy => confusionMatrix(records, policy, 'referenceOutcome'));
  records.forEach(record => studentAfterDrag(record, .25, .25));
  assert.deepEqual(policies.map(policy => confusionMatrix(records, policy, 'referenceOutcome')), baseline);
});

test('Boundary dragging translates the weighted score, preserves grab offset, and clamps to the slider range', () => {
  for (const policy of policies) {
    const { gpa, sat } = policy.weights;
    assert.equal(thresholdAfterDrag(policy, policy.threshold, 0, 0), policy.threshold);
    assert.equal(thresholdAfterDrag(policy, 50, .1, .1), Math.round(50 + .1 * (gpa + sat)));
    assert.equal(thresholdAfterDrag(policy, 50, -.1, -.1), Math.round(50 - .1 * (gpa + sat)));
    assert.equal(thresholdAfterDrag(policy, 50, sat / 100, -gpa / 100), 50, 'Along-boundary motion keeps the threshold');
    assert.equal(thresholdAfterDrag(policy, 50, 10, 10), 100);
    assert.equal(thresholdAfterDrag(policy, 50, -10, -10), 0);
    for (const profile of backgrounds) {
      const start = { ...profile, gpa: 3.1, sat: 1200 };
      const moved = { ...profile, gpa: 3.26, sat: 1265 };
      assert.equal(thresholdAfterDrag(policy, scoreStudent(start, policy), .1, .1), Math.round(scoreStudent(moved, policy)));
    }
  }
  assert.equal(thresholdAfterDrag({ weights: { gpa: 100 } }, 50, .1, 1), 60);
  assert.equal(thresholdAfterDrag({ weights: { sat: 100 } }, 50, 1, .1), 60);
  assert.equal(thresholdAfterDrag({ weights: {} }, 50, 1, 1), 50);
  assert.equal(thresholdAfterDrag({ weights: { gpa: -100 } }, 50, .1, 0), 40);
});

test('Confusion matrix counts all four outcomes and excludes missing or non-boolean reference labels', () => {
  const policy = { weights: { gpa: 100 }, threshold: 50 };
  const samples = [
    { gpa: 4, sat: 1200, reference: true },
    { gpa: 4, sat: 1200, reference: false },
    { gpa: 2.4, sat: 1200, reference: true },
    { gpa: 2.4, sat: 1200, reference: false },
    { gpa: 4, sat: 1200, reference: null },
    { gpa: 4, sat: 1200 },
    { gpa: 4, sat: 1200, reference: 'false' },
  ];
  const original = samples.map(sample => ({ ...sample }));
  assert.deepEqual(confusionMatrix(samples, policy, 'reference'), { tp: 1, fp: 1, fn: 1, tn: 1, labeled: 4, missing: 3 });
  assert.deepEqual(confusionMatrix(samples, { ...policy, threshold: 0 }, 'reference'), { tp: 2, fp: 2, fn: 0, tn: 0, labeled: 4, missing: 3 });
  assert.deepEqual(confusionMatrix(samples, { ...policy, threshold: 101 }, 'reference'), { tp: 0, fp: 0, fn: 2, tn: 2, labeled: 4, missing: 3 });
  assert.deepEqual(samples, original, 'Policy changes never rewrite reference outcomes');
  assert.deepEqual(confusionMatrix(samples, policy, null), { tp: 0, fp: 0, fn: 0, tn: 0, labeled: 0, missing: 7 });
  assert.deepEqual(confusionMatrix([], policy, 'reference'), { tp: 0, fp: 0, fn: 0, tn: 0, labeled: 0, missing: 0 });
});

test('Demo reference labels are reproducible and never change admission scores', () => {
  const repeated = createSyntheticClassroomView();
  assert.deepEqual(repeated.records, records);
  assert.ok(records.every(record => typeof record.referenceOutcome === 'boolean'));
  assert.deepEqual(policies.map(policy => records.filter(record => getDecision(record, policy)).length), [16, 27, 36]);
  for (const policy of policies) for (const record of records) {
    assert.equal(scoreStudent(record, policy), scoreStudent({ ...record, referenceOutcome: !record.referenceOutcome }, policy));
  }
  for (const preset of policies) for (let threshold = 0; threshold <= 100; threshold += 1) {
    const policy = { ...preset, threshold };
    const matrix = confusionMatrix(records, policy, 'referenceOutcome');
    assert.equal(matrix.tp + matrix.fp + matrix.fn + matrix.tn, records.length);
    assert.equal(matrix.tp + matrix.fp, records.filter(record => getDecision(record, policy)).length);
    assert.equal(matrix.tp + matrix.fn, records.filter(record => record.referenceOutcome).length);
  }
});

test('Every boundary point satisfies the same admission equation for every background and threshold', () => {
  for (const preset of policies) for (const profile of backgrounds) for (let threshold = 0; threshold <= 100; threshold += 1) {
    const policy = { ...preset, threshold };
    const boundary = admissionBoundary(policy, backgroundScore(profile, policy));
    assert.ok(boundary.points.length <= 2);
    for (const p of boundary.points) {
      assert.ok(p.x >= 2.4 && p.x <= 4 && p.y >= 950 && p.y <= 1600);
      assert.ok(Math.abs(scoreStudent({ ...profile, gpa: p.x, sat: p.y }, policy) - threshold) < 1e-8);
    }
  }
});

test('Academic policy has one shared line; context changes shift only context-sensitive policies', () => {
  assert.equal(backgroundBoundaryBand(policies[0]).hasContext, false);
  for (const policy of policies.slice(1)) {
    const band = backgroundBoundaryBand(policy);
    assert.ok(band.hasContext && band.polygon.length >= 3);
    assert.notDeepEqual(admissionBoundary(policy, 0).points, admissionBoundary(policy, backgroundScore(backgrounds[7], policy)).points);
  }
  for (const student of records) assert.equal(scoreStudent(student, policies[0]), scoreStudent({ ...student, firstGen: !student.firstGen }, policies[0]));
});

test('Band vertices stay in the score interval where background can affect the decision', () => {
  for (const preset of policies.slice(1)) for (const threshold of [0, 5, 25, 50, 75, 95, 100]) {
    const policy = { ...preset, threshold };
    const maxBackground = backgroundScore(backgrounds[7], policy);
    for (const p of backgroundBoundaryBand(policy).polygon) {
      const score = p.x * policy.weights.gpa + p.y * policy.weights.sat;
      assert.ok(p.x >= -1e-9 && p.x <= 1 + 1e-9 && p.y >= -1e-9 && p.y <= 1 + 1e-9);
      assert.ok(score >= threshold - maxBackground - 1e-8 && score <= threshold + 1e-8);
    }
  }
});

test('Off-chart, tangent, vertical, horizontal, constant, and negative-weight cases are handled without fake lines', () => {
  const policy = (gpa, sat, threshold) => ({ weights: { gpa, sat }, threshold });
  assert.equal(admissionBoundary(policy(60, 40, -1)).relation, 'all-admitted');
  assert.deepEqual(admissionBoundary(policy(60, 40, 101)).points, []);
  assert.equal(admissionBoundary(policy(60, 40, 100)).points.length, 1);
  assert.equal(admissionBoundary(policy(100, 0, 50)).points.length, 2);
  assert.equal(admissionBoundary(policy(0, 100, 50)).points.length, 2);
  assert.deepEqual(admissionBoundary(policy(0, 0, 0)), { points: [], relation: 'all-admitted' });
  assert.deepEqual(admissionBoundary(policy(0, 0, 1)), { points: [], relation: 'none-admitted' });
  for (const p of admissionBoundary(policy(-60, 40, -10)).points) assert.ok(Math.abs(scoreStudent({ gpa: p.x, sat: p.y }, policy(-60, 40, -10)) + 10) < 1e-8);
  assert.equal(getDecision({ gpa: 4, sat: 950 }, policy(60, 40, 60)), true);
});
