import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { scoreStudent, getDecision, backgroundScore, admissionBoundary, backgroundBoundaryBand } from './admissionModel.js';

const { policies, records } = createSyntheticClassroomView();
const backgrounds = Array.from({ length: 8 }, (_, i) => ({ firstGen: Boolean(i & 1), athlete: Boolean(i & 2), resident: Boolean(i & 4) }));

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
