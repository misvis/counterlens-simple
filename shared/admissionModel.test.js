import { toPercentileClassroomView, satScoreToPercentile } from './satPercentiles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { scoreStudent, scoreContributions, scoreCoordinates, getDecision, backgroundScore, admissionBoundary, scoreSpaceBoundary, backgroundBoundaryBand, confusionMatrix, thresholdAfterDrag, studentAfterDrag } from './admissionModel.js';

const { policies, records } = toPercentileClassroomView(createSyntheticClassroomView());
const backgrounds = Array.from({ length: 8 }, (_, i) => ({ firstGen: Boolean(i & 1), athlete: Boolean(i & 2), resident: Boolean(i & 4) }));

test('Score coordinates preserve every admission score and decision at every slider threshold', () => {
  for (const preset of policies) for (const record of records) {
    const coordinates = scoreCoordinates(record, preset);
    assert.equal(coordinates.background, backgroundScore(record, preset));
    assert.equal(coordinates.academic, scoreStudent({ ...record, firstGen: false, athlete: false, resident: false }, preset));
    assert.equal(coordinates.academic + coordinates.background, coordinates.total);
    assert.equal(coordinates.total, scoreStudent(record, preset));
    for (let threshold = 0; threshold <= 100; threshold += 1) {
      assert.equal(coordinates.total >= threshold, getDecision(record, { ...preset, threshold }));
    }
  }
  assert.deepEqual(scoreCoordinates(null, policies[0]), { academic: 0, background: 0, total: 0 });
  assert.deepEqual(scoreCoordinates({ gpa: 8, sat: -10, firstGen: true }, policies[1]), { academic: 45, background: 8, total: 53 });
});

test('Five score contributions match the scoring rules across all demo records and do not depend on the threshold', () => {
  for (const policy of policies) for (const student of records) {
    const contributions = scoreContributions(student, policy);
    assert.deepEqual(contributions.map(item => item.key), ['gpa', 'sat', 'firstGen', 'athlete', 'resident']);
    assert.equal(contributions[0].points, Math.min(1, Math.max(0, (student.gpa - 2.4) / 1.6)) * policy.weights.gpa);
    assert.equal(contributions[1].points, Math.min(1, Math.max(0, student.sat / 100)) * policy.weights.sat);
    for (const { key, points } of contributions.slice(2)) assert.equal(points, student[key] ? policy.weights[key] : 0);
    assert.ok(Math.abs(contributions.reduce((sum, item) => sum + item.points, 0) - scoreStudent(student, policy)) < 1e-10);
    assert.equal(contributions[0].points + contributions[1].points, scoreCoordinates(student, policy).academic);
    for (const threshold of [0, 30, 50, 75, 100]) {
      assert.deepEqual(scoreContributions(student, { ...policy, threshold }), contributions);
    }
  }
});

test('Score contributions handle null students, clamping, and zero or negative weights', () => {
  const keys = ['gpa', 'sat', 'firstGen', 'athlete', 'resident'];
  const zeros = keys.map(key => ({ key, points: 0 }));
  const negative = { weights: { gpa: -60, sat: 40, firstGen: -8, athlete: 5, resident: -7 }, threshold: -10 };
  assert.deepEqual(scoreContributions(null, negative), zeros);
  assert.deepEqual(scoreContributions(undefined, negative), zeros);
  assert.deepEqual(scoreContributions(records[0], { weights: {}, threshold: 20 }), zeros);
  assert.deepEqual(scoreContributions({ gpa: 5, sat: -10, firstGen: true, athlete: true, resident: false }, negative), [
    { key: 'gpa', points: -60 }, { key: 'sat', points: 0 },
    { key: 'firstGen', points: -8 }, { key: 'athlete', points: 5 }, { key: 'resident', points: 0 },
  ]);
  for (const profile of backgrounds) for (const gpa of [1, 2.4, 3.2, 4, 5]) for (const sat of [-10, 0, 50, 100, 110]) {
    const student = { ...profile, gpa, sat };
    const contributions = scoreContributions(student, negative);
    assert.ok(Math.abs(contributions.reduce((sum, item) => sum + item.points, 0) - scoreStudent(student, negative)) < 1e-10);
  }
});

test('Score-space boundaries stay on the exact cutoff within real score extents', () => {
  for (const preset of policies) for (let threshold = 0; threshold <= 100; threshold += 1) {
    const policy = { ...preset, threshold };
    const boundary = scoreSpaceBoundary(policy);
    const maxAcademic = policy.weights.gpa + policy.weights.sat;
    const maxBackground = backgroundScore(backgrounds[7], policy);
    assert.deepEqual(boundary.xDomain, [0, maxAcademic]);
    assert.deepEqual(boundary.yDomain, [0, maxBackground || 1]);
    assert.equal(boundary.relation, threshold === 0 ? 'all-admitted' : 'mixed');
    assert.ok(boundary.points.length >= 1 && boundary.points.length <= 2);
    for (const point of boundary.points) {
      assert.ok(point.x >= 0 && point.x <= maxAcademic);
      assert.ok(point.y >= 0 && point.y <= maxBackground);
      assert.equal(point.x + point.y, threshold);
    }
    if (maxBackground === 0) assert.deepEqual(boundary.points, [{ x: threshold, y: 0 }]);
  }
  assert.deepEqual(scoreSpaceBoundary(policies[1]).points, [{ x: 32, y: 20 }, { x: 52, y: 0 }]);
  assert.deepEqual(scoreSpaceBoundary({ ...policies[1], threshold: -1 }).points, []);
  assert.equal(scoreSpaceBoundary({ ...policies[1], threshold: -1 }).relation, 'all-admitted');
  assert.deepEqual(scoreSpaceBoundary({ ...policies[1], threshold: 101 }).points, []);
  assert.equal(scoreSpaceBoundary({ ...policies[1], threshold: 101 }).relation, 'none-admitted');
  assert.deepEqual(scoreSpaceBoundary({ ...policies[1], threshold: 100 }).points, [{ x: 80, y: 20 }]);
});

test('Score-space helpers handle zero and negative weights without inventing feasible axes', () => {
  const zero = { weights: {}, threshold: 0 };
  assert.deepEqual(scoreSpaceBoundary(zero), { xDomain: [0, 1], yDomain: [0, 1], points: [{ x: 0, y: 0 }], relation: 'all-admitted' });
  assert.deepEqual(scoreSpaceBoundary({ ...zero, threshold: 1 }).points, []);
  assert.equal(scoreSpaceBoundary({ ...zero, threshold: 1 }).relation, 'none-admitted');
  assert.deepEqual(scoreSpaceBoundary({ weights: { firstGen: 20 }, threshold: 10 }), {
    xDomain: [0, 1], yDomain: [0, 20], points: [{ x: 0, y: 10 }], relation: 'mixed',
  });
  const negative = { weights: { gpa: -60, sat: 40, firstGen: -8, athlete: 5, resident: -7 }, threshold: -10 };
  assert.deepEqual(scoreSpaceBoundary(negative), {
    xDomain: [-60, 40], yDomain: [-15, 5], points: [{ x: -15, y: 5 }, { x: 5, y: -15 }], relation: 'mixed',
  });
  for (const threshold of [-76, -75, -30, 0, 44, 45, 46]) {
    const boundary = scoreSpaceBoundary({ ...negative, threshold });
    assert.equal(boundary.relation, threshold <= -75 ? 'all-admitted' : threshold > 45 ? 'none-admitted' : 'mixed');
    for (const { x, y } of boundary.points) {
      assert.ok(x >= -60 && x <= 40 && y >= -15 && y <= 5);
      assert.equal(x + y, threshold);
    }
  }
  for (const profile of backgrounds) for (const gpa of [1, 2.4, 3.2, 4, 5]) for (const sat of [-10, 0, 50, 100, 110]) {
    const student = { ...profile, gpa, sat };
    assert.equal(scoreCoordinates(student, negative).total, scoreStudent(student, negative));
  }
  assert.deepEqual(scoreSpaceBoundary({ weights: { gpa: -20, firstGen: -10 }, threshold: -15 }), {
    xDomain: [-20, 0], yDomain: [-10, 0], points: [{ x: -15, y: 0 }, { x: -5, y: -10 }], relation: 'mixed',
  });
});

test('Boundary view helpers leave records and policies unchanged', () => {
  const policy = Object.freeze({ ...policies[1], weights: Object.freeze({ ...policies[1].weights }) });
  const student = Object.freeze({ ...records[0] });
  const before = JSON.stringify({ policy, student });
  scoreCoordinates(student, policy);
  scoreContributions(student, policy);
  scoreSpaceBoundary(policy);
  assert.equal(JSON.stringify({ policy, student }), before);
  assert.notEqual(scoreContributions(student, policy), scoreContributions(student, policy));
});

test('Student dragging edits only hypothetical GPA/SAT, matches slider steps, and respects chart limits', () => {
  const student = Object.freeze({ id: 'test', gpa: 3.2, sat: 80, firstGen: true, athlete: false, resident: true, referenceOutcome: false });
  assert.deepEqual(studentAfterDrag(student, 0, 0), student);
  assert.deepEqual(studentAfterDrag(student, .1, .2), { ...student, gpa: 3.34, sat: 88 });
  assert.deepEqual(studentAfterDrag(student, -.1, -.2), { ...student, gpa: 3.06, sat: 72 });
  assert.deepEqual(studentAfterDrag(student, 10, -10), { ...student, gpa: 4, sat: 60 });
  assert.deepEqual(studentAfterDrag(student, -10, 10), { ...student, gpa: 2.6, sat: 100 });
  assert.equal(studentAfterDrag(student, .01234, .02345).gpa, 3.22);
  assert.equal(studentAfterDrag(student, .01234, .02345).sat, 81);
  assert.notEqual(studentAfterDrag(student, 0, 0), student);
  const baseline = policies.map(policy => confusionMatrix(records, policy, 'referenceOutcome'));
  records.forEach(record => studentAfterDrag(record, .25, .25));
  assert.deepEqual(policies.map(policy => confusionMatrix(records, policy, 'referenceOutcome')), baseline);
});

test('Boundary dragging translates the weighted score, preserves grab offset, and clamps to the slider range', () => {
  for (const policy of policies) {
    const { gpa, sat } = policy.weights;
    assert.equal(thresholdAfterDrag(policy, policy.threshold, 0, 0), policy.threshold);
    assert.equal(thresholdAfterDrag(policy, 50, .1, .1), Math.round(50 + .1 * (.875 * gpa + .4 * sat)));
    assert.equal(thresholdAfterDrag(policy, 50, -.1, -.1), Math.round(50 - .1 * (.875 * gpa + .4 * sat)));
    assert.equal(thresholdAfterDrag(policy, 50, .4 * sat / 100, -.875 * gpa / 100), 50, 'Along-boundary motion keeps the threshold');
    assert.equal(thresholdAfterDrag(policy, 50, 10, 10), 100);
    assert.equal(thresholdAfterDrag(policy, 50, -10, -10), 0);
    for (const profile of backgrounds) {
      const start = { ...profile, gpa: 3.1, sat: 80 };
      const moved = { ...profile, gpa: 3.24, sat: 84 };
      assert.equal(thresholdAfterDrag(policy, scoreStudent(start, policy), .1, .1), Math.round(scoreStudent(moved, policy)));
    }
  }
  assert.equal(thresholdAfterDrag({ weights: { gpa: 100 } }, 50, .1, 1), 59);
  assert.equal(thresholdAfterDrag({ weights: { sat: 100 } }, 50, 1, .1), 54);
  assert.equal(thresholdAfterDrag({ weights: {} }, 50, 1, 1), 50);
  assert.equal(thresholdAfterDrag({ weights: { gpa: -100 } }, 50, .1, 0), 41);
});

test('Confusion matrix counts all four outcomes and excludes missing or non-boolean reference labels', () => {
  const policy = { weights: { gpa: 100 }, threshold: 50 };
  const samples = [
    { gpa: 4, sat: 50, reference: true },
    { gpa: 4, sat: 50, reference: false },
    { gpa: 2.4, sat: 50, reference: true },
    { gpa: 2.4, sat: 50, reference: false },
    { gpa: 4, sat: 50, reference: null },
    { gpa: 4, sat: 50 },
    { gpa: 4, sat: 50, reference: 'false' },
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
  const repeated = toPercentileClassroomView(createSyntheticClassroomView());
  assert.deepEqual(repeated.records, records);
  assert.ok(records.every(record => typeof record.referenceOutcome === 'boolean'));
  assert.deepEqual(policies.map(policy => records.filter(record => getDecision(record, policy)).length), [45, 55, 51]);
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
      assert.ok(p.x >= 2.6 && p.x <= 4 && p.y >= 60 && p.y <= 100);
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
      const score = (.125 + .875 * p.x) * policy.weights.gpa + (.6 + .4 * p.y) * policy.weights.sat;
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
  assert.equal(admissionBoundary(policy(0, 100, 80)).points.length, 2);
  assert.deepEqual(admissionBoundary(policy(0, 0, 0)), { points: [], relation: 'all-admitted' });
  assert.deepEqual(admissionBoundary(policy(0, 0, 1)), { points: [], relation: 'none-admitted' });
  for (const p of admissionBoundary(policy(-60, 40, -10)).points) assert.ok(Math.abs(scoreStudent({ gpa: p.x, sat: p.y }, policy(-60, 40, -10)) + 10) < 1e-8);
  assert.equal(getDecision({ gpa: 4, sat: 60 }, policy(60, 40, 60)), true);
});

 test('SAT conversion is fixed, preserves source data and labels, and is applied once', () => {
  const raw = createSyntheticClassroomView();
  const before = JSON.stringify(raw);
  const converted = toPercentileClassroomView(raw);
  assert.equal(satScoreToPercentile(1330), 88);
  assert.equal(satScoreToPercentile(1100), 62);
  assert.equal(satScoreToPercentile(1460), 96);
  assert.throws(() => satScoreToPercentile(88));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(toPercentileClassroomView(converted), converted);
  assert.deepEqual(converted.records.map(s => s.referenceOutcome), raw.records.map(s => s.referenceOutcome));
  assert.ok(converted.records.every(s => s.sat >= 0 && s.sat <= 100));
});

test('Equal percentile-point edits have equal score effects and boundary midpoints stay linear', () => {
  const policy = policies[1];
  for (const sat of [10, 50, 80]) {
    const student = { gpa: 3.2, sat };
    assert.ok(Math.abs(scoreStudent({...student, sat: sat + 5}, policy) - scoreStudent(student, policy) - 1.75) < 1e-9);
  }
  for (const profile of backgrounds) {
    const points = admissionBoundary(policy, backgroundScore(profile, policy)).points;
    if (points.length === 2) {
      const midpoint = { ...profile, gpa: (points[0].x + points[1].x) / 2, sat: (points[0].y + points[1].y) / 2 };
      assert.ok(Math.abs(scoreStudent(midpoint, policy) - policy.threshold) < 1e-9);
    }
  }
});
