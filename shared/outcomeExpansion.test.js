import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutcomeExpansion, outcomeExpansionReducer as reduce } from './outcomeExpansion.js';

const keys = ['ethnicity', 'major', 'mathStatus', 'residency', 'transfer', 'zipIncome'];
const backgroundDefaults = ['residency', 'zipIncome'];
const switchTo = (state, policyId) => reduce(state, { type: 'policy', policyId, keys });
const all = state => reduce(state, { type: 'all', keys });

for (const [first, second] of [['holistic', 'opportunity'], ['opportunity', 'holistic']]) {
  test(`Collapse all in ${first}, visit ${second}, and revisit ${first} restores the same defaults`, () => {
    let state = all(all(createOutcomeExpansion(first, keys)));
    assert.deepEqual(state.expanded, []);
    state = switchTo(state, second);
    assert.deepEqual(state.expanded, backgroundDefaults);
    state = switchTo(state, first);
    assert.deepEqual(state.expanded, backgroundDefaults);
  });
}

test('Every academic visit starts expanded even after manual collapse on the previous visit', () => {
  let state = all(createOutcomeExpansion('academic', keys));
  assert.deepEqual(state.expanded, []);
  state = switchTo(state, 'holistic');
  assert.deepEqual(state.expanded, backgroundDefaults);
  state = switchTo(state, 'academic');
  assert.deepEqual(state.expanded, keys);
});

test('Same policy updates retain manual expansion; all-toggle uses the latest state', () => {
  let state = reduce(createOutcomeExpansion('holistic', keys), { type: 'toggle', key: 'major' });
  assert.deepEqual(state.expanded, [...backgroundDefaults, 'major']);
  assert.strictEqual(switchTo(state, 'holistic'), state);
  state = all(state);
  assert.deepEqual(state.expanded, keys);
  state = all(state);
  assert.deepEqual(state.expanded, []);
  assert.strictEqual(switchTo(state, 'holistic'), state);
  assert.deepEqual(all(state).expanded, keys);
});

test('Repeated policy switches do not retain hidden histories or mutate the group keys', () => {
  const snapshot = [...keys];
  let state = createOutcomeExpansion('academic', keys);
  for (const policyId of ['holistic', 'opportunity', 'academic', 'opportunity', 'holistic']) {
    state = switchTo(all(state), policyId);
    assert.deepEqual(state.expanded, policyId === 'academic' ? keys : backgroundDefaults);
  }
  assert.deepEqual(keys, snapshot);
});
