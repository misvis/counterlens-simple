import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORER_SIMULATION_POLICIES } from '../shared/explorerPolicies.js';
import { admissionBoundary, backgroundScore } from '../shared/admissionModel.js';
import { cutoffMatchesContext, getExplorerCutoff } from './explorerCutoff.js';

const academic = EXPLORER_SIMULATION_POLICIES.find(policy => policy.id === 'academic');
const holistic = EXPLORER_SIMULATION_POLICIES.find(policy => policy.id === 'holistic');
const profile = {
  id: 'example', gpa: 3.2, sat: 85, ethnicity: 'Asian', residency: 'outofstate',
  zipIncome: 109768, major: 'CompSci', transfer: 'no', mathStatus: 'None',
};

test('unselected Academic Focus has the same GPA/SAT boundary in every background panel', () => {
  const cutoff = getExplorerCutoff(academic, null);
  assert.equal(cutoff.scope, 'all');
  assert.equal(cutoff.profile, null);
  assert.equal(cutoff.score, 0);
  assert.equal(cutoff.boundary.points.length, 2);
  for (const point of cutoff.boundary.points) {
    const academicScore = (point.x - 2.4) / 1.6 * 60 + point.y / 100 * 40;
    assert.ok(Math.abs(academicScore - academic.threshold) < 1e-8);
  }
  for (const residency of ['instate', 'outofstate']) {
    assert.equal(cutoffMatchesContext(cutoff, [{ key: 'residency', option: { value: residency } }]), true);
  }
  assert.equal(cutoffMatchesContext(cutoff, [{ key: 'zipIncome', option: { min: 0, max: 50000 } }]), true);
});

test('the shared boundary follows the current threshold and handles off-chart thresholds', () => {
  const original = getExplorerCutoff(academic, null).boundary;
  const changedPolicy = { ...academic, threshold: 70 };
  const changed = getExplorerCutoff(changedPolicy, null).boundary;
  assert.notDeepEqual(changed.points, original.points);
  for (const point of changed.points) {
    assert.ok(Math.abs((point.x - 2.4) / 1.6 * 60 + point.y / 100 * 40 - 70) < 1e-8);
  }
  assert.equal(getExplorerCutoff({ ...academic, threshold: 0 }, null).boundary.points.length, 0);
});

test('background-dependent policies do not get a default line, even if named academic', () => {
  for (const policy of EXPLORER_SIMULATION_POLICIES.filter(item => item.id !== 'academic')) {
    assert.equal(getExplorerCutoff(policy, null), null);
  }
  assert.equal(getExplorerCutoff({ ...holistic, id: 'academic' }, null), null);
  assert.equal(getExplorerCutoff({ ...academic, id: 'opportunity' }, null), null);
});

test('a selected profile retains its exact income boundary and only its matching panels', () => {
  const cutoff = getExplorerCutoff(holistic, profile);
  assert.equal(cutoff.scope, 'profile');
  assert.equal(cutoff.profile, profile);
  assert.equal(cutoff.score, backgroundScore(profile, holistic));
  assert.deepEqual(cutoff.boundary, admissionBoundary(holistic, backgroundScore(profile, holistic)));
  const midpointCutoff = getExplorerCutoff(holistic, { ...profile, zipIncome: 112500 });
  assert.notDeepEqual(cutoff.boundary, midpointCutoff.boundary);
  assert.equal(cutoffMatchesContext(cutoff, [{ key: 'residency', option: { value: 'outofstate' } }]), true);
  assert.equal(cutoffMatchesContext(cutoff, [{ key: 'residency', option: { value: 'instate' } }]), false);
  assert.equal(cutoffMatchesContext(cutoff, [{ key: 'zipIncome', option: { min: 100000, max: 125000 } }]), true);
  assert.equal(cutoffMatchesContext(cutoff, [{ key: 'zipIncome', option: { min: 75000, max: 100000 } }]), false);
  const selectedAcademic = getExplorerCutoff(academic, profile);
  assert.equal(selectedAcademic.scope, 'profile');
  assert.equal(cutoffMatchesContext(selectedAcademic, [{ key: 'residency', option: { value: 'instate' } }]), false);
});
