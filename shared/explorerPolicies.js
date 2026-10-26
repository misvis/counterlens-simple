// Arbitrary, hand-authored rules for the synthetic six-background classroom
// simulation. These coefficients are not fitted estimates, admission advice,
// evidence about any category, or rules for real students.
//
// A categorical rule maps a declared string value to points. An income rule
// interpolates between two point values over a fixed dollar domain and clamps
// outside that domain. Missing and unlisted values contribute zero points.
export const EXPLORER_POLICY_ALGORITHM = 'explorer_weighted_sum_v1';
export const EXPLORER_POLICY_REVISION = 'six-background-simulation-v4';
export const EXPLORER_BACKGROUND_KEYS = Object.freeze([
  'ethnicity', 'residency', 'zipIncome', 'major', 'transfer', 'mathStatus',
]);

const categorical = points => Object.freeze({ type: 'categorical', points: Object.freeze(points) });
const linear = points => Object.freeze({
  type: 'linear', domain: Object.freeze([25000, 150000]), points: Object.freeze(points),
});
const ethnicity = categorical({
  White: 0,
  Asian: 2,
  'Black/African American': -1,
  'Hispanic/Latino': 1,
  'Not Specified': 0,
  'Two or More': -2,
  'Native Hawaiian/Other Pacific Islander': -2,
  'American Indian/Alaska Native': -2,
});
const residency = categorical({ instate: 3, outofstate: 0 });
const transfer = categorical({ no: 0, yes: 4 });
const backgroundRules = incomePoints => Object.freeze({
  ethnicity,
  residency,
  zipIncome: linear([incomePoints, 0]),
  major: categorical({
    Economics: -1,
    CompSci: 2,
    BiologicalSci: 1,
    CompEng: 3,
    Psychology: 0,
    Biochem: 2,
    ChemEng: 3,
    Math: 2,
  }),
  transfer,
  mathStatus: categorical({
    Enrolled: 5,
    'Not Enrolled': 2,
    None: 0,
  }),
});
const academicBackgroundRules = Object.freeze(Object.fromEntries(Object.entries(backgroundRules(0)).map(([key, rule]) => [
  key, rule.type === 'linear' ? linear([0, 0])
    : categorical(Object.fromEntries(Object.keys(rule.points).map(value => [value, 0]))),
])));
const policy = (id, rules, gpa = 45, sat = 25, threshold = 55) => Object.freeze({
  id,
  algorithm: EXPLORER_POLICY_ALGORITHM,
  simulationRevision: EXPLORER_POLICY_REVISION,
  weights: Object.freeze({ gpa, sat }),
  backgroundRules: rules,
  threshold,
});

// IDs retain the local demo's existing policy-selection identifiers. The
// algorithm and revision identify these separately from its legacy rules.
// Restore the original Academic Focus GPA/SAT rule. Income Support changes
// only the income contribution from Holistic Review, keeping that comparison's
// academic weights and cutoff fixed; its maximum total is 100.
export const EXPLORER_SIMULATION_POLICIES = Object.freeze([
  policy('academic', academicBackgroundRules, 60, 40, 62),
  policy('holistic', backgroundRules(8)),
  policy('opportunity', backgroundRules(13)),
]);

export const isExplorerPolicy = policy => policy?.algorithm === EXPLORER_POLICY_ALGORITHM;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const unit = value => Math.max(0, Math.min(1, value));
const validLinearRule = rule => rule?.type === 'linear'
  && Array.isArray(rule.domain) && rule.domain.length === 2 && rule.domain.every(finite)
  && rule.domain[1] > rule.domain[0]
  && Array.isArray(rule.points) && rule.points.length === 2 && rule.points.every(finite);
const linearPoints = (value, rule) => {
  const position = unit((value - rule.domain[0]) / (rule.domain[1] - rule.domain[0]));
  return rule.points[0] + position * (rule.points[1] - rule.points[0]);
};
const valuePoints = (value, rule) => {
  if (rule?.type === 'categorical') {
    return typeof value === 'string' && Object.hasOwn(rule.points ?? {}, value) && finite(rule.points[value])
      ? rule.points[value] : 0;
  }
  return finite(value) && validLinearRule(rule) ? linearPoints(value, rule) : 0;
};

export const explorerBackgroundContributions = (student, policy) => EXPLORER_BACKGROUND_KEYS.map(key => ({
  key, points: valuePoints(student?.[key], policy?.backgroundRules?.[key]),
}));

// Context keys are fixed when present, including undefined/null (missing).
// Omitted keys vary over the full declared support plus the missing-value
// contribution. Income can be fixed to a number or constrained to a [min,max)
// bin; its endpoint scores are conservative infimum/supremum bounds. Grouping
// never replaces an actual student's income with a bin midpoint.
export const explorerBackgroundExtents = (policy, context = {}) => EXPLORER_BACKGROUND_KEYS.reduce(
  ([minimum, maximum], key) => {
    const rule = policy?.backgroundRules?.[key];
    let points;
    if (Object.hasOwn(context, key)) {
      const value = context[key];
      const range = validLinearRule(rule) && value && typeof value === 'object'
        && typeof value.min === 'number' && typeof value.max === 'number'
        && !Number.isNaN(value.min) && !Number.isNaN(value.max) && value.min < value.max;
      points = range ? [linearPoints(value.min, rule), linearPoints(value.max, rule)] : [valuePoints(value, rule)];
    } else if (rule?.type === 'categorical') {
      points = [0, ...Object.values(rule.points ?? {}).filter(finite)];
    } else {
      points = validLinearRule(rule) ? [0, ...rule.points] : [0];
    }
    return [minimum + Math.min(...points), maximum + Math.max(...points)];
  },
  [0, 0],
);
