import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { toPercentileClassroomView } from './satPercentiles.js';
import { ADMISSION_DOMAINS, backgroundScore, confusionMatrix, scoreStudent } from './admissionModel.js';
import { backgroundScenarios } from './backgroundScenarios.js';
import { FACET_FEATURES, facetedBackgrounds } from './facetedBackgrounds.js';

const { policies, records } = toPercentileClassroomView(createSyntheticClassroomView());
const holistic = policies.find(policy => policy.id === 'holistic');
const academic = policies.find(policy => policy.id === 'academic');
const selectedStudent = records.find(student => student.id === 'S47');
const subsets = Array.from({ length: 8 }, (_, mask) => FACET_FEATURES.filter((_, index) => mask & (1 << index)));

test('Conditional bands bound the exact hidden-background cutoffs for every grouping and weight sign', () => {
  for (const weights of [holistic.weights, { ...holistic.weights, firstGen: -8, athlete: 5, resident: -7 }, { gpa: 0, sat: 0, athlete: 10 }]) {
    for (const threshold of [-10, 0, 5, 52, 75, 110]) {
      const policy = { ...holistic, weights, threshold };
      const complete = backgroundScenarios({ students: [], policy });
      for (const selectedFeatures of subsets) {
        const panels = facetedBackgrounds({ students: records, policy, selectedFeatures, selectedStudent });
        for (const panel of panels) {
          const possible = complete.filter(p => Object.entries(panel.context).every(([key, value]) => p.context[key] === value));
          const scores = possible.map(p => p.backgroundScore);
          const min = Math.min(...scores), max = Math.max(...scores);
          assert.equal(panel.cutoffBand.hasContext, max > min);
          if (panel.plotRelation !== 'mixed') assert.deepEqual(panel.cutoffBand.polygon, []);
          for (const [i, edge] of panel.cutoffBand.edges.entries()) {
            const context = possible.find(p => p.backgroundScore === (i === 0 ? min : max)).context;
            for (const point of edge.points) assert.ok(Math.abs(scoreStudent({ ...context, gpa: point.x, sat: point.y }, policy) - threshold) < 1e-8);
          }
          for (const point of panel.cutoffBand.polygon) {
            const academicPoints = scoreStudent({ gpa: point.x, sat: point.y }, policy);
            assert.ok(academicPoints + max >= threshold - 1e-8);
            assert.ok(academicPoints + min <= threshold + 1e-8);
            assert.ok(point.x >= ADMISSION_DOMAINS.gpa[0] && point.x <= ADMISSION_DOMAINS.gpa[1]);
            assert.ok(point.y >= ADMISSION_DOMAINS.sat[0] && point.y <= ADMISSION_DOMAINS.sat[1]);
          }
          if (panel.profileBoundary) for (const point of panel.profileBoundary.points) {
            assert.ok(Math.abs(scoreStudent({ ...panel.scenario.student, gpa: point.x, sat: point.y }, policy) - threshold) < 1e-8);
          }
        }
      }
    }
  }
});

test('Whole-Person Review keeps a visible range with no grouping and exact lines when fully grouped', () => {
  const policy = { ...holistic, threshold: 52 };
  const [all] = facetedBackgrounds({ students: records, policy });
  assert.ok(all.cutoffBand.polygon.length >= 3);
  assert.ok(all.cutoffBand.edges.some(edge => edge.points.length > 1));
  const full = facetedBackgrounds({ students: records, policy, selectedFeatures: FACET_FEATURES });
  assert.ok(full.every(panel => !panel.cutoffBand.hasContext && panel.cutoffBand.polygon.length === 0));
  const [low] = facetedBackgrounds({ students: records, policy: { ...policy, threshold: -1 } });
  const [high] = facetedBackgrounds({ students: records, policy: { ...policy, threshold: 101 } });
  assert.equal(low.plotRelation, 'all-admitted');
  assert.equal(high.plotRelation, 'none-admitted');
  assert.equal(backgroundScore(selectedStudent, policy), 7);
});

test('Every feature subset partitions all original students exactly once into 1, 2, 4 or 8 panels', () => {
  for (const selectedFeatures of subsets) {
    const panels = facetedBackgrounds({ students: records, policy: holistic, selectedFeatures });
    assert.equal(panels.length, 2 ** selectedFeatures.length);
    assert.equal(new Set(panels.map(panel => panel.id)).size, panels.length);
    const members = panels.flatMap(panel => panel.members);
    assert.equal(members.length, records.length);
    assert.deepEqual(new Set(members), new Set(records));
    for (const panel of panels) {
      assert.deepEqual(Object.keys(panel.context), selectedFeatures);
      assert.ok(panel.members.every(student => selectedFeatures.every(field => student[field] === panel.context[field])));
      assert.equal(panel.scenario, null);
    }
  }
  const [all] = facetedBackgrounds({ students: records, policy: holistic });
  assert.equal(all.id, 'all-students');
  assert.deepEqual(all.context, {});
  assert.deepEqual(all.members, records);
});

test('Empty groups remain visible and panel order stays stable regardless of selection order', () => {
  const panels = facetedBackgrounds({ students: [selectedStudent], policy: holistic, selectedFeatures: FACET_FEATURES });
  assert.equal(panels.filter(panel => panel.members.length === 0).length, 7);
  assert.deepEqual(panels.map(panel => panel.context), [
    { resident: true, firstGen: false, athlete: false },
    { resident: true, firstGen: false, athlete: true },
    { resident: true, firstGen: true, athlete: false },
    { resident: true, firstGen: true, athlete: true },
    { resident: false, firstGen: false, athlete: false },
    { resident: false, firstGen: false, athlete: true },
    { resident: false, firstGen: true, athlete: false },
    { resident: false, firstGen: true, athlete: true },
  ]);
  const reversed = facetedBackgrounds({ students: [selectedStudent], policy: holistic,
    selectedFeatures: ['athlete', 'resident', 'firstGen', 'athlete', 'unknown'] });
  assert.deepEqual(reversed, panels);
  assert.equal(facetedBackgrounds({ students: [], policy: holistic, selectedFeatures: ['athlete'] }).length, 2);
});

test('Hypothetical profiles change selected dimensions and hold omitted dimensions at the active profile', () => {
  const draftStudent = { ...selectedStudent, gpa: 3.8, sat: 99, firstGen: true, athlete: true, resident: false };
  for (const selectedFeatures of subsets) {
    const panels = facetedBackgrounds({ students: records, policy: holistic, selectedStudent, draftStudent, selectedFeatures });
    for (const panel of panels) {
      const scenario = panel.scenario;
      assert.equal(scenario.student.gpa, draftStudent.gpa);
      assert.equal(scenario.student.sat, draftStudent.sat);
      for (const field of FACET_FEATURES) {
        assert.equal(scenario.student[field], selectedFeatures.includes(field) ? panel.context[field] : draftStudent[field]);
      }
      assert.equal(scenario.score, scoreStudent(scenario.student, holistic));
      assert.equal(scenario.admitted, scenario.score >= holistic.threshold);
      assert.equal(scenario.isOriginal, false);
    }
    const [current] = panels.filter(panel => panel.scenario.isDraft);
    assert.ok(current);
    assert.equal(panels.filter(panel => panel.scenario.isDraft).length, 1);
    assert.ok(selectedFeatures.every(field => current.context[field] === draftStudent[field]));
    assert.equal(panels.filter(panel => panel.members.includes(selectedStudent)).length, 1);
  }
});

test('Original and edited background markers are identified without changing original group membership', () => {
  const draftStudent = { ...selectedStudent, resident: !selectedStudent.resident };
  const panels = facetedBackgrounds({ students: records, policy: holistic, selectedStudent, draftStudent, selectedFeatures: ['resident'] });
  const original = panels.find(panel => panel.scenario.isOriginal);
  const edited = panels.find(panel => panel.scenario.isDraft);
  assert.ok(original.members.includes(selectedStudent));
  assert.ok(!edited.members.includes(selectedStudent));
  assert.notEqual(original, edited);
  for (const selectedFeatures of subsets) {
    const unchanged = facetedBackgrounds({ students: records, policy: holistic, selectedStudent, selectedFeatures });
    assert.equal(unchanged.filter(panel => panel.scenario.isOriginal).length, 1);
    assert.ok(unchanged.every(panel => !panel.scenario.isDraft));
  }
  const [unselected] = facetedBackgrounds({ students: records, policy: holistic, draftStudent });
  assert.equal(unselected.scenario, null);
});

test('Cutoff lines only appear when all omitted backgrounds have the same score contribution', () => {
  const complete = backgroundScenarios({ students: records, policy: holistic });
  for (const selectedFeatures of subsets) {
    const panels = facetedBackgrounds({ students: records, policy: holistic, selectedFeatures });
    for (const [index, panel] of panels.entries()) {
      assert.equal(panel.hasMixedBackgrounds, selectedFeatures.length < 3);
      if (panel.hasMixedBackgrounds) {
        assert.deepEqual(panel.boundary, { points: [], relation: 'varied' });
        assert.deepEqual(panel.admittedPolygon, []);
        assert.equal(panel.backgroundScore, null);
      } else {
        assert.deepEqual(panel.boundary, complete[index].boundary);
        assert.deepEqual(panel.admittedPolygon, complete[index].admittedPolygon);
        assert.equal(panel.backgroundScore, complete[index].backgroundScore);
      }
    }
    const academicPanels = facetedBackgrounds({ students: records, policy: academic, selectedFeatures });
    const exact = backgroundScenarios({ students: [], policy: academic })[0];
    for (const panel of academicPanels) {
      assert.equal(panel.hasMixedBackgrounds, false);
      assert.deepEqual(panel.boundary, exact.boundary);
      assert.deepEqual(panel.admittedPolygon, exact.admittedPolygon);
    }
  }
});

test('Zero and negative background weights and sparse cohorts do not create a misleading common cutoff', () => {
  const policy = { weights: { gpa: 45, sat: 35, resident: -7, athlete: 0, firstGen: 0 }, threshold: 52 };
  for (const students of [[], [selectedStudent], records]) {
    const unsplit = facetedBackgrounds({ students, policy });
    assert.equal(unsplit[0].hasMixedBackgrounds, true);
    const split = facetedBackgrounds({ students, policy, selectedFeatures: ['resident'] });
    assert.deepEqual(split.map(panel => panel.backgroundScore), [-7, 0]);
    assert.ok(split.every(panel => !panel.hasMixedBackgrounds));
    for (const panel of split) {
      for (const point of panel.boundary.points) {
        assert.ok(Math.abs(scoreStudent({ ...panel.context, gpa: point.x, sat: point.y }, policy) - policy.threshold) < 1e-8);
      }
    }
  }
  // Opposing weights can sum to zero in one combination, but other combinations differ.
  const cancelling = { ...policy, weights: { ...policy.weights, firstGen: 7, athlete: -7, resident: 0 } };
  assert.equal(facetedBackgrounds({ students: [], policy: cancelling })[0].hasMixedBackgrounds, true);
});

test('Faceting and hypothetical edits leave records, counts and confusion matrix unchanged', () => {
  const students = Object.freeze(records.map(record => Object.freeze({ ...record })));
  const original = students.find(student => student.id === 'S47');
  const draftStudent = Object.freeze({ ...original, gpa: 4, sat: 100, resident: false, athlete: true });
  const policy = Object.freeze({ ...holistic, weights: Object.freeze({ ...holistic.weights }) });
  const before = JSON.stringify({ students, draftStudent, policy });
  const matrix = confusionMatrix(students, policy, 'referenceOutcome');
  for (const selectedFeatures of subsets) {
    const panels = facetedBackgrounds({ students, policy, selectedStudent: original, draftStudent, selectedFeatures });
    assert.equal(panels.reduce((count, panel) => count + panel.members.length, 0), records.length);
    for (const panel of panels) {
      assert.ok(!panel.members.includes(panel.scenario.student));
      assert.ok(!students.includes(panel.scenario.student));
    }
  }
  assert.equal(JSON.stringify({ students, draftStudent, policy }), before);
  assert.deepEqual(confusionMatrix(students, policy, 'referenceOutcome'), matrix);
});
