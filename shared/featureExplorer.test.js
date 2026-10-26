import test from 'node:test';
import assert from 'node:assert/strict';
import { deserialize, serialize } from 'node:v8';
import { createSyntheticClassroomView, createSyntheticRecords } from './classroomDataset.js';
import { toPercentileClassroomView } from './satPercentiles.js';
import { EXPLORER_SIMULATION_POLICIES } from './explorerPolicies.js';
import { admissionBoundary, backgroundBoundaryBand, backgroundScore, confusionMatrix, getDecision, scoreStudent } from './admissionModel.js';
import {
  EXPLORER_FEATURES, enrichExplorerRecords, buildIncomeBins, getExplorerOptions,
  normalizeExplorerLayout, buildExplorerGroups, buildExplorerProfilePair, recordMatchesExplorerContext, explorerScoringContext, summarizeExplorerOutcomes,
} from './featureExplorer.js';

const source = toPercentileClassroomView(createSyntheticClassroomView());
const records = enrichExplorerRecords(source.records);
const keys = EXPLORER_FEATURES.map(feature => feature.key);
const alphabeticalValues = {
  ethnicity: ['American Indian/Alaska Native', 'Asian', 'Black/African American', 'Hispanic/Latino',
    'Native Hawaiian/Other Pacific Islander', 'Not Specified', 'Two or More', 'White'],
  major: ['Biochem', 'BiologicalSci', 'ChemEng', 'CompEng', 'CompSci', 'Economics', 'Math', 'Psychology'],
};
const clone = value => deserialize(serialize(value));
const allPanels = result => result.sections.flatMap(section => section.panels);
const countMemberships = result => {
  const counts = new Map();
  for (const panel of allPanels(result)) for (const record of panel.members) {
    counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
  }
  return counts;
};

test('Synthetic enrichment is stable by ID, preserves source values and every model decision', () => {
  const snapshot = clone(source);
  const frozen = source.records.map(record => Object.freeze({ ...record }));
  const enriched = enrichExplorerRecords(frozen);
  assert.deepEqual(enriched, records);
  assert.deepEqual(enrichExplorerRecords([...frozen].reverse()).reverse(), enriched);
  assert.deepEqual(source, snapshot);
  assert.equal(enriched.length, source.records.length);
  for (const [index, record] of enriched.entries()) {
    assert.notEqual(record, frozen[index]);
    for (const [field, value] of Object.entries(frozen[index])) assert.equal(record[field], value);
    for (const key of keys) assert.notEqual(record[key], undefined);
    assert.equal(record.residency === 'instate', record.resident);
    assert.ok(record.zipIncome >= 28000 && record.zipIncome <= 160000);
    for (const policy of source.policies) {
      assert.equal(scoreStudent(record, policy), scoreStudent(frozen[index], policy));
      assert.equal(getDecision(record, policy), getDecision(frozen[index], policy));
    }
  }
  for (const policy of source.policies) {
    assert.deepEqual(confusionMatrix(enriched, policy, 'referenceOutcome'), confusionMatrix(frozen, policy, 'referenceOutcome'));
  }
  const existing = { ...frozen[0], ethnicity: 'existing', zipIncome: null, residency: 'recorded-value' };
  const [preserved] = enrichExplorerRecords([existing]);
  assert.equal(preserved.ethnicity, 'existing');
  assert.equal(preserved.zipIncome, null);
  assert.equal(preserved.residency, 'recorded-value');
});

test('Every synthetic categorical field has multiple observed categories and localized definitions', () => {
  assert.deepEqual(keys, ['ethnicity', 'residency', 'zipIncome', 'major', 'transfer', 'mathStatus']);
  for (const feature of EXPLORER_FEATURES) {
    for (const language of ['en', 'zh', 'es']) assert.ok(feature.label[language]);
    if (feature.type === 'number') continue;
    const observed = new Set(records.map(record => record[feature.key]));
    assert.equal(observed.size, feature.values.length);
    for (const item of feature.values) {
      assert.ok(observed.has(item.value));
      for (const language of ['en', 'zh', 'es']) assert.ok(item.label[language]);
    }
  }
});

test('Declared categorical values match the supplied dataset strings, order, and eight separate ethnicity categories exactly', () => {
  const expected = {
    ethnicity: ['White', 'Asian', 'Black/African American', 'Hispanic/Latino', 'Not Specified',
      'Two or More', 'Native Hawaiian/Other Pacific Islander', 'American Indian/Alaska Native'],
    residency: ['instate', 'outofstate'],
    major: ['Economics', 'CompSci', 'BiologicalSci', 'CompEng', 'Psychology', 'Biochem', 'ChemEng', 'Math'],
    transfer: ['no', 'yes'],
    mathStatus: ['Enrolled', 'Not Enrolled', 'None'],
  };
  for (const [key, values] of Object.entries(expected)) {
    const feature = EXPLORER_FEATURES.find(item => item.key === key);
    assert.deepEqual(feature.values.map(item => item.value), values);
    const nativeRecords = values.map((value, id) => ({ id, [key]: value }));
    const options = getExplorerOptions(key, nativeRecords);
    const displayedValues = alphabeticalValues[key] ?? values;
    assert.deepEqual(options.map(item => item.value), displayedValues);
    assert.ok(options.every(item => !Object.hasOwn(item, 'rawValue') && !item.missing));
    if (key !== 'residency' && key !== 'transfer') assert.deepEqual(options.map(item => item.label.en), displayedValues);
    const groups = buildExplorerGroups({ records: nativeRecords, layout: { columns: key } });
    assert.equal(groups.panelCount, values.length);
    assert.ok(allPanels(groups).every(panel => panel.members.length === 1));
  }
});

test('Ethnicity and major display sorting reaches columns, rows, sections and outcomes without changing 200 simulated profiles or scores', () => {
  const demo = toPercentileClassroomView({ ...createSyntheticClassroomView(), records: createSyntheticRecords(200) });
  const cohort = Object.freeze(enrichExplorerRecords(demo.records).map(record => Object.freeze(record)));
  const before = clone(cohort);
  const metadata = clone(EXPLORER_FEATURES);
  const scores = cohort.map(record => EXPLORER_SIMULATION_POLICIES.map(policy => scoreStudent(record, policy)));
  const policy = EXPLORER_SIMULATION_POLICIES[0];
  const summary = summarizeExplorerOutcomes({ records: cohort, policy });
  for (const [key, expected] of Object.entries(alphabeticalValues)) {
    assert.deepEqual(getExplorerOptions(key, cohort).map(item => item.value), expected);
    assert.deepEqual(buildExplorerGroups({ records: cohort, layout: { columns: key } }).columns.map(item => item.value), expected);
    assert.deepEqual(buildExplorerGroups({ records: cohort, layout: { rows: key } }).rows.map(item => item.value), expected);
    assert.deepEqual(buildExplorerGroups({ records: cohort, layout: { sections: [key] } }).sections.map(section => section.context[0].option.value), expected);
    assert.deepEqual(summary.find(feature => feature.key === key).groups.map(group => group.option.value), expected);
  }
  for (const key of ['residency', 'transfer', 'mathStatus']) {
    assert.deepEqual(getExplorerOptions(key, cohort), EXPLORER_FEATURES.find(feature => feature.key === key).values);
  }
  const bins = buildIncomeBins(cohort, { method: 'fixed', count: 4 });
  assert.deepEqual(getExplorerOptions('zipIncome', cohort, bins), bins);
  assert.deepEqual(cohort, before);
  assert.deepEqual(EXPLORER_FEATURES, metadata);
  assert.deepEqual(enrichExplorerRecords(demo.records), before);
  assert.deepEqual(cohort.map(record => EXPLORER_SIMULATION_POLICIES.map(item => scoreStudent(record, item))), scores);
});

test('Alphabetical display interleaves raw categories with known labels while retaining typed identities and missing last', () => {
  for (const key of ['ethnicity', 'major']) {
    const values = ['Zulu', 'Aardvark', 0, '0', false, 'false', 'Missing', null, undefined, ''];
    const cohort = Object.freeze(values.map((value, index) => Object.freeze({ id: `raw-${index}`, [key]: value })));
    const before = clone(cohort);
    const options = getExplorerOptions(key, cohort);
    const expected = key === 'ethnicity'
      ? ['0', '0', 'Aardvark', 'American Indian/Alaska Native', 'Asian', 'Black/African American', 'false', 'false',
        'Hispanic/Latino', 'Missing', 'Native Hawaiian/Other Pacific Islander', 'Not Specified', 'Two or More', 'White', 'Zulu', 'Missing']
      : ['0', '0', 'Aardvark', 'Biochem', 'BiologicalSci', 'ChemEng', 'CompEng', 'CompSci', 'Economics', 'false', 'false',
        'Math', 'Missing', 'Psychology', 'Zulu', 'Missing'];
    assert.deepEqual(options.map(item => item.label.en), expected);
    assert.equal(options.at(-1).missing, true);
    assert.equal(options.filter(item => item.missing).length, 1);
    assert.equal(new Set(options.map(item => item.value)).size, options.length);
    assert.deepEqual(getExplorerOptions(key, [...cohort].reverse()), options);
    for (const value of [0, '0', false, 'false', 'Missing']) {
      const item = options.find(option => Object.hasOwn(option, 'rawValue') && Object.is(option.rawValue, value));
      assert.ok(item);
      const matching = cohort.filter(record => recordMatchesExplorerContext(record, [{ key, option: item }]));
      assert.deepEqual(matching.map(record => record[key]), [value]);
    }
    assert.deepEqual(cohort, before);
  }
});

test('Ethnicity correction preserves the first five student groups and splits only the former combined bucket', () => {
  const previousGroups = {
    White: ['S08', 'S10', 'S24', 'S39', 'S40', 'S43', 'S45', 'S55', 'S57', 'S60', 'S61', 'S63', 'S65', 'S70'],
    Asian: ['S03', 'S05', 'S06', 'S11', 'S12', 'S20', 'S35', 'S41', 'S46', 'S52', 'S62', 'S66'],
    'Black/African American': ['S04', 'S09', 'S16', 'S21', 'S32', 'S36', 'S38', 'S54', 'S56', 'S71'],
    'Hispanic/Latino': ['S01', 'S14', 'S19', 'S22', 'S23', 'S37', 'S44', 'S49', 'S51', 'S58', 'S59', 'S67', 'S72'],
    'Not Specified': ['S13', 'S26', 'S30', 'S33', 'S47', 'S50', 'S53', 'S68'],
  };
  for (const [value, ids] of Object.entries(previousGroups)) {
    assert.deepEqual(records.filter(record => record.ethnicity === value).map(record => record.id), ids);
  }
  const split = ['Two or More', 'Native Hawaiian/Other Pacific Islander', 'American Indian/Alaska Native'];
  const formerCombined = 'Two or More/Native Hawaiian/Other Pacific Islander/American Indian/Alaska Native';
  const knownIds = new Set(Object.values(previousGroups).flat());
  const splitRecords = records.filter(record => split.includes(record.ethnicity));
  assert.equal(splitRecords.length, 15);
  assert.deepEqual(splitRecords.map(record => record.id), records.filter(record => !knownIds.has(record.id)).map(record => record.id));
  const result = buildExplorerGroups({ records, layout: { columns: 'ethnicity' } });
  assert.equal(result.panelCount, 8);
  assert.equal(getExplorerOptions('ethnicity', records).some(item => item.value === formerCombined), false);
  assert.equal(records.some(record => record.ethnicity === formerCombined), false);
  for (const value of split) {
    const panel = allPanels(result).find(item => item.columnValue === value);
    assert.ok(panel?.members.length > 0, `${value} must appear separately in the simulation`);
    assert.ok(panel.members.every(record => record.ethnicity === value));
  }
  assert.equal(countMemberships(result).size, records.length);
  assert.ok([...countMemberships(result).values()].every(count => count === 1));
});

test('Synthetic residency generates only in-state and out-of-state while supplied values and income/transfer remain intact', () => {
  assert.deepEqual([...new Set(records.map(record => record.residency))].sort(), ['instate', 'outofstate']);
  assert.ok(records.filter(record => record.resident === false).every(record => record.residency === 'outofstate'));
  const s47 = records.find(record => record.id === 'S47');
  assert.equal(s47.zipIncome, 102280);
  assert.equal(s47.transfer, 'yes');
  const provided = [
    { id: 'known', resident: false, ethnicity: 'Black/African American', residency: 'outofstate', major: 'Biochem', mathStatus: 'None', zipIncome: 82000, transfer: 'no' },
    { id: 'unknown', resident: true, ethnicity: 'Unlisted ethnicity', residency: 'international', major: 'Unlisted major', mathStatus: 'calculus', zipIncome: null, transfer: null },
    { id: 'missing', resident: false, ethnicity: null, residency: null, major: null, mathStatus: null, zipIncome: undefined, transfer: undefined },
  ];
  const before = clone(provided);
  const enriched = enrichExplorerRecords(provided);
  for (let index = 0; index < provided.length; index += 1) {
    for (const [key, value] of Object.entries(provided[index])) assert.equal(enriched[index][key], value);
  }
  assert.deepEqual(provided, before);
  const residency = getExplorerOptions('residency', enriched);
  assert.ok(!residency.some(item => item.value === 'international'));
  assert.equal(residency.find(item => item.rawValue === 'international').label.en, 'international');
});

test('Literal None math status is an explicit category distinct from null, undefined, and blank missing data', () => {
  const cohort = [
    { id: 'enrolled', mathStatus: 'Enrolled' }, { id: 'not-enrolled', mathStatus: 'Not Enrolled' },
    { id: 'none', mathStatus: 'None' }, { id: 'null', mathStatus: null },
    { id: 'undefined' }, { id: 'blank', mathStatus: '' },
  ];
  const options = getExplorerOptions('mathStatus', cohort);
  assert.deepEqual(options.map(item => item.value), ['Enrolled', 'Not Enrolled', 'None', '__missing__']);
  assert.equal(options.find(item => item.value === 'None').missing, undefined);
  const groups = buildExplorerGroups({ records: cohort, layout: { columns: 'mathStatus' } });
  assert.deepEqual(allPanels(groups).find(panel => panel.columnValue === 'None').members.map(item => item.id), ['none']);
  assert.deepEqual(allPanels(groups).find(panel => panel.columnValue === '__missing__').members.map(item => item.id), ['null', 'undefined', 'blank']);
});

test('Fixed and custom income intervals partition finite values at exact half-open boundaries', () => {
  const cohort = [-200, 0, 49999.99, 50000, 75000, 99999.99, 100000, 250000, null, undefined, NaN, Infinity]
    .map((zipIncome, index) => ({ id: `income-${index}`, zipIncome }));
  const snapshot = clone(cohort);
  for (const settings of [
    { method: 'fixed', count: 3 },
    { method: 'custom', thresholds: [100000, 50000, 50000, NaN, Infinity] },
  ]) {
    const bins = buildIncomeBins(cohort, settings);
    assert.equal(bins.length, 4);
    assert.deepEqual(bins.filter(bin => !bin.missing).map(bin => [bin.min, bin.max]), [[-Infinity, 50000], [50000, 100000], [100000, Infinity]]);
    for (const record of cohort) {
      const matching = bins.filter(item => recordMatchesExplorerContext(record, [{ key: 'zipIncome', option: item }]));
      assert.equal(matching.length, 1);
      assert.equal(Boolean(matching[0].missing), !Number.isFinite(record.zipIncome));
    }
    assert.equal(bins.find(bin => recordMatchesExplorerContext({ zipIncome: 50000 }, [{ key: 'zipIncome', option: bin }])).min, 50000);
  }
  assert.deepEqual(cohort, snapshot);
  assert.equal(buildIncomeBins(records).some(bin => bin.missing), false);
  assert.equal(buildIncomeBins([]).some(bin => bin.missing), false);
  assert.equal(buildIncomeBins([{ zipIncome: '50000' }]).at(-1).missing, true);
});

test('Quantile ties stay together, do not produce duplicate cuts, and are independent of group selections', () => {
  const tied = [40000, 40000, 40000, 80000, 80000, 120000].map((zipIncome, id) => ({ id, zipIncome }));
  const bins = buildIncomeBins(tied, { method: 'quantile', count: 6 });
  assert.deepEqual(bins.map(bin => [bin.min, bin.max]), [[-Infinity, 80000], [80000, 120000], [120000, Infinity]]);
  assert.ok(bins.every(bin => tied.some(record => recordMatchesExplorerContext(record, [{ key: 'zipIncome', option: bin }]))));
  assert.equal(buildIncomeBins([{ zipIncome: 60000 }, { zipIncome: 60000 }], { method: 'quantile', count: 4 }).length, 1);
  assert.equal(buildIncomeBins([], { method: 'quantile', count: 4 }).length, 1);
  const cohortBins = buildIncomeBins(records, { method: 'quantile', count: 4 });
  const unfiltered = buildExplorerGroups({ records, layout: { columns: 'zipIncome', rows: 'ethnicity' }, incomeBins: cohortBins });
  const filtered = buildExplorerGroups({ records, layout: { columns: 'zipIncome', rows: 'ethnicity' }, incomeBins: cohortBins, selectedValues: { ethnicity: ['Asian'] } });
  assert.deepEqual(filtered.columns, unfiltered.columns);
});

test('Known categories remain visible and missing data is separate from Not Specified or unlisted raw categories', () => {
  const unusual = [
    { ethnicity: 'Not Specified' }, { ethnicity: null }, { ethnicity: undefined }, { ethnicity: '' },
    { ethnicity: 'New group <&>' }, { ethnicity: false }, { ethnicity: 0 }, { ethnicity: -0 },
  ].map((record, index) => ({ id: `u${index}`, ...record }));
  const options = getExplorerOptions('ethnicity', unusual);
  assert.equal(options.length, 12);
  assert.equal(options.filter(item => item.missing).length, 1);
  assert.equal(options.find(item => item.rawValue === 'New group <&>').label.en, 'New group <&>');
  const result = buildExplorerGroups({ records: unusual, layout: { columns: 'ethnicity' } });
  assert.equal(result.panelCount, options.length);
  assert.deepEqual([...countMemberships(result).values()], unusual.map(() => 1));
  const notSpecified = allPanels(result).find(panel => panel.columnValue === 'Not Specified');
  assert.deepEqual(notSpecified.members.map(record => record.id), ['u0']);
  const missing = allPanels(result).find(panel => panel.columnValue === '__missing__');
  assert.deepEqual(missing.members.map(record => record.id), ['u1', 'u2', 'u3']);
  assert.deepEqual(getExplorerOptions('not-a-feature', unusual), []);
});

test('Layout normalization rejects invalid keys and gives columns, then rows precedence over sections', () => {
  assert.deepEqual(normalizeExplorerLayout({ columns: 'major', rows: 'major', sections: ['major', 'income', 'transfer', 'transfer', 'mathStatus'] }), {
    columns: 'major', rows: '', sections: ['transfer', 'mathStatus'],
  });
  assert.deepEqual(normalizeExplorerLayout({ columns: 'bad', rows: 'residency', sections: ['residency', 'ethnicity'] }), {
    columns: '', rows: 'residency', sections: ['ethnicity'],
  });
});

test('No dimensions makes one combined panel; single, row-only and section-only layouts preserve membership', () => {
  const combined = buildExplorerGroups({ records });
  assert.equal(combined.panelCount, 1);
  assert.equal(combined.columns[0].value, '__all__');
  assert.equal(combined.rows[0].value, '__all__');
  assert.deepEqual(allPanels(combined)[0].members, records);
  for (const [layout, expectedCount] of [
    [{ columns: 'residency' }, 2], [{ rows: 'transfer' }, 2], [{ sections: ['mathStatus'] }, 3],
    [{ columns: 'residency', rows: 'ethnicity' }, 16],
  ]) {
    const result = buildExplorerGroups({ records, layout });
    assert.equal(result.panelCount, expectedCount);
    assert.equal(countMemberships(result).size, records.length);
    assert.ok([...countMemberships(result).values()].every(value => value === 1));
  }
});

test('All six dimensions create the entire Cartesian product with empty panels and stable IDs, without a limit', () => {
  const incomeBins = buildIncomeBins(records, { method: 'fixed', count: 4 });
  const layout = { columns: 'residency', rows: 'ethnicity', sections: ['zipIncome', 'major', 'transfer', 'mathStatus'] };
  const result = buildExplorerGroups({ records, layout, incomeBins });
  assert.equal(result.panelCount, 3072);
  assert.equal(result.panelCount, 2 * 8 * 4 * 8 * 2 * 3);
  assert.equal(result.sections.length, 4 * 8 * 2 * 3);
  assert.equal(allPanels(result).length, result.panelCount);
  assert.equal(new Set(allPanels(result).map(panel => panel.id)).size, result.panelCount);
  assert.ok(allPanels(result).some(panel => panel.members.length === 0));
  assert.equal(countMemberships(result).size, records.length);
  assert.ok([...countMemberships(result).values()].every(value => value === 1));
  for (const panel of allPanels(result)) for (const record of panel.members) {
    assert.equal(record, records.find(item => item.id === record.id));
    assert.equal(recordMatchesExplorerContext(record, panel.context), true);
  }
  const reordered = buildExplorerGroups({ records: [...records].reverse(), layout, incomeBins });
  assert.deepEqual(allPanels(reordered).map(panel => panel.id), allPanels(result).map(panel => panel.id));
});

test('Explicit category selections affect displayed membership only, including the zero-selection case', () => {
  const snapshot = clone(records);
  const layout = { columns: 'ethnicity', rows: 'transfer', sections: ['major'] };
  const narrowed = buildExplorerGroups({ records, layout, selectedValues: { ethnicity: ['Asian', 'Black/African American'], transfer: ['yes'], major: ['BiologicalSci', 'CompEng'] } });
  assert.equal(narrowed.panelCount, 4);
  const expected = records.filter(record => ['Asian', 'Black/African American'].includes(record.ethnicity) && record.transfer === 'yes' && ['BiologicalSci', 'CompEng'].includes(record.major));
  assert.deepEqual([...countMemberships(narrowed).keys()].sort(), expected.map(record => record.id).sort());
  for (const key of ['ethnicity', 'transfer', 'major']) {
    const empty = buildExplorerGroups({ records, layout, selectedValues: { [key]: [] } });
    assert.equal(empty.panelCount, 0);
    assert.equal(allPanels(empty).length, 0);
  }
  assert.deepEqual(records, snapshot);
});

test('Income group predicates never assign a bin or a representative income to a hypothetical profile', () => {
  const incomeBins = buildIncomeBins(records);
  const original = Object.freeze({ ...records[0], zipIncome: 75000 });
  const draft = Object.freeze({ ...original, gpa: 3.99, zipIncome: 125000 });
  const result = buildExplorerGroups({ records: [original], layout: { columns: 'zipIncome' }, incomeBins });
  const originalPanel = allPanels(result).find(panel => recordMatchesExplorerContext(original, panel.context));
  const draftPanel = allPanels(result).find(panel => recordMatchesExplorerContext(draft, panel.context));
  assert.notEqual(originalPanel.id, draftPanel.id);
  assert.equal(original.zipIncome, 75000);
  assert.equal(draft.zipIncome, 125000);
  assert.equal(originalPanel.members[0], original);
  assert.deepEqual(draftPanel.members, []);
  assert.equal(recordMatchesExplorerContext(null, originalPanel.context), false);
});

test('All-missing and empty cohorts keep explicitly declared combinations without invented members', () => {
  const missing = [{ id: 'a' }, { id: 'b', ethnicity: null, zipIncome: null }];
  const result = buildExplorerGroups({ records: missing, layout: { columns: 'zipIncome', rows: 'ethnicity' } });
  assert.equal(result.panelCount, 4 * 9);
  assert.ok([...countMemberships(result).values()].every(value => value === 1));
  const empty = buildExplorerGroups({ records: [], layout: { columns: 'residency', rows: 'major', sections: ['transfer'] } });
  assert.equal(empty.panelCount, 32);
  assert.ok(allPanels(empty).every(panel => panel.members.length === 0));
});

test('Simulation scoring context maps only known residency categories without assigning other grouped values', () => {
  const contexts = [
    { key: 'ethnicity', option: { value: 'Asian' } },
    { key: 'zipIncome', option: { value: 'income:50000:100000', min: 50000, max: 100000 } },
    { key: 'major', option: { value: 'BiologicalSci' } },
    { key: 'mathStatus', option: { value: 'Enrolled' } },
    { key: 'transfer', option: { value: 'yes' } },
  ];
  const before = clone(contexts);
  assert.deepEqual(explorerScoringContext(), {});
  assert.deepEqual(explorerScoringContext(contexts), {});
  for (const [value, expected] of [
    ['instate', { resident: true }], ['outofstate', { resident: false }],
    ['international', {}], ['unknown', {}], ['__missing__', {}],
  ]) {
    assert.deepEqual(explorerScoringContext([...contexts, { key: 'residency', option: { value } }]), expected);
  }
  assert.deepEqual(explorerScoringContext([{ key: 'residency', option: { value: 'instate', missing: true } }]), {});
  assert.deepEqual(contexts, before);
});

test('Panel cutoff bands condition the three classroom policies on the simulation residency mapping', () => {
  for (const policy of source.policies) {
    for (const [value, resident] of [['instate', true], ['outofstate', false]]) {
      const context = explorerScoringContext([{ key: 'residency', option: { value } }]);
      const band = backgroundBoundaryBand(policy, context);
      assert.deepEqual(band, backgroundBoundaryBand(policy, { resident }));
      if (policy.id === 'academic') {
        assert.equal(band.hasContext, false);
      } else {
        const fixed = resident ? policy.weights.resident : 0;
        assert.equal(band.hasContext, true);
        assert.deepEqual(band.edges, [
          admissionBoundary(policy, fixed),
          admissionBoundary(policy, fixed + policy.weights.firstGen + policy.weights.athlete),
        ]);
      }
    }
    assert.deepEqual(backgroundBoundaryBand(policy, explorerScoringContext([])), backgroundBoundaryBand(policy));
  }
});

test('When residency is the only background weight, each known group has its exact admission line', () => {
  const policy = { id: 'resident-only', threshold: 52, weights: { gpa: 45, sat: 35, firstGen: 0, athlete: 0, resident: 7 } };
  const lines = {};
  for (const [value, points] of [['instate', 7], ['outofstate', 0]]) {
    const context = explorerScoringContext([{ key: 'residency', option: { value } }]);
    const band = backgroundBoundaryBand(policy, context);
    assert.equal(band.hasContext, false);
    const boundary = admissionBoundary(policy, backgroundScore(context, policy));
    assert.deepEqual(boundary, admissionBoundary(policy, points));
    assert.ok(boundary.points.length > 1);
    for (const point of boundary.points) {
      assert.ok(Math.abs(scoreStudent({ ...context, gpa: point.x, sat: point.y }, policy) - policy.threshold) < 1e-8);
    }
    lines[value] = boundary;
  }
  assert.notDeepEqual(lines.instate, lines.outofstate);
  assert.equal(backgroundBoundaryBand(policy, explorerScoringContext([])).hasContext, true);
});

test('Six-feature outcomes partition the entire original cohort and keep both residency categories', () => {
  const frozen = records.map(record => Object.freeze({ ...record }));
  const before = clone(frozen);
  const policy = source.policies[0];
  const summary = summarizeExplorerOutcomes({ records: frozen, policy });
  assert.deepEqual(summary.map(feature => feature.key), keys);
  const admitted = frozen.filter(record => getDecision(record, policy)).length;
  for (const feature of summary) {
    assert.equal(feature.groups.reduce((sum, group) => sum + group.total, 0), frozen.length);
    assert.equal(feature.groups.reduce((sum, group) => sum + group.admitted, 0), admitted);
    for (const group of feature.groups) {
      const members = frozen.filter(record => recordMatchesExplorerContext(record, [{ key: feature.key, option: group.option }]));
      assert.equal(group.total, members.length);
      assert.equal(group.admitted, members.filter(record => getDecision(record, policy)).length);
      assert.equal(group.rate, group.total ? 100 * group.admitted / group.total : null);
    }
  }
  const residency = summary.find(feature => feature.key === 'residency');
  assert.deepEqual(residency.groups.map(group => group.option.value), ['instate', 'outofstate']);
  assert.ok(residency.groups.every(group => group.total > 0));
  assert.deepEqual(frozen, before);
});

test('Outcome summaries share exact income edges and preserve raw and missing categories', () => {
  const cohort = [
    { ethnicity: 'Asian', zipIncome: 49999.99 },
    { ethnicity: 'Not Specified', zipIncome: 50000 },
    { ethnicity: 'new category', zipIncome: 99999.99 },
    { ethnicity: false, zipIncome: 100000 },
    { ethnicity: 0, zipIncome: 200000 },
    { ethnicity: null, zipIncome: null },
    { ethnicity: undefined, zipIncome: '50000' },
  ].map((values, id) => ({ ...records[0], ...values, id, gpa: id % 2 ? 4 : 2.6, sat: id % 2 ? 100 : 60 }));
  const incomeBins = buildIncomeBins(cohort, { method: 'custom', thresholds: [50000, 100000] });
  const summary = summarizeExplorerOutcomes({ records: cohort, policy: source.policies[0], incomeBins });
  const income = summary.find(feature => feature.key === 'zipIncome');
  assert.deepEqual(income.groups.map(group => group.option), incomeBins);
  assert.deepEqual(income.groups.map(group => group.total), [1, 2, 2, 2]);
  assert.deepEqual(income.groups.map(group => group.admitted), [0, 1, 1, 1]);
  const ethnicity = summary.find(feature => feature.key === 'ethnicity');
  for (const raw of ['new category', false, 0]) {
    assert.equal(ethnicity.groups.find(group => group.option.rawValue === raw).total, 1);
  }
  assert.equal(ethnicity.groups.find(group => group.option.value === 'Not Specified').total, 1);
  assert.equal(ethnicity.groups.find(group => group.option.missing).total, 2);
  assert.equal(ethnicity.groups.reduce((sum, group) => sum + group.total, 0), cohort.length);
});

test('Empty outcome categories have no rate, while occupied rejected groups have a zero rate', () => {
  const policy = { ...source.policies[0], threshold: 101 };
  const empty = summarizeExplorerOutcomes({ records: [], policy });
  assert.equal(empty.length, 6);
  for (const feature of empty) {
    assert.ok(feature.groups.length > 0);
    assert.ok(feature.groups.every(group => group.total === 0 && group.admitted === 0 && group.rate === null));
  }
  const summary = summarizeExplorerOutcomes({ records: [records[0]], policy });
  for (const feature of summary) {
    assert.equal(feature.groups.filter(group => group.total === 1 && group.rate === 0).length, 1);
    assert.ok(feature.groups.filter(group => !group.total).every(group => group.rate === null));
  }
});

test('Outcome rates follow policy and cutoff changes without changing category membership', () => {
  const incomeBins = buildIncomeBins(records, { method: 'quantile', count: 4 });
  const summaries = source.policies.map(policy => summarizeExplorerOutcomes({ records, policy, incomeBins }));
  for (const [index, policy] of source.policies.entries()) {
    const admitted = records.filter(record => getDecision(record, policy)).length;
    for (const [featureIndex, feature] of summaries[index].entries()) {
      assert.equal(feature.groups.reduce((sum, group) => sum + group.admitted, 0), admitted);
      assert.deepEqual(feature.groups.map(group => [group.option, group.total]), summaries[0][featureIndex].groups.map(group => [group.option, group.total]));
    }
  }
  assert.ok(summaries.slice(1).some(summary => JSON.stringify(summary) !== JSON.stringify(summaries[0])));
  for (const [threshold, expectedRate] of [[0, 100], [101, 0]]) {
    const summary = summarizeExplorerOutcomes({ records, policy: { ...source.policies[0], threshold }, incomeBins });
    assert.ok(summary.every(feature => feature.groups.every(group => group.rate === (group.total ? expectedRate : null))));
  }
});

test('Hypothetical edits and plot selections never enter original-cohort outcome summaries', () => {
  const original = Object.freeze({ ...records[0] });
  const cohort = Object.freeze([original]);
  const policy = source.policies[0];
  const incomeBins = buildIncomeBins(cohort, { method: 'custom', thresholds: [50000, 100000] });
  const before = summarizeExplorerOutcomes({ records: cohort, policy, incomeBins });
  const draft = { ...original, gpa: 4, sat: 100, ethnicity: 'new category', residency: 'outofstate', resident: false, zipIncome: 225000, major: 'CompEng', transfer: 'yes', mathStatus: 'None' };
  const panels = buildExplorerGroups({ records: cohort, incomeBins, layout: { columns: 'zipIncome', rows: 'ethnicity' }, selectedValues: { zipIncome: [] } });
  assert.equal(panels.panelCount, 0);
  assert.equal(draft.zipIncome, 225000);
  assert.deepEqual(summarizeExplorerOutcomes({ records: cohort, policy, incomeBins }), before);
  assert.ok(before.every(feature => feature.groups.reduce((sum, group) => sum + group.total, 0) === 1));
  assert.ok(!before.find(feature => feature.key === 'ethnicity').groups.some(group => group.option.rawValue === draft.ethnicity));
});

test('Profile pairing finds the two actual panels across columns, rows and sections without mutating the cohort', () => {
  const original = Object.freeze({ ...records[0], ethnicity: 'Asian', major: 'Math', residency: 'instate', mathStatus: 'Enrolled' });
  const draft = Object.freeze({ ...original, ethnicity: 'White', major: 'Biochem', residency: 'outofstate', mathStatus: 'None', gpa: 3.8, sat: 95 });
  const cohort = Object.freeze([original]);
  const groups = buildExplorerGroups({ records: cohort,
    layout: { columns: 'ethnicity', rows: 'major', sections: ['residency', 'mathStatus'] } });
  const before = clone({ cohort, draft, groups });
  const pair = buildExplorerProfilePair(groups, original, draft);
  assert.ok(pair);
  assert.equal(pair.originalPanel, allPanels(groups).find(panel => panel.members.includes(original)));
  assert.equal(pair.draftPanel, allPanels(groups).find(panel => recordMatchesExplorerContext(draft, panel.context)));
  assert.notEqual(pair.originalPanel.id, pair.draftPanel.id);
  assert.equal(pair.draftPanel.members.length, 0);
  assert.deepEqual(pair.originalPanel.context.map(item => item.key), ['residency', 'mathStatus', 'major', 'ethnicity']);
  assert.deepEqual({ cohort, draft, groups }, before);
  assert.equal(allPanels(groups).reduce((sum, panel) => sum + panel.members.length, 0), 1);
});

test('Profile pairing leaves filtered endpoints absent and returns null when neither endpoint is displayed', () => {
  const original = { ...records[0], ethnicity: 'Asian', major: 'Math' };
  const draft = { ...original, ethnicity: 'White', major: 'Biochem' };
  const makeGroups = selectedValues => buildExplorerGroups({ records: [original],
    layout: { columns: 'ethnicity', rows: 'major' }, selectedValues });
  const originalOnly = buildExplorerProfilePair(makeGroups({ ethnicity: ['Asian'] }), original, draft);
  assert.ok(originalOnly.originalPanel);
  assert.equal(originalOnly.draftPanel, null);
  const draftOnly = buildExplorerProfilePair(makeGroups({ ethnicity: ['White'] }), original, draft);
  assert.equal(draftOnly.originalPanel, null);
  assert.ok(draftOnly.draftPanel);
  assert.equal(draftOnly.draftPanel.members.length, 0);
  assert.equal(buildExplorerProfilePair(makeGroups({ ethnicity: ['Black/African American'] }), original, draft), null);
  assert.equal(buildExplorerProfilePair(makeGroups({ ethnicity: [] }), original, draft), null);
});

test('Profile pairing follows income intervals rather than raw amount changes, including exact bin boundaries', () => {
  const original = { ...records[0], zipIncome: 40000 };
  const incomeBins = buildIncomeBins([original], { method: 'custom', thresholds: [50000, 100000] });
  const groups = buildExplorerGroups({ records: [original], layout: { columns: 'zipIncome' }, incomeBins });
  for (const zipIncome of [0, 40000, 49999.99]) {
    assert.equal(buildExplorerProfilePair(groups, original, { ...original, zipIncome, gpa: 3.9, sat: 100 }), null);
  }
  for (const zipIncome of [50000, 99999.99, 100000, 250000]) {
    const draft = { ...original, zipIncome };
    const pair = buildExplorerProfilePair(groups, original, draft);
    assert.ok(pair?.originalPanel && pair?.draftPanel);
    assert.ok(recordMatchesExplorerContext(draft, pair.draftPanel.context));
    assert.notEqual(pair.originalPanel.id, pair.draftPanel.id);
  }
});

test('Profile pairing requires a cross-group change and finite coordinates on both endpoints', () => {
  const original = { ...records[0], ethnicity: 'Asian', major: 'Math' };
  const draft = { ...original, ethnicity: 'White' };
  const groups = buildExplorerGroups({ records: [original], layout: { columns: 'ethnicity' } });
  assert.equal(buildExplorerProfilePair(groups, original, original), null);
  assert.equal(buildExplorerProfilePair(groups, original, { ...original }), null);
  assert.equal(buildExplorerProfilePair(groups, original, { ...original, gpa: 4, sat: 100, major: 'Biochem' }), null);
  assert.equal(buildExplorerProfilePair(buildExplorerGroups({ records: [original] }), original, draft), null);
  assert.equal(buildExplorerProfilePair(null, original, draft), null);
  for (const absent of [null, undefined]) {
    assert.equal(buildExplorerProfilePair(groups, absent, draft), null);
    assert.equal(buildExplorerProfilePair(groups, original, absent), null);
  }
  for (const coordinate of ['gpa', 'sat']) for (const invalid of [null, undefined, NaN, Infinity, -Infinity, '3.5']) {
    assert.equal(buildExplorerProfilePair(groups, { ...original, [coordinate]: invalid }, draft), null);
    assert.equal(buildExplorerProfilePair(groups, original, { ...draft, [coordinate]: invalid }), null);
  }
});
