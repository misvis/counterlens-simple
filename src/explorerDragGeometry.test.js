import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_DOMAINS, scoreStudent } from '../shared/admissionModel.js';
import { EXPLORER_SIMULATION_POLICIES } from '../shared/explorerPolicies.js';
import { explorerDragDelta, explorerStudentAfterDrag, explorerThresholdAfterDrag } from './explorerDragGeometry.js';

const academic = EXPLORER_SIMULATION_POLICIES.find(policy => policy.id === 'academic');
const start = { x: 100, y: 100 };
const student = { id: 'S129', gpa: 3.14, sat: 86, residency: 'outofstate', zipIncome: 109768 };

test('dragging right/up raises GPA/SAT without changing original records or backgrounds', () => {
  const original = { ...student };
  const next = explorerStudentAfterDrag(student, start, { x: 200, y: 60 }, 700, 400, ADMISSION_DOMAINS);
  assert.deepEqual(next, { ...student, gpa: 3.34, sat: 90 });
  assert.deepEqual(student, original);
  assert.notEqual(next, student);
  const reverse = explorerStudentAfterDrag(next, { x: 200, y: 60 }, start, 700, 400, ADMISSION_DOMAINS);
  assert.deepEqual(reverse, student);
});

test('expanded axes use actual plot scales rather than the narrower editor domain', () => {
  const domains = { gpa: [2, 4], sat: [0, 100] };
  const next = explorerStudentAfterDrag(student, start, { x: 150, y: 80 }, 500, 200, domains);
  assert.equal(next.gpa, 3.34);
  assert.equal(next.sat, 96);
  const delta = explorerDragDelta(start, { x: 150, y: 80 }, 500, 200, domains);
  assert.ok(Math.abs(delta.gpa * 1.4 - .2) < 1e-10);
  assert.equal(delta.sat * 40, 10);
});

test('cutoff translation follows the same academic score change at every plot size', () => {
  const domains = { gpa: [2, 4], sat: [0, 100] };
  const point = { x: 140, y: 80 };
  const next = explorerStudentAfterDrag(student, start, point, 500, 200, domains);
  const expected = Math.round(62 + scoreStudent(next, academic) - scoreStudent(student, academic));
  assert.equal(explorerThresholdAfterDrag(academic, 62, start, point, 500, 200, domains), expected);
  assert.equal(explorerThresholdAfterDrag(academic, 62, start, { x: 180, y: 60 }, 1000, 400, domains), expected);
  assert.equal(explorerThresholdAfterDrag(academic, 62, start, start, 500, 200, domains), 62);
});

test('dragging clamps to editor limits and retains the editor step sizes', () => {
  const high = explorerStudentAfterDrag(student, start, { x: 10000, y: -10000 }, 700, 400, ADMISSION_DOMAINS);
  const low = explorerStudentAfterDrag(student, start, { x: -10000, y: 10000 }, 700, 400, ADMISSION_DOMAINS);
  assert.equal(high.gpa, 4);
  assert.equal(high.sat, 100);
  assert.equal(low.gpa, 2.6);
  assert.equal(low.sat, 60);
  assert.equal(explorerThresholdAfterDrag(academic, 62, start, { x: 10000, y: -10000 }, 700, 400, ADMISSION_DOMAINS), 100);
  assert.equal(explorerThresholdAfterDrag(academic, 62, start, { x: -10000, y: 10000 }, 700, 400, ADMISSION_DOMAINS), 0);
  const stepped = explorerStudentAfterDrag(student, start, { x: 104, y: 94 }, 700, 400, ADMISSION_DOMAINS);
  assert.equal(stepped.gpa, 3.15);
  assert.equal(stepped.sat, 87);
});
