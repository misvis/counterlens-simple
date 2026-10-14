// Exact scoring and 2D slices of the current weighted-sum classroom model.
// Display/edit bounds are independent of the policy's scoring calibration.
export const ADMISSION_DOMAINS = { gpa: [2.6, 4], sat: [60, 100] };
const SCORING_DOMAINS = { gpa: [2.4, 4], sat: [0, 100] };
const GPA_DISPLAY_SCALE = (4 - 2.6) / (4 - 2.4);
const GPA_DISPLAY_OFFSET = (2.6 - 2.4) / (4 - 2.4);
const SAT_DISPLAY_SCALE = 0.4;
const SAT_DISPLAY_OFFSET = 0.6;
const [GPA_MIN, GPA_MAX] = ADMISSION_DOMAINS.gpa;
const [SAT_MIN, SAT_MAX] = ADMISSION_DOMAINS.sat;
const CONTEXT_FIELDS = ['firstGen', 'athlete', 'resident'];
const EPSILON = 1e-9;
const unit = value => Math.min(1, Math.max(0, value));
const weight = (policy, field) => policy.weights[field] ?? 0;

export const backgroundScore = (student, policy) => CONTEXT_FIELDS.reduce(
  (sum, field) => sum + (student?.[field] ? weight(policy, field) : 0), 0,
);

const academicPoints = (student, policy, field) => {
  if (!student) return 0;
  const [minimum, maximum] = SCORING_DOMAINS[field];
  return unit((student[field] - minimum) / (maximum - minimum)) * weight(policy, field);
};

const academicScore = (student, policy) => academicPoints(student, policy, 'gpa') + academicPoints(student, policy, 'sat');

export const scoreStudent = (student, policy) => academicScore(student, policy) + backgroundScore(student, policy);

// Each bar uses the same normalization and background rules as the decision.
// The cutoff does not change these contributions; it only changes admission.
export const scoreContributions = (student, policy) => [
  { key: 'gpa', points: academicPoints(student, policy, 'gpa') },
  { key: 'sat', points: academicPoints(student, policy, 'sat') },
  ...CONTEXT_FIELDS.map(key => ({ key, points: student?.[key] ? weight(policy, key) : 0 })),
];

// This two-axis aggregation preserves the model's total score exactly.
export const scoreCoordinates = (student, policy) => {
  const academic = academicScore(student, policy);
  const background = backgroundScore(student, policy);
  return { academic, background, total: academic + background };
};

export const getDecision = (student, policy) => scoreStudent(student, policy) >= policy.threshold;

// Translate a grabbed boundary without snapping it to the pointer. Deltas are
// fractions of the GPA/SAT domains (positive SAT means upwards on screen).
export const thresholdAfterDrag = (policy, initialThreshold, gpaDelta, satDelta) => (
  Math.round(Math.min(100, Math.max(0,
    initialThreshold + weight(policy, 'gpa') * GPA_DISPLAY_SCALE * gpaDelta + weight(policy, 'sat') * SAT_DISPLAY_SCALE * satDelta,
  )))
);

// Keep the original record intact and match the editor's GPA/SAT step sizes.
export const studentAfterDrag = (student, gpaDelta, satDelta) => ({
  ...student,
  gpa: Math.round(Math.min(GPA_MAX, Math.max(GPA_MIN, student.gpa + gpaDelta * (GPA_MAX - GPA_MIN))) * 100) / 100,
  sat: Math.round(Math.min(SAT_MAX, Math.max(SAT_MIN, student.sat + satDelta * (SAT_MAX - SAT_MIN)))),
});

// Compare cohort decisions with an independent, boolean reference outcome.
// Missing labels are excluded rather than treated as negative outcomes.
export const confusionMatrix = (records, policy, referenceKey) => {
  const result = { tp: 0, fp: 0, fn: 0, tn: 0, labeled: 0, missing: 0 };
  for (const record of records) {
    const reference = referenceKey ? record[referenceKey] : undefined;
    if (typeof reference !== 'boolean') {
      result.missing += 1;
      continue;
    }
    const admitted = getDecision(record, policy);
    const cell = admitted ? (reference ? 'tp' : 'fp') : (reference ? 'fn' : 'tn');
    result[cell] += 1;
    result.labeled += 1;
  }
  return result;
};

const toChartPoint = ({ x, y }) => ({ x: GPA_MIN + (GPA_MAX - GPA_MIN) * x, y: SAT_MIN + (SAT_MAX - SAT_MIN) * y });

// Intersect a*x + b*y = threshold - contextScore with the normalized chart square.
// Returns a point at a tangent corner, an empty segment off-chart, and handles zero/negative weights.
export const admissionBoundary = (policy, contextScore = 0) => {
  const a = weight(policy, 'gpa') * GPA_DISPLAY_SCALE;
  const b = weight(policy, 'sat') * SAT_DISPLAY_SCALE;
  const cutoff = policy.threshold - contextScore - weight(policy, 'gpa') * GPA_DISPLAY_OFFSET - weight(policy, 'sat') * SAT_DISPLAY_OFFSET;
  const minimum = Math.min(0, a) + Math.min(0, b);
  const maximum = Math.max(0, a) + Math.max(0, b);
  const relation = cutoff <= minimum ? 'all-admitted' : cutoff > maximum ? 'none-admitted' : 'mixed';
  const points = [];
  const add = (x, y) => {
    if (x < -EPSILON || x > 1 + EPSILON || y < -EPSILON || y > 1 + EPSILON) return;
    const point = { x: unit(x), y: unit(y) };
    if (!points.some(p => Math.abs(p.x - point.x) < EPSILON && Math.abs(p.y - point.y) < EPSILON)) points.push(point);
  };
  if (Math.abs(b) > EPSILON) {
    add(0, cutoff / b);
    add(1, (cutoff - a) / b);
  }
  if (Math.abs(a) > EPSILON) {
    add(cutoff / a, 0);
    add((cutoff - b) / a, 1);
  }
  return { points: points.map(toChartPoint), relation };
};

const scoreExtents = (policy, fields) => fields.reduce(
  ([minimum, maximum], field) => [minimum + Math.min(0, weight(policy, field)), maximum + Math.max(0, weight(policy, field))],
  [0, 0],
);

// The score-space separator is x + y = threshold. Clip it to actual score
// extents, not to padded display axes. Background scores occupy discrete rows;
// the separator between them does not imply that intermediate profiles exist.
export const scoreSpaceBoundary = policy => {
  const [xMin, xMax] = scoreExtents(policy, ['gpa', 'sat']);
  const [yMin, yMax] = scoreExtents(policy, CONTEXT_FIELDS);
  const minimum = xMin + yMin;
  const maximum = xMax + yMax;
  const threshold = policy.threshold;
  const relation = threshold <= minimum ? 'all-admitted' : threshold > maximum ? 'none-admitted' : 'mixed';
  const result = {
    xDomain: xMin === xMax ? [0, 1] : [xMin, xMax],
    yDomain: yMin === yMax ? [0, 1] : [yMin, yMax],
    points: [],
    relation,
  };
  if (threshold < minimum || threshold > maximum) return result;
  const start = Math.max(xMin, threshold - yMax);
  const end = Math.min(xMax, threshold - yMin);
  result.points.push({ x: start, y: threshold - start });
  if (end - start > EPSILON) result.points.push({ x: end, y: threshold - end });
  return result;
};

const clip = (polygon, signedDistance) => {
  const result = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const from = polygon[i];
    const to = polygon[(i + 1) % polygon.length];
    const fromDistance = signedDistance(from);
    const toDistance = signedDistance(to);
    const fromInside = fromDistance >= 0;
    const toInside = toDistance >= 0;
    if (fromInside) result.push(from);
    if (fromInside !== toInside) {
      const fraction = fromDistance / (fromDistance - toDistance);
      result.push({ x: from.x + fraction * (to.x - from.x), y: from.y + fraction * (to.y - from.y) });
    }
  }
  return result;
};

export const backgroundBoundaryBand = policy => {
  const contextWeights = CONTEXT_FIELDS.map(field => weight(policy, field));
  const minimum = contextWeights.reduce((sum, value) => sum + Math.min(0, value), 0);
  const maximum = contextWeights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (maximum - minimum < EPSILON) return { hasContext: false, polygon: [], edges: [] };
  const academicScore = p => weight(policy, 'gpa') * (GPA_DISPLAY_OFFSET + GPA_DISPLAY_SCALE * p.x) + weight(policy, 'sat') * (SAT_DISPLAY_OFFSET + SAT_DISPLAY_SCALE * p.y);
  let polygon = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  polygon = clip(polygon, p => academicScore(p) + maximum - policy.threshold);
  polygon = clip(polygon, p => policy.threshold - academicScore(p) - minimum);
  const area = Math.abs(polygon.reduce((sum, p, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
  return {
    hasContext: true,
    polygon: area > EPSILON ? polygon : [],
    edges: [admissionBoundary(policy, minimum), admissionBoundary(policy, maximum)],
  };
};
