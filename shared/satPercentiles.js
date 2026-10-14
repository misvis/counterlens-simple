// College Board SAT User Group Percentiles, total scores; snapshot 2026-10-14.
// https://research.collegeboard.org/reports/sat-suite/understanding-scores/sat
// Reference population: actual SAT takers graduating in the past three school years.
// Published censored ranks 1- / 99+ use 0.5 / 99.5 for this teaching model.
// All current demo scores fall in the table's uncensored range.
export const SAT_PERCENTILE_SOURCE = {
  url: 'https://research.collegeboard.org/reports/sat-suite/understanding-scores/sat',
  accessed: '2026-10-14',
  population: 'SAT User Group',
};
const ranks = [
  // 400–490
  .5,.5,.5,.5,.5,.5,.5,.5,.5,.5,
  // 500–590
  1,1,1,1,1,1,1,1,2,2,
  // 600–690
  2,2,2,3,3,3,4,4,5,5,
  // 700–790
  6,7,8,9,10,11,12,13,14,16,
  // 800–890
  17,18,20,21,23,24,26,27,29,30,
  // 900–990
  32,33,35,36,38,39,41,42,44,45,
  // 1000–1090
  47,48,50,52,53,55,56,58,59,60,
  // 1100–1190
  62,63,65,66,67,69,70,71,72,74,
  // 1200–1290
  75,76,77,78,79,80,81,82,83,84,
  // 1300–1390
  85,86,87,88,88,89,90,91,91,92,
  // 1400–1490
  93,93,94,94,95,95,96,96,97,97,
  // 1500–1600
  97,98,98,99,99,99,99.5,99.5,99.5,99.5,99.5,
];

export const satScoreToPercentile = score => {
  if (!Number.isFinite(score) || score < 400 || score > 1600 || score % 10 !== 0) {
    throw new Error('SAT total scores must be multiples of 10 between 400 and 1600.');
  }
  return ranks[(score - 400) / 10];
};

// Keep the release's raw records intact. Both bundled and API data cross this
// explicit unit boundary once before entering the percentile-based visualizer.
export const toPercentileClassroomView = view => {
  const feature = view.features.find(item => item.key === 'sat');
  if (feature?.unit === 'percentile') return view;
  if (!feature || feature.domain?.min < 400 || feature.domain?.max > 1600) {
    throw new Error('Expected a SAT score feature before percentile conversion.');
  }
  return {
    ...view,
    dataset: { ...view.dataset, version: `${view.dataset.version}-sat-percentile-20261014` },
    features: view.features.map(item => item.key === 'sat' ? {
      ...item, unit: 'percentile', domain: { min: 0, max: 100, step: 1 },
      percentileSource: SAT_PERCENTILE_SOURCE,
    } : item),
    policies: view.policies.map(policy => ({ ...policy, algorithm: 'weighted_sum_sat_percentile_v1' })),
    records: view.records.map(record => ({ ...record, sat: satScoreToPercentile(record.sat) })),
  };
};
