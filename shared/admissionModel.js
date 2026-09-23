// Exact scoring and 2D slices of the current weighted-sum classroom model.
export const ADMISSION_DOMAINS = { gpa: [2.4, 4], sat: [950, 1600] };
const [GPA_MIN, GPA_MAX] = ADMISSION_DOMAINS.gpa;
const [SAT_MIN, SAT_MAX] = ADMISSION_DOMAINS.sat;
const CONTEXT_FIELDS = ['firstGen', 'athlete', 'resident'];
const EPSILON = 1e-9;
const unit = value => Math.min(1, Math.max(0, value));
const weight = (policy, field) => policy.weights[field] ?? 0;

export const backgroundScore = (student, policy) => CONTEXT_FIELDS.reduce(
  (sum, field) => sum + (student?.[field] ? weight(policy, field) : 0), 0,
);

export const scoreStudent = (student, policy) => {
  if (!student) return 0;
  return unit((student.gpa - GPA_MIN) / (GPA_MAX - GPA_MIN)) * weight(policy, 'gpa')
    + unit((student.sat - SAT_MIN) / (SAT_MAX - SAT_MIN)) * weight(policy, 'sat')
    + backgroundScore(student, policy);
};

export const getDecision = (student, policy) => scoreStudent(student, policy) >= policy.threshold;

const toChartPoint = ({ x, y }) => ({ x: GPA_MIN + (GPA_MAX - GPA_MIN) * x, y: SAT_MIN + (SAT_MAX - SAT_MIN) * y });

// Intersect a*x + b*y = threshold - contextScore with the normalized chart square.
// Returns a point at a tangent corner, an empty segment off-chart, and handles zero/negative weights.
export const admissionBoundary = (policy, contextScore = 0) => {
  const a = weight(policy, 'gpa');
  const b = weight(policy, 'sat');
  const cutoff = policy.threshold - contextScore;
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
  const academicScore = p => weight(policy, 'gpa') * p.x + weight(policy, 'sat') * p.y;
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
