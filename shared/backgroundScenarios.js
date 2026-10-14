import { ADMISSION_DOMAINS, admissionBoundary, backgroundScore, scoreStudent } from './admissionModel.js';

const PROFILE_FIELDS = ['gpa', 'sat', 'firstGen', 'athlete', 'resident'];
const sameProfile = (left, right) => Boolean(left && right && PROFILE_FIELDS.every(field => left[field] === right[field]));

// Clip the shared GPA/SAT domain against the exact scoring rule. This also
// handles zero/negative academic weights without assuming an upper-right fill.
const admittedRegion = (policy, context) => {
  const [xMin, xMax] = ADMISSION_DOMAINS.gpa;
  const [yMin, yMax] = ADMISSION_DOMAINS.sat;
  const corners = [{ x: xMin, y: yMin }, { x: xMax, y: yMin }, { x: xMax, y: yMax }, { x: xMin, y: yMax }];
  const distance = point => scoreStudent({ ...context, gpa: point.x, sat: point.y }, policy) - policy.threshold;
  const polygon = [];
  for (let index = 0; index < corners.length; index += 1) {
    const from = corners[index];
    const to = corners[(index + 1) % corners.length];
    const fromDistance = distance(from);
    const toDistance = distance(to);
    if (fromDistance >= 0) polygon.push(from);
    if ((fromDistance >= 0) !== (toDistance >= 0)) {
      const fraction = fromDistance / (fromDistance - toDistance);
      polygon.push({ x: from.x + fraction * (to.x - from.x), y: from.y + fraction * (to.y - from.y) });
    }
  }
  const area = Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  // A tangent point or edge has no area to shade; the boundary still shows it.
  return area > 1e-9 ? polygon : [];
};

// Enumerate all eight backgrounds; cohort membership uses only original records.
export const backgroundScenarios = ({
  students,
  policy,
  selectedStudent = null,
  draftStudent = null,
}) => [true, false].flatMap(resident => [false, true].flatMap(firstGen => [false, true].map(athlete => {
  const context = { firstGen, athlete, resident };
  const contextScore = backgroundScore(context, policy);
  const student = selectedStudent ? { ...selectedStudent, ...draftStudent, ...context } : null;
  const score = student ? scoreStudent(student, policy) : null;
  return {
    id: `resident-${Number(resident)}-firstGen-${Number(firstGen)}-athlete-${Number(athlete)}`,
    context,
    members: students.filter(record => record.firstGen === firstGen && record.athlete === athlete && record.resident === resident),
    backgroundScore: contextScore,
    boundary: admissionBoundary(policy, contextScore),
    admittedPolygon: admittedRegion(policy, context),
    scenario: student ? {
      student,
      score,
      admitted: score >= policy.threshold,
      isOriginal: sameProfile(student, selectedStudent),
      isDraft: sameProfile(student, draftStudent),
    } : null,
  };
})));
