import {
  CLASSROOM_SCHEMA_VERSION,
  DEFAULT_DATASET_ID,
  createSyntheticClassroomView,
} from '../../shared/classroomDataset.js';

const FEATURE_TYPES = new Set(['number', 'boolean', 'category', 'ordinal']);
const FEATURE_ROLES = new Set(['input', 'group', 'outcome']);
const FEATURE_USES = new Set(['axis', 'compare', 'counterfactual']);
const PROHIBITED_PUBLIC_FEATURE_KEYS = new Set([
  'name',
  'firstname',
  'lastname',
  'email',
  'studentid',
  'ssn',
  'address',
  'dateofbirth',
  'dob',
  'phone',
]);

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const assert = (condition, message) => {
  if (!condition) throw new Error(`Invalid classroom dataset: ${message}`);
};

const valueMatchesFeature = (value, feature) => {
  if (value === null) return true;
  if (feature.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (feature.type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string';
};

export const validateClassroomView = (view) => {
  assert(isPlainObject(view), 'the root value must be an object');
  assert(view.schemaVersion === CLASSROOM_SCHEMA_VERSION, `schemaVersion must be ${CLASSROOM_SCHEMA_VERSION}`);
  assert(isPlainObject(view.dataset), 'dataset metadata is required');
  assert(typeof view.dataset.id === 'string' && view.dataset.id.length > 0, 'dataset.id is required');
  assert(typeof view.dataset.version === 'string' && view.dataset.version.length > 0, 'dataset.version is required');
  assert(view.privacy?.containsDirectIdentifiers === false, 'direct identifiers must not be published');
  assert(view.privacy?.approvedForPublicDisplay === true, 'the release must be approved for public display');
  assert(Array.isArray(view.features) && view.features.length > 0, 'at least one feature is required');
  assert(Array.isArray(view.policies) && view.policies.length > 0, 'at least one policy is required');
  assert(Array.isArray(view.records), 'records must be an array');

  const featureKeys = new Set();
  const featuresByKey = new Map();
  for (const feature of view.features) {
    assert(typeof feature.key === 'string' && feature.key.length > 0, 'every feature needs a key');
    assert(!featureKeys.has(feature.key), `duplicate feature key ${feature.key}`);
    assert(
      !PROHIBITED_PUBLIC_FEATURE_KEYS.has(feature.key.toLowerCase()),
      `feature ${feature.key} is prohibited in a public classroom release`,
    );
    assert(FEATURE_TYPES.has(feature.type), `unsupported type for ${feature.key}`);
    assert(FEATURE_ROLES.has(feature.role), `unsupported role for ${feature.key}`);
    assert(Array.isArray(feature.allowedUses), `allowedUses is required for ${feature.key}`);
    assert(feature.allowedUses.every((use) => FEATURE_USES.has(use)), `unsupported allowed use for ${feature.key}`);
    if (feature.type === 'number') {
      assert(isPlainObject(feature.domain), `numeric feature ${feature.key} needs a domain`);
      assert(Number.isFinite(feature.domain.min), `${feature.key}.domain.min must be numeric`);
      assert(Number.isFinite(feature.domain.max), `${feature.key}.domain.max must be numeric`);
      assert(feature.domain.min < feature.domain.max, `${feature.key} has an invalid domain`);
    }
    assert(
      feature.role === 'input' || !feature.allowedUses.includes('counterfactual'),
      `non-input feature ${feature.key} cannot be counterfactual`,
    );
    featureKeys.add(feature.key);
    featuresByKey.set(feature.key, feature);
  }

  const recordIds = new Set();
  for (const record of view.records) {
    assert(isPlainObject(record), 'every record must be an object');
    assert(typeof record.id === 'string' && record.id.length > 0, 'every record needs an opaque id');
    assert(!recordIds.has(record.id), `duplicate record id ${record.id}`);
    recordIds.add(record.id);
    for (const recordKey of Object.keys(record)) {
      assert(recordKey === 'id' || featureKeys.has(recordKey), `record ${record.id} contains unpublished field ${recordKey}`);
    }
    for (const feature of view.features) {
      assert(Object.hasOwn(record, feature.key), `record ${record.id} is missing ${feature.key}`);
      assert(valueMatchesFeature(record[feature.key], feature), `record ${record.id} has the wrong type for ${feature.key}`);
    }
  }

  assert(view.dataset.recordCount === view.records.length, 'dataset.recordCount does not match records.length');

  const policyIds = new Set();
  for (const policy of view.policies) {
    assert(typeof policy.id === 'string' && policy.id.length > 0, 'every policy needs an id');
    assert(!policyIds.has(policy.id), `duplicate policy id ${policy.id}`);
    assert(policy.algorithm === 'weighted_sum_v1', `unsupported algorithm for policy ${policy.id}`);
    assert(Number.isFinite(policy.threshold), `policy ${policy.id} needs a numeric threshold`);
    assert(isPlainObject(policy.weights), `policy ${policy.id} needs weights`);
    for (const [featureKey, weight] of Object.entries(policy.weights)) {
      assert(featureKeys.has(featureKey), `policy ${policy.id} references unknown feature ${featureKey}`);
      assert(featuresByKey.get(featureKey).role === 'input', `policy ${policy.id} uses non-input feature ${featureKey}`);
      assert(Number.isFinite(weight), `policy ${policy.id} has a non-numeric weight for ${featureKey}`);
    }
    policyIds.add(policy.id);
  }

  return view;
};

export const summarizeDatasetQuality = (view) => {
  const missingValues = {};
  const outOfRangeValues = {};

  for (const feature of view.features) {
    missingValues[feature.key] = 0;
    outOfRangeValues[feature.key] = 0;
  }

  for (const record of view.records) {
    for (const feature of view.features) {
      const value = record[feature.key];
      if (value === null) {
        missingValues[feature.key] += 1;
      } else if (
        feature.type === 'number' &&
        (value < feature.domain.min || value > feature.domain.max)
      ) {
        outOfRangeValues[feature.key] += 1;
      }
    }
  }

  const valuesToReview = [...Object.values(missingValues), ...Object.values(outOfRangeValues)]
    .reduce((total, count) => total + count, 0);

  return {
    status: valuesToReview === 0 ? 'valid' : 'review',
    datasetId: view.dataset.id,
    datasetVersion: view.dataset.version,
    sourceType: view.dataset.sourceType,
    recordCount: view.records.length,
    featureCount: view.features.length,
    missingValues,
    outOfRangeValues,
  };
};

const classroomViews = new Map();
const syntheticView = validateClassroomView(createSyntheticClassroomView());
classroomViews.set(DEFAULT_DATASET_ID, syntheticView);

export const getClassroomView = (datasetId) => classroomViews.get(datasetId) ?? null;
export const getDatasetQuality = (datasetId) => {
  const view = getClassroomView(datasetId);
  return view ? summarizeDatasetQuality(view) : null;
};
