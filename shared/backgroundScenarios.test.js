import { toPercentileClassroomView } from './satPercentiles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { ADMISSION_DOMAINS, confusionMatrix, scoreStudent } from './admissionModel.js';
import { backgroundScenarios } from './backgroundScenarios.js';

const { policies, records } = toPercentileClassroomView(createSyntheticClassroomView());
const selectedStudent = records.find(student => student.id === 'S47');
const holistic = policies.find(policy => policy.id === 'holistic');
const academic = policies.find(policy => policy.id === 'academic');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('S47 has eight exact Holistic scenarios on common academic inputs and one original profile', () => {
  const panels = backgroundScenarios({ students: records, policy: holistic, selectedStudent });
  assert.deepEqual(panels.map(panel => panel.context), [
    { firstGen: false, athlete: false, resident: true },
    { firstGen: false, athlete: true, resident: true },
    { firstGen: true, athlete: false, resident: true },
    { firstGen: true, athlete: true, resident: true },
    { firstGen: false, athlete: false, resident: false },
    { firstGen: false, athlete: true, resident: false },
    { firstGen: true, athlete: false, resident: false },
    { firstGen: true, athlete: true, resident: false },
  ]);
  const academicPoints = ((3.05 - 2.4) / 1.6) * 45 + (88 / 100) * 35;
  panels.forEach((panel, index) => {
    near(panel.scenario.score, academicPoints + [7, 12, 15, 20, 0, 5, 8, 13][index]);
    assert.equal(panel.scenario.student.gpa, 3.05);
    assert.equal(panel.scenario.student.sat, 88);
    assert.equal(panel.scenario.isOriginal, index === 0);
    assert.equal(panel.scenario.isDraft, false);
  });
  assert.deepEqual(panels.map(panel => panel.scenario.admitted), [true, true, true, true, false, true, true, true]);
  assert.equal(panels.filter(panel => panel.members.includes(selectedStudent)).length, 1);
  assert.equal(panels[0].members.includes(selectedStudent), true);
});

test('Academic scores, decision regions and boundaries coincide across background scenarios', () => {
  const panels = backgroundScenarios({ students: records, policy: academic, selectedStudent });
  for (const panel of panels) {
    assert.equal(panel.scenario.score, panels[0].scenario.score);
    assert.equal(panel.scenario.admitted, panels[0].scenario.admitted);
    assert.deepEqual(panel.boundary, panels[0].boundary);
    assert.deepEqual(panel.admittedPolygon, panels[0].admittedPolygon);
  }
});

test('Eight backgrounds partition all original records once, including empty groups', () => {
  const panels = backgroundScenarios({ students: records, policy: holistic });
  assert.equal(panels.length, 8);
  assert.equal(new Set(panels.map(panel => panel.id)).size, 8);
  const members = panels.flatMap(panel => panel.members);
  assert.equal(new Set(members).size, records.length);
  assert.equal(members.length, records.length);
  for (const panel of panels) {
    assert.equal(panel.scenario, null);
    assert.ok(panel.members.every(student => ['firstGen', 'athlete', 'resident'].every(key => student[key] === panel.context[key])));
  }
  const sparse = backgroundScenarios({ students: [selectedStudent], policy: holistic });
  assert.equal(sparse.filter(panel => !panel.members.length).length, 7);
});

test('Edits keep original membership and identify exactly one current background', () => {
  const draftStudent = { ...selectedStudent, gpa: 3.5, sat: 93, firstGen: true, resident: false };
  const panels = backgroundScenarios({ students: records, policy: holistic, selectedStudent, draftStudent });
  assert.ok(panels.every(panel => !panel.scenario.isOriginal));
  assert.ok(panels.every(panel => panel.scenario.student.gpa === 3.5 && panel.scenario.student.sat === 93));
  assert.equal(panels.filter(panel => panel.members.includes(selectedStudent)).length, 1);
  assert.deepEqual(panels.filter(panel => panel.scenario.isDraft).map(panel => panel.context), [{ firstGen: true, athlete: false, resident: false }]);
  const restored = backgroundScenarios({ students: records, policy: holistic, selectedStudent, draftStudent: { ...selectedStudent } });
  assert.equal(restored.filter(panel => panel.scenario.isOriginal).length, 1);
});

test('Hypothetical profiles never change cohort records, membership counts or confusion matrices', () => {
  const students = Object.freeze(records.map(student => Object.freeze({ ...student })));
  const original = students.find(student => student.id === 'S47');
  const policy = Object.freeze({ ...holistic, weights: Object.freeze({ ...holistic.weights }) });
  const draftStudent = Object.freeze({ ...original, gpa: 4, sat: 100, athlete: true });
  const matrix = confusionMatrix(students, policy, 'referenceOutcome');
  const before = JSON.stringify({ students, policy, draftStudent });
  const panels = backgroundScenarios({ students, policy, selectedStudent: original, draftStudent });
  for (const panel of panels) assert.ok(!students.includes(panel.scenario.student) && !panel.members.includes(panel.scenario.student));
  assert.equal(panels.reduce((total, panel) => total + panel.members.length, 0), students.length);
  assert.equal(JSON.stringify({ students, policy, draftStudent }), before);
  assert.deepEqual(confusionMatrix(students, policy, 'referenceOutcome'), matrix);
});

test('Shading and boundaries handle zero, negative, off-chart and tangent weights', () => {
  const panelFor = (gpa, sat, threshold) => backgroundScenarios({
    students: [], policy: { weights: { gpa, sat }, threshold },
  })[0];
  const area = polygon => Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  assert.equal(panelFor(0, 0, 0).boundary.relation, 'all-admitted');
  near(area(panelFor(0, 0, 0).admittedPolygon), 1.4 * 40);
  assert.deepEqual(panelFor(0, 0, 1).admittedPolygon, []);
  assert.deepEqual(panelFor(60, 40, 101).admittedPolygon, []);
  assert.deepEqual(panelFor(60, 40, 100).admittedPolygon, []);
  assert.equal(panelFor(60, 40, 100).boundary.points.length, 1);
  assert.deepEqual(panelFor(100, 0, 100).admittedPolygon, []);
  assert.equal(panelFor(100, 0, 100).boundary.points.length, 2);
  near(area(panelFor(-100, 0, -50).admittedPolygon), 0.6 * 40);
  assert.ok(panelFor(-100, 0, -50).admittedPolygon.every(point => point.x <= 3.2));
  near(area(panelFor(0, 100, 80).admittedPolygon), 1.4 * 20);
  for (const weights of [{ gpa: -60, sat: 40 }, { gpa: 45, sat: 35 }, { gpa: 0, sat: -100 }]) {
    for (const threshold of [-101, -60, -10, 0, 50, 80, 101]) {
      const policy = { weights, threshold };
      const panel = backgroundScenarios({ students: [], policy })[0];
      for (const point of panel.admittedPolygon) {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert.ok(point.x >= ADMISSION_DOMAINS.gpa[0] && point.x <= ADMISSION_DOMAINS.gpa[1]);
        assert.ok(point.y >= ADMISSION_DOMAINS.sat[0] && point.y <= ADMISSION_DOMAINS.sat[1]);
        assert.ok(scoreStudent({ ...panel.context, gpa: point.x, sat: point.y }, policy) >= threshold - 1e-8);
      }
      for (const point of panel.boundary.points) near(scoreStudent({ ...panel.context, gpa: point.x, sat: point.y }, policy), threshold);
    }
  }
});
