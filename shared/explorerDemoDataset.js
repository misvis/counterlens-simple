import { createSyntheticClassroomView, createSyntheticRecords } from './classroomDataset.js';
import { toPercentileClassroomView } from './satPercentiles.js';

export const EXPLORER_DEMO_RECORD_COUNT = 200;

const canonicalRawView = createSyntheticClassroomView();
const canonicalPercentileView = toPercentileClassroomView(canonicalRawView);

// Compare the published values, independently of JSON object-key order. A
// changed, filtered, enriched, or otherwise unfamiliar cohort is left alone.
export const samePublishedValue = (actual, expected) => {
  if (Object.is(actual, expected)) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object'
    || Array.isArray(actual) !== Array.isArray(expected)) return false;
  if (Array.isArray(expected) && actual.length !== expected.length) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length
    && keys.every(key => Object.hasOwn(actual, key) && samePublishedValue(actual[key], expected[key]));
};

// This adapter belongs to the browser preview, not the persisted release or
// its classroom binding. It accepts raw SAT scores and the existing, explicit
// percentile projection so callers can keep the normal loading path intact.
export const buildExplorerDemoView = view => {
  const canonical = view?.dataset?.version === canonicalRawView.dataset.version ? canonicalRawView
    : view?.dataset?.version === canonicalPercentileView.dataset.version ? canonicalPercentileView : null;
  if (!canonical || Object.hasOwn(view, 'preview') || view.schemaVersion !== canonical.schemaVersion
    || !['id', 'sourceType', 'releaseStatus', 'recordCount'].every(key => view.dataset[key] === canonical.dataset[key])
    || !samePublishedValue(view.privacy, canonical.privacy)
    || !samePublishedValue(view.features, canonical.features)
    || !samePublishedValue(view.policies, canonical.policies)
    || !samePublishedValue(view.records, canonical.records)) return view;

  const expandedRaw = { ...canonicalRawView, records: createSyntheticRecords(EXPLORER_DEMO_RECORD_COUNT) };
  const expanded = canonical === canonicalRawView ? expandedRaw : toPercentileClassroomView(expandedRaw);
  return {
    ...view,
    dataset: { ...view.dataset, recordCount: EXPLORER_DEMO_RECORD_COUNT },
    preview: {
      kind: 'explorer-synthetic-expansion',
      browserOnly: true,
      sourceDatasetId: view.dataset.id,
      sourceDatasetVersion: view.dataset.version,
      sourceReleaseVersion: canonicalRawView.dataset.version,
      sourceRecordCount: view.records.length,
      recordCount: EXPLORER_DEMO_RECORD_COUNT,
    },
    records: [...view.records, ...expanded.records.slice(view.records.length)],
  };
};
