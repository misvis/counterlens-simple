import test from 'node:test';
import assert from 'node:assert/strict';
import { deserialize, serialize } from 'node:v8';
import { createSyntheticClassroomView } from './classroomDataset.js';
import { toPercentileClassroomView } from './satPercentiles.js';
import {
  EXPLORER_FEATURES, enrichExplorerRecords, buildIncomeBins, buildExplorerGroups, getExplorerOptions,
  explorerScoringContext, summarizeExplorerOutcomes,
} from './featureExplorer.js';
import {
  EXPLORER_POLICY_ALGORITHM, EXPLORER_POLICY_REVISION, EXPLORER_BACKGROUND_KEYS,
  EXPLORER_SIMULATION_POLICIES, isExplorerPolicy, explorerBackgroundContributions,
  explorerBackgroundExtents,
} from './explorerPolicies.js';
import {
  backgroundScore, scoreStudent, scoreContributions, scoreCoordinates, getDecision,
  admissionBoundary, backgroundBoundaryBand, scoreSpaceBoundary, confusionMatrix,
} from './admissionModel.js';

const source = toPercentileClassroomView(createSyntheticClassroomView());
const records = enrichExplorerRecords(source.records);
const policies = EXPLORER_SIMULATION_POLICIES;
const keys = EXPLORER_FEATURES.map(feature => feature.key);
const clone = value => deserialize(serialize(value));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${message || 'Numeric equality'}: ${actual} ≠ ${expected}`);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Independent oracle: use the documented category lookup and endpoint
// interpolation, without calling any model contribution or extent helper.
const rulePoints = (rule, value) => {
  if (rule.type === 'categorical') return typeof value === 'string' && Object.hasOwn(rule.points, value)
    ? rule.points[value] : 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const [start, end] = rule.domain;
  const [startPoints, endPoints] = rule.points;
  return (endPoints * (clamp(value, start, end) - start)
    + startPoints * (end - clamp(value, start, end))) / (end - start);
};
const expectedBackground = (record, policy) => keys.reduce((sum, key) => sum + rulePoints(policy.backgroundRules[key], record?.[key]), 0);
const expectedScore = (record, policy) => clamp((record.gpa - 2.4) / 1.6, 0, 1) * policy.weights.gpa
  + clamp(record.sat / 100, 0, 1) * policy.weights.sat + expectedBackground(record, policy);
const candidates = (policy, context = {}) => keys.reduce((profiles, key) => {
  const rule = policy.backgroundRules[key];
  let values;
  if (Object.hasOwn(context, key)) {
    const value = context[key];
    values = rule.type === 'linear' && value && typeof value === 'object'
      ? [Math.max(rule.domain[0], value.min), Math.min(rule.domain[1], value.max)] : [value];
  } else values = rule.type === 'categorical' ? [...Object.keys(rule.points), null]
    : [0, 25000, 70000, 150000, 250000, null];
  return profiles.flatMap(profile => values.map(value => ({ ...profile, [key]: value })));
}, [{}]);

test('Simulation policies use the six declared backgrounds and exclude legacy boolean inputs', () => {
  assert.equal(EXPLORER_POLICY_ALGORITHM, 'explorer_weighted_sum_v1');
  assert.equal(EXPLORER_POLICY_REVISION, 'six-background-simulation-v4');
  assert.deepEqual(EXPLORER_BACKGROUND_KEYS, keys);
  assert.deepEqual(policies.map(policy => policy.id), ['academic', 'holistic', 'opportunity']);
  for (const policy of policies) {
    assert.equal(isExplorerPolicy(policy), true);
    assert.equal(policy.simulationRevision, EXPLORER_POLICY_REVISION);
    assert.deepEqual(Object.keys(policy.weights).sort(), ['gpa', 'sat']);
    assert.deepEqual(Object.keys(policy.backgroundRules), keys);
    for (const feature of EXPLORER_FEATURES.filter(item => item.type === 'categorical')) {
      assert.deepEqual(Object.keys(policy.backgroundRules[feature.key].points).sort(), feature.values.map(item => item.value).sort());
    }
    for (const record of records) {
      const score = scoreStudent(record, policy);
      for (const flags of [false, true]) close(scoreStudent({ ...record, firstGen: flags, athlete: flags, resident: flags }, policy), score);
    }
  }
  assert.equal(isExplorerPolicy(source.policies[0]), false);
});

test('Presets keep exact dataset enums, with zero background coefficients only for Academic Focus', () => {
  const ethnicity = {
    White: 0, Asian: 2, 'Black/African American': -1, 'Hispanic/Latino': 1, 'Not Specified': 0,
    'Two or More': -2,
    'Native Hawaiian/Other Pacific Islander': -2,
    'American Indian/Alaska Native': -2,
  };
  const majors = { Economics: -1, CompSci: 2, BiologicalSci: 1, CompEng: 3, Psychology: 0, Biochem: 2, ChemEng: 3, Math: 2 };
  for (const policy of policies) {
    const multiplier = policy.id === 'academic' ? 0 : 1;
    assert.deepEqual(policy.backgroundRules.ethnicity.points,
      Object.fromEntries(Object.entries(ethnicity).map(([key, points]) => [key, points * multiplier || 0])));
    assert.deepEqual(policy.backgroundRules.residency.points, { instate: 3 * multiplier, outofstate: 0 });
    assert.deepEqual(policy.backgroundRules.major.points,
      Object.fromEntries(Object.entries(majors).map(([key, points]) => [key, points * multiplier || 0])));
    assert.deepEqual(policy.backgroundRules.mathStatus.points, { Enrolled: 5 * multiplier, 'Not Enrolled': 2 * multiplier, None: 0 });
    for (const [key, obsolete] of [
      ['ethnicity', ['asian', 'black', 'hispanic', 'white', 'multiracial', 'not-reported', 'Native Hawaiian',
        'Two or More/Native Hawaiian/Other Pacific Islander/American Indian/Alaska Native']],
      ['residency', ['international']],
      ['major', ['computer-science', 'biology', 'psychology', 'business', 'engineering']],
      ['mathStatus', ['no-course', 'precalculus', 'calculus', 'statistics']],
    ]) for (const value of obsolete) {
      assert.equal(Object.hasOwn(policy.backgroundRules[key].points, value), false, `${key}/${value} was removed`);
      assert.equal(explorerBackgroundContributions({ [key]: value }, policy).find(item => item.key === key).points, 0);
    }
  }
});

test('Coalescing equally weighted ethnicity categories preserves current scores, decisions, and aggregate counts', () => {
  const split = ['Two or More', 'Native Hawaiian/Other Pacific Islander', 'American Indian/Alaska Native'];
  const combined = 'Two or More/Native Hawaiian/Other Pacific Islander/American Indian/Alaska Native';
  const previousRecords = records.map(record => ({ ...record, ethnicity: split.includes(record.ethnicity) ? combined : record.ethnicity }));
  const counts = [];
  for (const policy of policies) {
    const previousPoints = Object.fromEntries(Object.entries(policy.backgroundRules.ethnicity.points).filter(([value]) => !split.includes(value)));
    previousPoints[combined] = policy.id === 'academic' ? 0 : -2;
    const previousPolicy = { ...policy, simulationRevision: 'combined-category-test-fixture', backgroundRules: {
      ...policy.backgroundRules, ethnicity: { type: 'categorical', points: previousPoints },
    } };
    for (const [index, record] of records.entries()) {
      close(scoreStudent(record, policy), scoreStudent(previousRecords[index], previousPolicy));
      assert.equal(getDecision(record, policy), getDecision(previousRecords[index], previousPolicy));
    }
    assert.deepEqual(confusionMatrix(records, policy, 'referenceOutcome'), confusionMatrix(previousRecords, previousPolicy, 'referenceOutcome'));
    counts.push(records.filter(record => getDecision(record, policy)).length);
  }
  assert.deepEqual(counts, [45, 39, 47]);
});

test('Explicit None and Not Specified remain separate from missing values despite equal zero contributions', () => {
  const cohort = [
    { id: 'none', mathStatus: 'None', ethnicity: 'Not Specified' },
    { id: 'enrolled', mathStatus: 'Enrolled', ethnicity: 'Asian' },
    { id: 'not-enrolled', mathStatus: 'Not Enrolled', ethnicity: 'White' },
    { id: 'missing', mathStatus: null, ethnicity: null },
  ].map(record => ({ ...record, gpa: 3.2, sat: 80 }));
  for (const [key, explicit] of [['mathStatus', 'None'], ['ethnicity', 'Not Specified']]) {
    const options = getExplorerOptions(key, cohort);
    const explicitOption = options.find(item => item.value === explicit);
    const missing = options.find(item => item.missing);
    assert.ok(explicitOption && !explicitOption.missing);
    assert.ok(missing && missing.value !== explicit);
    const groups = buildExplorerGroups({ records: cohort, layout: { columns: key } });
    const panels = groups.sections.flatMap(section => section.panels);
    assert.deepEqual(panels.find(panel => panel.columnValue === explicit).members.map(record => record.id), ['none']);
    assert.deepEqual(panels.find(panel => panel.columnValue === missing.value).members.map(record => record.id), ['missing']);
    for (const policy of policies) for (const value of [explicit, null]) {
      assert.equal(explorerBackgroundContributions({ [key]: value }, policy).find(item => item.key === key).points, 0);
    }
  }
});

test('Every simulated score, eight contributions, and decision match an independent oracle', () => {
  for (const policy of policies) for (const record of records) {
    const contributions = scoreContributions(record, policy);
    assert.deepEqual(contributions.map(item => item.key), ['gpa', 'sat', ...keys]);
    assert.deepEqual(explorerBackgroundContributions(record, policy).map(item => item.key), keys);
    close(scoreStudent(record, policy), expectedScore(record, policy));
    close(backgroundScore(record, policy), expectedBackground(record, policy));
    close(contributions.reduce((sum, item) => sum + item.points, 0), expectedScore(record, policy));
    close(scoreCoordinates(record, policy).total, expectedScore(record, policy));
    for (const threshold of [0, 25, 49, 55, 56, 75, 100]) {
      assert.equal(getDecision(record, { ...policy, threshold }), expectedScore(record, policy) >= threshold);
      assert.deepEqual(scoreContributions(record, { ...policy, threshold }), contributions);
    }
  }
  const example = { gpa: 3.05, sat: 88, zipIncome: 102280, residency: 'instate',
    ethnicity: 'Two or More',
    major: 'BiologicalSci', transfer: 'yes', mathStatus: 'Enrolled' };
  close(scoreStudent(example, policies[1]), 54.33533, 'Fixed canonical-profile example under Whole Person Review');
  assert.equal(getDecision(example, policies[1]), false);
  assert.equal(getDecision({ ...example, ethnicity: 'Asian' }, policies[1]), true);
});

test('Academic Focus restores the original GPA/SAT rule and ignores every background edit', () => {
  const academic = policies.find(policy => policy.id === 'academic');
  const originalPolicy = source.policies.find(policy => policy.id === 'academic');
  assert.deepEqual(academic.weights, { gpa: 60, sat: 40 });
  assert.equal(academic.threshold, 62);
  assert.deepEqual(explorerBackgroundExtents(academic), [0, 0]);
  for (const record of records) {
    close(scoreStudent(record, academic), scoreStudent(record, originalPolicy));
    assert.equal(getDecision(record, academic), getDecision(record, originalPolicy));
    const line = admissionBoundary(academic, backgroundScore(record, academic));
    for (const key of keys) {
      const rule = academic.backgroundRules[key];
      const values = rule.type === 'categorical' ? [...Object.keys(rule.points), 'unlisted', null]
        : [-1, 0, 25000, 87500, 150000, 250000, null];
      for (const value of values) {
        const edited = { ...record, [key]: value };
        close(scoreStudent(edited, academic), scoreStudent(record, academic));
        assert.equal(getDecision(edited, academic), getDecision(record, academic));
        assert.deepEqual(admissionBoundary(academic, backgroundScore(edited, academic)), line);
      }
    }
  }
  const profile = { ...records[0], gpa: 3.2, sat: 70 };
  assert.ok(scoreStudent({ ...profile, gpa: 3.3 }, academic) > scoreStudent(profile, academic));
  assert.ok(scoreStudent({ ...profile, sat: 80 }, academic) > scoreStudent(profile, academic));
});

test('Income Support changes only the income bonus from Whole Person Review and monotonically favors lower ZIP income', () => {
  const holistic = policies.find(policy => policy.id === 'holistic');
  const incomeSupport = policies.find(policy => policy.id === 'opportunity');
  assert.deepEqual(holistic.weights, { gpa: 45, sat: 25 });
  assert.deepEqual(incomeSupport.weights, holistic.weights);
  assert.equal(holistic.threshold, 55);
  assert.equal(incomeSupport.threshold, holistic.threshold);
  for (const key of keys.filter(key => key !== 'zipIncome')) {
    assert.deepEqual(incomeSupport.backgroundRules[key], holistic.backgroundRules[key]);
  }
  const profile = { gpa: 3.3, sat: 80, ethnicity: 'White', residency: 'outofstate',
    major: 'Psychology', transfer: 'no', mathStatus: 'None' };
  const incomePoints = (zipIncome, policy) => explorerBackgroundContributions({ zipIncome }, policy)
    .find(item => item.key === 'zipIncome').points;
  let previous = Infinity;
  for (const zipIncome of [0, 25000, 50000, 87500, 100000, 150000, 250000]) {
    const bonus = incomePoints(zipIncome, incomeSupport);
    assert.ok(bonus <= previous);
    assert.ok(bonus >= incomePoints(zipIncome, holistic));
    close(scoreStudent({ ...profile, zipIncome }, incomeSupport) - scoreStudent({ ...profile, zipIncome }, holistic),
      5 * (1 - clamp((zipIncome - 25000) / 125000, 0, 1)));
    previous = bonus;
  }
  assert.equal(incomePoints(25000, holistic), 8);
  assert.equal(incomePoints(25000, incomeSupport), 13);
  assert.equal(getDecision({ ...profile, zipIncome: 25000 }, holistic), false);
  assert.equal(getDecision({ ...profile, zipIncome: 25000 }, incomeSupport), true);
  assert.equal(getDecision({ ...profile, zipIncome: 150000 }, incomeSupport), false);
  const [minimum, maximum] = explorerBackgroundExtents(incomeSupport);
  assert.ok(minimum < 0);
  assert.equal(incomeSupport.weights.gpa + incomeSupport.weights.sat + maximum, 100);
});

test('Each of the six background edits can change Whole Person Review and Income Support predictions and exact cutoffs', () => {
  for (const preset of policies.filter(policy => policy.id !== 'academic')) for (const key of keys) {
    const rule = preset.backgroundRules[key];
    const options = rule.type === 'categorical' ? Object.keys(rule.points) : [...rule.domain];
    options.sort((a, b) => rulePoints(rule, a) - rulePoints(rule, b));
    const before = { ...records[46], gpa: 3.3, sat: 80, [key]: options[0] };
    const after = { ...before, [key]: options.at(-1) };
    const low = expectedScore(before, preset), high = expectedScore(after, preset);
    assert.ok(high > low, `${preset.id}/${key} must have more than one contribution`);
    const policy = { ...preset, threshold: (low + high) / 2 };
    assert.equal(getDecision(before, policy), false);
    assert.equal(getDecision(after, policy), true);
    const original = admissionBoundary(policy, backgroundScore(before, policy));
    const edited = admissionBoundary(policy, backgroundScore(after, policy));
    assert.ok(original.points.length > 0 && edited.points.length > 0);
    assert.notDeepEqual(original.points, edited.points);
    for (const [profile, boundary] of [[before, original], [after, edited]]) for (const point of boundary.points) {
      close(expectedScore({ ...profile, gpa: point.x, sat: point.y }, policy), policy.threshold, `${preset.id}/${key} boundary`);
    }
  }
});

test('Income clamps at fixed monetary endpoints and missing or unlisted inputs contribute zero', () => {
  for (const policy of policies) {
    const rule = policy.backgroundRules.zipIncome;
    const incomePoints = value => explorerBackgroundContributions({ zipIncome: value }, policy).find(item => item.key === 'zipIncome').points;
    for (const value of [-1000, 0, 25000]) close(incomePoints(value), rule.points[0]);
    for (const value of [150000, 250000, 1e9]) close(incomePoints(value), rule.points[1]);
    close(incomePoints(87500), (rule.points[0] + rule.points[1]) / 2);
    for (const value of [undefined, null, NaN, Infinity, -Infinity, '', '25000', {}, []]) {
      assert.equal(incomePoints(value), 0);
      assert.deepEqual(explorerBackgroundExtents(policy, Object.fromEntries(keys.map(key => [key, value]))), [0, 0]);
    }
    for (const key of keys.filter(key => key !== 'zipIncome')) for (const value of [null, undefined, 'unlisted', 'constructor', '__proto__', 1, true]) {
      assert.equal(explorerBackgroundContributions({ [key]: value }, policy).find(item => item.key === key).points, 0);
    }
    assert.deepEqual(explorerBackgroundContributions(null, policy).map(item => item.points), keys.map(() => 0));
  }
});

test('Conditional cutoff ranges bound all category combinations and continuous income endpoints', () => {
  const contexts = [
    {}, { ethnicity: 'Asian' }, { residency: 'outofstate', transfer: 'yes' },
    { zipIncome: { min: 50000, max: 100000 } },
    { zipIncome: { min: -Infinity, max: 50000 }, major: 'CompEng' },
    { zipIncome: { min: 100000, max: Infinity }, mathStatus: 'Enrolled' },
    { ethnicity: null, major: 'unlisted', zipIncome: null },
  ];
  for (const policy of policies) for (const context of contexts) {
    const profiles = candidates(policy, context);
    const scores = profiles.map(profile => expectedBackground(profile, policy));
    const minimum = Math.min(...scores), maximum = Math.max(...scores);
    const extents = explorerBackgroundExtents(policy, context);
    close(extents[0], minimum);
    close(extents[1], maximum);
    const band = backgroundBoundaryBand(policy, context);
    close(band.minimum, minimum);
    close(band.maximum, maximum);
    assert.equal(band.hasContext, maximum - minimum > 1e-9);
    for (const profile of profiles) {
      const score = backgroundScore(profile, policy);
      assert.ok(score >= minimum - 1e-9 && score <= maximum + 1e-9);
    }
    for (const [index, edge] of band.edges.entries()) for (const point of edge.points) {
      const academic = clamp((point.x - 2.4) / 1.6, 0, 1) * policy.weights.gpa + point.y / 100 * policy.weights.sat;
      close(academic + [minimum, maximum][index], policy.threshold);
    }
    for (const point of band.polygon) {
      const academic = ((2.6 + point.x * 1.4 - 2.4) / 1.6) * policy.weights.gpa
        + (60 + point.y * 40) / 100 * policy.weights.sat;
      assert.ok(academic + maximum >= policy.threshold - 1e-8);
      assert.ok(academic + minimum <= policy.threshold + 1e-8);
    }
  }
});

test('Income-sensitive policies retain within-bin variation while exact income and academic-only rules have one cutoff', () => {
  const profile = records[46];
  for (const policy of policies) {
    const exact = Object.fromEntries(keys.map(key => [key, profile[key]]));
    const score = expectedBackground(profile, policy);
    assert.deepEqual(explorerBackgroundExtents(policy, exact), [score, score]);
    assert.equal(backgroundBoundaryBand(policy, exact).hasContext, false);
    const interval = { ...exact, zipIncome: { min: 50000, max: 100000 } };
    const band = backgroundBoundaryBand(policy, interval);
    assert.equal(band.hasContext, policy.id !== 'academic');
    if (policy.id === 'academic') assert.deepEqual([band.minimum, band.maximum], [0, 0]);
    else assert.ok(band.maximum > band.minimum);
    const bins = buildIncomeBins(records, { method: 'fixed', count: 3 });
    const grouped = buildExplorerGroups({ records, incomeBins: bins, layout: {
      columns: 'zipIncome', rows: 'ethnicity', sections: ['residency', 'major', 'transfer', 'mathStatus'],
    } });
    const panel = grouped.sections.flatMap(section => section.panels).find(item => item.members.some(record => record.id === profile.id));
    const context = explorerScoringContext(panel.context, policy);
    assert.deepEqual(Object.keys(context).sort(), keys.slice().sort());
    assert.equal(context.zipIncome.min, 100000);
    assert.equal(context.zipIncome.max, Infinity);
    const [minimum, maximum] = explorerBackgroundExtents(policy, context);
    assert.ok(score >= minimum && score <= maximum);
    assert.equal(backgroundBoundaryBand(policy, context).hasContext, policy.id !== 'academic');
  }
});

test('Facet contexts preserve raw categories, missing values and income intervals while legacy mapping remains unchanged', () => {
  const context = [
    { key: 'ethnicity', option: { value: 'raw:string:new-category', rawValue: 'new-category' } },
    { key: 'residency', option: { value: 'outofstate' } },
    { key: 'zipIncome', option: { value: 'income:50000:100000', min: 50000, max: 100000 } },
    { key: 'major', option: { value: '__missing__', missing: true } },
    { key: 'transfer', option: { value: 'raw:boolean:true', rawValue: true } },
    { key: 'mathStatus', option: { value: 'Enrolled' } },
    { key: 'firstGen', option: { value: true } },
  ];
  const snapshot = clone(context);
  assert.deepEqual(explorerScoringContext(context, policies[0]), {
    ethnicity: 'new-category', residency: 'outofstate', zipIncome: { min: 50000, max: 100000 },
    major: null, transfer: true, mathStatus: 'Enrolled',
  });
  assert.deepEqual(explorerScoringContext(context), { resident: false });
  assert.deepEqual(explorerScoringContext(context, source.policies[0]), { resident: false });
  const missingIncome = explorerScoringContext([{ key: 'zipIncome', option: { missing: true } }], policies[0]);
  assert.deepEqual(missingIncome, { zipIncome: null });
  const fixedMissing = Object.fromEntries(keys.map(key => [key, null]));
  assert.deepEqual(explorerBackgroundExtents(policies[0], { ...fixedMissing, ...missingIncome }), [0, 0]);
  assert.deepEqual(context, snapshot);
});

test('Score-space boundaries handle pure academics and negative background offsets without legacy flags', () => {
  for (const policy of policies) {
    const [minimum, maximum] = explorerBackgroundExtents(policy);
    const boundary = scoreSpaceBoundary(policy);
    assert.deepEqual(boundary.xDomain, [0, policy.weights.gpa + policy.weights.sat]);
    if (policy.id === 'academic') {
      assert.deepEqual([minimum, maximum], [0, 0]);
      assert.deepEqual(boundary.yDomain, [0, 1]);
      assert.deepEqual(boundary.points, [{ x: policy.threshold, y: 0 }]);
    } else {
      assert.deepEqual(boundary.yDomain, [minimum, maximum]);
      assert.ok(minimum < 0);
    }
    for (const point of boundary.points) {
      close(point.x + point.y, policy.threshold);
      assert.ok(point.y >= minimum && point.y <= maximum);
    }
    for (const record of records) {
      const coordinates = scoreCoordinates(record, policy);
      close(coordinates.academic + coordinates.background, scoreStudent(record, policy));
      assert.ok(coordinates.background >= minimum && coordinates.background <= maximum);
    }
  }
});

test('Zero and negative rule coefficients preserve exact scoring and do not invent cutoff bands', () => {
  const mapRules = transform => Object.fromEntries(keys.map(key => {
    const rule = policies[1].backgroundRules[key];
    return [key, { ...rule, points: Array.isArray(rule.points) ? rule.points.map(transform)
      : Object.fromEntries(Object.entries(rule.points).map(([value, points]) => [value, transform(points)])) }];
  }));
  const zero = { ...policies[1], weights: { gpa: 0, sat: 0 }, backgroundRules: mapRules(() => 0), threshold: 0 };
  assert.deepEqual(explorerBackgroundExtents(zero), [0, 0]);
  assert.equal(backgroundBoundaryBand(zero).hasContext, false);
  assert.deepEqual(backgroundBoundaryBand(zero).polygon, []);
  for (const record of records) {
    assert.equal(scoreStudent(record, zero), 0);
    assert.equal(getDecision(record, zero), true);
    assert.equal(getDecision(record, { ...zero, threshold: 1 }), false);
  }
  const negative = { ...policies[1], weights: { gpa: -45, sat: 25 }, backgroundRules: mapRules(value => -value), threshold: -10 };
  const oldRange = explorerBackgroundExtents(policies[1]);
  assert.deepEqual(explorerBackgroundExtents(negative), [-oldRange[1], -oldRange[0]]);
  for (const record of records) {
    close(scoreStudent(record, negative), expectedScore(record, negative));
    for (const point of admissionBoundary(negative, backgroundScore(record, negative)).points) {
      close(expectedScore({ ...record, gpa: point.x, sat: point.y }, negative), negative.threshold);
    }
  }
});

test('Simulated rules, faceting and hypothetical changes leave original cohort and reference outcomes intact', () => {
  const frozen = records.map(record => Object.freeze({ ...record }));
  const snapshot = clone(frozen);
  const policySnapshot = clone(policies);
  for (const policy of policies) {
    const matrix = confusionMatrix(frozen, policy, 'referenceOutcome');
    const groups = summarizeExplorerOutcomes({ records: frozen, policy });
    for (const original of frozen) {
      const hypothetical = { ...original, ethnicity: 'Asian', residency: 'outofstate', zipIncome: 250000,
        major: 'CompEng', transfer: 'no', mathStatus: 'Not Enrolled' };
      scoreStudent(hypothetical, policy);
      admissionBoundary(policy, backgroundScore(hypothetical, policy));
    }
    assert.deepEqual(confusionMatrix(frozen, policy, 'referenceOutcome'), matrix);
    assert.deepEqual(summarizeExplorerOutcomes({ records: frozen, policy }), groups);
    for (const feature of groups) {
      assert.equal(feature.groups.reduce((sum, group) => sum + group.total, 0), frozen.length);
      assert.equal(feature.groups.reduce((sum, group) => sum + group.admitted, 0), frozen.filter(record => getDecision(record, policy)).length);
    }
  }
  assert.deepEqual(frozen, snapshot);
  assert.deepEqual(policies, policySnapshot);
});
