import { ADMISSION_DOMAINS, admissionBoundary, backgroundScore, backgroundBoundaryBand, scoreStudent } from './admissionModel.js';
import { backgroundScenarios } from './backgroundScenarios.js';

export const FACET_FEATURES = Object.freeze(['resident', 'firstGen', 'athlete']);

const PROFILE_FIELDS = ['gpa', 'sat', ...FACET_FEATURES];
const sameProfile = (left, right) => Boolean(left && right && PROFILE_FIELDS.every(field => left[field] === right[field]));
const matches = (student, context) => Object.entries(context).every(([field, value]) => student[field] === value);

// Facets partition original records, while hypothetical profiles only annotate them.
// An omitted feature is unrestricted; it is never silently set to false.
export const facetedBackgrounds = ({
  students,
  policy,
  selectedStudent = null,
  draftStudent = null,
  selectedFeatures = [],
}) => {
  const features = FACET_FEATURES.filter(field => selectedFeatures.includes(field));
  const contexts = features.reduce((groups, field) => groups.flatMap(context =>
    (field === 'resident' ? [true, false] : [false, true]).map(value => ({ ...context, [field]: value }))), [{}]);
  // Reuse the established exact geometry for all complete background conditions.
  const completePanels = backgroundScenarios({ students: [], policy });

  return contexts.map(context => {
    const possibilities = completePanels.filter(panel => matches(panel.context, context));
    const representative = possibilities[0];
    const hasMixedBackgrounds = possibilities.some(panel => panel.backgroundScore !== representative.backgroundScore);
    const student = selectedStudent ? { ...selectedStudent, ...draftStudent, ...context } : null;
    const score = student ? scoreStudent(student, policy) : null;
    const range = backgroundBoundaryBand(policy, context);
    const [xMin, xMax] = ADMISSION_DOMAINS.gpa;
    const [yMin, yMax] = ADMISSION_DOMAINS.sat;
    return {
      id: features.length ? features.map(field => `${field}-${Number(context[field])}`).join('-') : 'all-students',
      context,
      members: students.filter(record => matches(record, context)),
      hasMixedBackgrounds,
      backgroundScore: hasMixedBackgrounds ? null : representative.backgroundScore,
      // A common GPA/SAT line is only valid when every possible hidden background
      // has the same contribution, including groups with no observed students.
      boundary: hasMixedBackgrounds ? { points: [], relation: 'varied' } : representative.boundary,
      admittedPolygon: hasMixedBackgrounds ? [] : representative.admittedPolygon,
      cutoffBand: { ...range, polygon: range.polygon.map(point => ({ x: xMin + point.x * (xMax - xMin), y: yMin + point.y * (yMax - yMin) })) },
      profileBoundary: student && hasMixedBackgrounds ? admissionBoundary(policy, backgroundScore(student, policy)) : null,
      plotRelation: possibilities.every(panel => panel.boundary.relation === 'all-admitted') ? 'all-admitted'
        : possibilities.every(panel => panel.boundary.relation === 'none-admitted') ? 'none-admitted' : 'mixed',
      scenario: student ? {
        student,
        score,
        admitted: score >= policy.threshold,
        isOriginal: sameProfile(student, selectedStudent),
        isDraft: sameProfile(student, draftStudent),
      } : null,
    };
  });
};
