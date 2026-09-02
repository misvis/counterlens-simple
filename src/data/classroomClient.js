import {
  DEFAULT_DATASET_ID,
  createSyntheticClassroomView,
} from '../../shared/classroomDataset.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const DATASET_ID = import.meta.env.VITE_DATASET_ID || DEFAULT_DATASET_ID;

export const isClassroomApiConfigured = Boolean(API_BASE_URL);

const assertUsableClassroomView = (view) => {
  if (
    !view ||
    view.schemaVersion !== 1 ||
    !view.dataset?.id ||
    !view.dataset?.version ||
    !Array.isArray(view.features) ||
    view.features.length === 0 ||
    !Array.isArray(view.policies) ||
    view.policies.length === 0 ||
    !Array.isArray(view.records)
  ) {
    throw new Error('The classroom API returned an unsupported dataset contract.');
  }
  if (
    view.privacy?.containsDirectIdentifiers !== false ||
    view.privacy?.approvedForPublicDisplay !== true
  ) {
    throw new Error('The classroom API did not mark this dataset as safe for public display.');
  }
  return view;
};

export const loadClassroomView = async () => {
  if (!isClassroomApiConfigured) {
    return { view: createSyntheticClassroomView(), source: 'bundled' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/classroom-view/${encodeURIComponent(DATASET_ID)}`,
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      throw new Error(`The classroom API returned HTTP ${response.status}.`);
    }
    return { view: assertUsableClassroomView(await response.json()), source: 'api' };
  } finally {
    window.clearTimeout(timeout);
  }
};

export const createBundledClassroomView = () => createSyntheticClassroomView();
