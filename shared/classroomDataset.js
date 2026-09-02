export const CLASSROOM_SCHEMA_VERSION = 1;
export const DEFAULT_DATASET_ID = 'admissions-demo';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createSeededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const createSyntheticRecords = () => {
  const random = createSeededRandom(1973);

  return Array.from({ length: 72 }, (_, index) => {
    const firstGen = random() < 0.3;
    const athlete = random() < 0.16;
    const resident = random() < 0.6;
    const academicSignal = (random() + random() + random() + random()) / 4;
    const gpa = clamp(2.45 + academicSignal * 1.55 - (firstGen ? 0.1 : 0), 2.4, 4);
    const satSignal = (random() + random() + academicSignal) / 3;
    const sat = clamp(Math.round((1030 + satSignal * 570 - (firstGen ? 55 : 0)) / 10) * 10, 950, 1600);

    return {
      id: `S${String(index + 1).padStart(2, '0')}`,
      gpa: Number(gpa.toFixed(2)),
      sat,
      firstGen,
      athlete,
      resident,
    };
  });
};

const FEATURE_DEFINITIONS = [
  {
    key: 'gpa',
    labelKey: 'gpa',
    type: 'number',
    role: 'input',
    domain: { min: 2.4, max: 4, step: 0.01 },
    allowedUses: ['axis', 'counterfactual'],
  },
  {
    key: 'sat',
    labelKey: 'sat',
    type: 'number',
    role: 'input',
    domain: { min: 950, max: 1600, step: 10 },
    allowedUses: ['axis', 'counterfactual'],
  },
  {
    key: 'firstGen',
    labelKey: 'firstGeneration',
    type: 'boolean',
    role: 'input',
    allowedUses: ['compare', 'counterfactual'],
  },
  {
    key: 'athlete',
    labelKey: 'athlete',
    type: 'boolean',
    role: 'input',
    allowedUses: ['compare', 'counterfactual'],
  },
  {
    key: 'resident',
    labelKey: 'residency',
    type: 'boolean',
    role: 'input',
    allowedUses: ['compare', 'counterfactual'],
  },
];

const POLICY_DEFINITIONS = [
  {
    id: 'academic',
    algorithm: 'weighted_sum_v1',
    weights: { gpa: 60, sat: 40, firstGen: 0, athlete: 0, resident: 0 },
    threshold: 62,
  },
  {
    id: 'holistic',
    algorithm: 'weighted_sum_v1',
    weights: { gpa: 45, sat: 35, firstGen: 8, athlete: 5, resident: 7 },
    threshold: 52,
  },
  {
    id: 'opportunity',
    algorithm: 'weighted_sum_v1',
    weights: { gpa: 35, sat: 25, firstGen: 25, athlete: 5, resident: 10 },
    threshold: 43,
  },
];

export const createSyntheticClassroomView = () => ({
  schemaVersion: CLASSROOM_SCHEMA_VERSION,
  dataset: {
    id: DEFAULT_DATASET_ID,
    version: 'synthetic-1973-v1',
    title: 'CounterLens synthetic admissions classroom dataset',
    sourceType: 'synthetic',
    releaseStatus: 'public-demo',
    recordCount: 72,
  },
  privacy: {
    representation: 'synthetic',
    containsDirectIdentifiers: false,
    approvedForPublicDisplay: true,
  },
  features: FEATURE_DEFINITIONS.map((feature) => ({
    ...feature,
    allowedUses: [...feature.allowedUses],
    ...(feature.domain ? { domain: { ...feature.domain } } : {}),
  })),
  policies: POLICY_DEFINITIONS.map((policy) => ({
    ...policy,
    weights: { ...policy.weights },
  })),
  records: createSyntheticRecords(),
});
