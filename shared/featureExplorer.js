import { getDecision } from './admissionModel.js';
import { isExplorerPolicy } from './explorerPolicies.js';

// Feature metadata for the six-background synthetic prototype. Scoring rules
// are defined independently by the active policy, never by a grouping choice.
const label = (en, zh, es) => Object.freeze({ en, zh, es });
const option = (value, en, zh, es) => Object.freeze({ value, label: label(en, zh, es) });
const categorical = (key, names, values) => Object.freeze({
  key, type: 'categorical', label: label(...names), values: Object.freeze(values),
});

export const EXPLORER_FEATURES = Object.freeze([
  categorical('ethnicity', ['Ethnicity', '族裔', 'Etnicidad'], [
    option('White', 'White', '白人', 'Blanco'),
    option('Asian', 'Asian', '亚裔', 'Asiático'),
    option('Black/African American', 'Black/African American', '黑人／非裔美国人', 'Negro/afroamericano'),
    option('Hispanic/Latino', 'Hispanic/Latino', '西班牙裔／拉丁裔', 'Hispano/latino'),
    option('Not Specified', 'Not Specified', '未指定', 'No especificado'),
    option('Two or More', 'Two or More', '两个或更多族裔', 'Dos o más'),
    option('Native Hawaiian/Other Pacific Islander', 'Native Hawaiian/Other Pacific Islander',
      '夏威夷原住民／其他太平洋岛民', 'Nativo hawaiano/otro isleño del Pacífico'),
    option('American Indian/Alaska Native', 'American Indian/Alaska Native',
      '美洲印第安人／阿拉斯加原住民', 'Indígena americano/nativo de Alaska'),
  ]),
  categorical('residency', ['Residency', '居住身份', 'Residencia'], [
    option('instate', 'In-state', '州内', 'Del estado'),
    option('outofstate', 'Out-of-state', '州外', 'De otro estado'),
  ]),
  Object.freeze({ key: 'zipIncome', type: 'number', label: label('ZIP-area income', 'ZIP 地区收入', 'Ingresos de zona ZIP') }),
  categorical('major', ['Major', '专业', 'Carrera'], [
    option('Economics', 'Economics', '经济学', 'Economía'),
    option('CompSci', 'CompSci', '计算机科学', 'Informática'),
    option('BiologicalSci', 'BiologicalSci', '生物科学', 'Ciencias biológicas'),
    option('CompEng', 'CompEng', '计算机工程', 'Ingeniería informática'),
    option('Psychology', 'Psychology', '心理学', 'Psicología'),
    option('Biochem', 'Biochem', '生物化学', 'Bioquímica'),
    option('ChemEng', 'ChemEng', '化学工程', 'Ingeniería química'),
    option('Math', 'Math', '数学', 'Matemáticas'),
  ]),
  categorical('transfer', ['Transfer status', '转学状态', 'Traslado'], [
    option('no', 'Non-transfer', '非转入', 'Sin traslado'),
    option('yes', 'Transfer', '转入', 'Con traslado'),
  ]),
  // These are nominal dataset values. The literal "None" is a category,
  // distinct from a missing (null/undefined) value, not a course ranking.
  categorical('mathStatus', ['Math status', '数学课程状态', 'Estado de matemáticas'], [
    option('Enrolled', 'Enrolled', '已选课', 'Inscrito'),
    option('Not Enrolled', 'Not Enrolled', '未选课', 'No inscrito'),
    option('None', 'None', '无（None）', 'Ninguno'),
  ]),
]);

const FEATURES_BY_KEY = new Map(EXPLORER_FEATURES.map(feature => [feature.key, feature]));
const ALL_OPTION = option('__all__', 'All students', '全部学生', 'Todos los estudiantes');
const MISSING_OPTION = Object.freeze({
  ...option('__missing__', 'Missing', '缺失', 'Sin datos'), missing: true,
});
const isFiniteIncome = value => typeof value === 'number' && Number.isFinite(value);
const isMissingCategory = value => value === null || value === undefined
  || (typeof value === 'number' && !Number.isFinite(value))
  || (typeof value === 'string' && value.trim() === '')
  || !['string', 'number', 'boolean'].includes(typeof value);

const seededUnit = (id, field) => {
  let hash = 2166136261;
  for (const character of `${String(id)}:${field}:explorer-v1`) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  // Mix the stable hash so adjacent IDs do not produce adjacent categories.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
};

// Call only for explicitly synthetic records. Source fields always win, even
// when null: existing values and missingness must never be overwritten.
export const enrichExplorerRecords = records => records.map(record => {
  const pick = key => {
    const values = FEATURES_BY_KEY.get(key).values;
    return values[Math.floor(seededUnit(record.id, key) * values.length)].value;
  };
  // Preserve the five already-correct demo groups and split only the former
  // combined sixth bucket. Supplied source values still take precedence below.
  const ethnicities = FEATURES_BY_KEY.get('ethnicity').values;
  const ethnicityBucket = Math.floor(seededUnit(record.id, 'ethnicity') * 6);
  const ethnicityIndex = ethnicityBucket < 5 ? ethnicityBucket
    : 5 + Math.floor(seededUnit(record.id, 'ethnicity-detail') * 3);
  return {
    ethnicity: ethnicities[ethnicityIndex].value,
    residency: record.resident === true ? 'instate'
      : record.resident === false ? 'outofstate'
        : pick('residency'),
    zipIncome: Math.round(28000 + seededUnit(record.id, 'zipIncome') * 132000),
    major: pick('major'),
    transfer: pick('transfer'),
    mathStatus: pick('mathStatus'),
    ...record,
  };
});

const fixedThresholds = {
  3: [50000, 100000],
  4: [40000, 80000, 120000],
  5: [40000, 70000, 100000, 130000],
  6: [30000, 55000, 80000, 105000, 130000],
};
const formatDollars = amount => `$${amount.toLocaleString('en-US', { maximumFractionDigits: 20 })}`;
const edgeId = edge => edge === Infinity ? 'inf' : edge === -Infinity ? '-inf' : String(edge);
const incomeOption = (min, max) => {
  const range = min === -Infinity && max === Infinity ? null
    : min === -Infinity ? `< ${formatDollars(max)}`
      : max === Infinity ? `≥ ${formatDollars(min)}`
        : `${formatDollars(min)} – < ${formatDollars(max)}`;
  return {
    value: `income:${edgeId(min)}:${edgeId(max)}`,
    label: range ? label(range, range, range) : label('All incomes', '全部收入', 'Todos los ingresos'),
    min, max,
  };
};

// Every numeric interval is [min, max); the two infinite outer edges also
// cover finite incomes outside the observed sample. Quantiles are calculated
// once from the full supplied cohort and keep equal incomes in the same bin.
export const buildIncomeBins = (records, settings = {}) => {
  const count = [3, 4, 5, 6].includes(Number(settings.count)) ? Number(settings.count) : 3;
  const incomes = records.map(record => record.zipIncome).filter(isFiniteIncome).sort((a, b) => a - b);
  let thresholds;
  if (settings.method === 'custom') {
    thresholds = (Array.isArray(settings.thresholds) ? settings.thresholds : []).filter(isFiniteIncome);
  } else if (settings.method === 'quantile') {
    thresholds = incomes.length ? Array.from({ length: count - 1 }, (_, index) =>
      incomes[Math.floor((index + 1) * incomes.length / count)])
      .filter(value => value > incomes[0]) : [];
  } else {
    thresholds = fixedThresholds[count];
  }
  thresholds = [...new Set(thresholds)].sort((a, b) => a - b);
  const edges = [-Infinity, ...thresholds, Infinity];
  const bins = edges.slice(0, -1).map((min, index) => incomeOption(min, edges[index + 1]));
  if (records.some(record => !isFiniteIncome(record.zipIncome))) bins.push(MISSING_OPTION);
  return bins;
};

// Unknown scalar categories retain their exact raw value. Their option IDs are
// typed and prefixed to avoid collisions with supported categories or sentinels.
const rawOption = value => ({
  value: `raw:${typeof value}:${JSON.stringify(value)}`,
  label: label(String(value), String(value), String(value)),
  rawValue: value,
});
const englishCategoryOrder = new Intl.Collator('en', { sensitivity: 'base' });

export const getExplorerOptions = (featureKey, records, incomeBins) => {
  const feature = FEATURES_BY_KEY.get(featureKey);
  if (!feature) return [];
  if (feature.type === 'number') {
    const options = (incomeBins ?? buildIncomeBins(records)).filter(item => !item.missing);
    return records.some(record => !isFiniteIncome(record[featureKey])) ? [...options, MISSING_OPTION] : options;
  }
  const known = new Set(feature.values.map(item => item.value));
  const extras = new Map();
  let missing = false;
  for (const record of records) {
    const value = record[featureKey];
    if (isMissingCategory(value)) missing = true;
    else if (!known.has(value)) {
      const extra = rawOption(value);
      extras.set(extra.value, extra);
    }
  }
  const options = [...feature.values, ...[...extras.values()].sort((a, b) => a.value.localeCompare(b.value))];
  // Sort only the display copy: the simulation indexes the original metadata.
  if (featureKey === 'ethnicity' || featureKey === 'major') {
    options.sort((a, b) => englishCategoryOrder.compare(a.label.en, b.label.en));
  }
  return [...options, ...(missing ? [MISSING_OPTION] : [])];
};

export const normalizeExplorerLayout = (layout = {}) => {
  const columns = FEATURES_BY_KEY.has(layout.columns) ? layout.columns : '';
  const rows = FEATURES_BY_KEY.has(layout.rows) && layout.rows !== columns ? layout.rows : '';
  const sections = [...new Set(Array.isArray(layout.sections) ? layout.sections : [])]
    .filter(key => FEATURES_BY_KEY.has(key) && key !== columns && key !== rows);
  return { columns, rows, sections };
};

const matchesOption = (record, key, item) => {
  const feature = FEATURES_BY_KEY.get(key);
  if (!feature || !item) return false;
  const value = record[key];
  if (item.missing) return feature.type === 'number' ? !isFiniteIncome(value) : isMissingCategory(value);
  if (feature.type === 'number') return isFiniteIncome(value) && value >= item.min && value < item.max;
  return value === (Object.hasOwn(item, 'rawValue') ? item.rawValue : item.value);
};

export const recordMatchesExplorerContext = (record, context) => Boolean(record)
  && context.every(({ key, option: item }) => matchesOption(record, key, item));

const incomeInterval = item => item && !item.missing
  && typeof item.min === 'number' && typeof item.max === 'number'
  && !Number.isNaN(item.min) && !Number.isNaN(item.max) && item.min < item.max;
const midpoint = (minimum, maximum) => Math.max(minimum, Math.min(maximum, minimum / 2 + maximum / 2));
const incomeRuleDomain = policy => {
  const domain = policy?.backgroundRules?.zipIncome?.domain;
  return Array.isArray(domain) && domain.length === 2 && domain.every(isFiniteIncome) && domain[0] < domain[1]
    ? domain : [25000, 150000];
};
const emptyIncomeRepresentative = (item, policy) => {
  const [anchorLow, anchorHigh] = incomeRuleDomain(policy);
  const { min, max } = item;
  let value;
  if (Number.isFinite(min) && Number.isFinite(max)) {
    value = midpoint(min, max);
    // Adjacent floating-point edges can round their midpoint to the excluded
    // upper edge. The inclusive lower edge is still a valid representative.
    if (value < min || value >= max) value = min;
  } else if (min === -Infinity && max === Infinity) {
    value = midpoint(anchorLow, anchorHigh);
  } else if (max === Infinity) {
    value = Math.max(min, anchorHigh);
  } else if (anchorLow < max) {
    value = anchorLow;
  } else if (max > 0) {
    value = max / 2;
  } else {
    const step = Math.max(anchorHigh - anchorLow, Math.abs(max) * Number.EPSILON, Number.MIN_VALUE);
    value = max - step;
  }
  return isFiniteIncome(value) && value >= min && value < max ? value : null;
};

// Representatives belong only to the panel's line scenario. For an occupied
// income bin use the median of ALL ORIGINAL cohort incomes in that bin, never
// a panel intersection, displayed subset, or hypothetical student's income.
// Empty finite bins use their midpoint. Empty tails use the policy's income
// domain anchors when contained, otherwise an interior value derived from the
// cut; an unbounded bin uses the domain midpoint. Every numeric result remains
// inside the half-open bin. Missing/invalid bins have a null representative.
export const buildExplorerIncomeRepresentatives = (records = [], incomeBins = [], policy) => {
  const incomes = records.map(record => record.zipIncome).filter(isFiniteIncome).sort((a, b) => a - b);
  return new Map(incomeBins.map(item => {
    if (!incomeInterval(item)) return [item.value, null];
    const members = incomes.filter(value => value >= item.min && value < item.max);
    const middle = Math.floor(members.length / 2);
    const value = members.length ? (members.length % 2 ? members[middle] : midpoint(members[middle - 1], members[middle]))
      : emptyIncomeRepresentative(item, policy);
    return [item.value, value];
  }));
};

// This immutable profile defines one exact cutoff line per panel. Grouped
// fields override the active profile; all ungrouped values stay exact. It must
// never replace the actual draft, an original cohort record, or point scores.
export const buildExplorerPanelProfile = (profile, context = [], incomeRepresentatives, policy) => {
  const result = { ...profile };
  for (const { key, option: item } of context) {
    if (!FEATURES_BY_KEY.has(key) || !item) continue;
    if (key === 'zipIncome') {
      const representative = incomeRepresentatives?.get(item.value);
      result[key] = item.missing || !isFiniteIncome(representative) ? null : representative;
    } else {
      result[key] = item.missing ? null : Object.hasOwn(item, 'rawValue') ? item.rawValue : item.value;
    }
    if (key === 'residency' && !isExplorerPolicy(policy)
      && ['instate', 'outofstate'].includes(result[key])) result.resident = result[key] === 'instate';
  }
  return result;
};

// Summaries always use the supplied original cohort, independently of the
// displayed panels and hypothetical profile. Reuse the explorer's income bins
// so identical intervals have identical membership everywhere in the UI.
export const summarizeExplorerOutcomes = ({ records = [], policy, incomeBins } = {}) => {
  const bins = incomeBins ?? buildIncomeBins(records);
  const decisions = records.map(record => ({ record, admitted: getDecision(record, policy) }));
  return EXPLORER_FEATURES.map(feature => {
    const groups = getExplorerOptions(feature.key, records, bins).map(item => ({
      option: item, admitted: 0, total: 0,
    }));
    for (const { record, admitted } of decisions) {
      const group = groups.find(item => matchesOption(record, feature.key, item.option));
      if (!group) continue;
      group.total += 1;
      if (admitted) group.admitted += 1;
    }
    return {
      key: feature.key, label: feature.label,
      groups: groups.map(group => ({
        ...group, rate: group.total ? 100 * group.admitted / group.total : null,
      })),
    };
  });
};

// A panel conditions the background range without changing any profile. Keep
// income intervals as intervals rather than substituting a representative value.
// The one-argument form preserves the earlier synthetic residency mapping for
// legacy policies and callers.
export const explorerScoringContext = (context = [], policy) => {
  if (isExplorerPolicy(policy)) return Object.fromEntries(context
    .filter(({ key }) => FEATURES_BY_KEY.has(key))
    .map(({ key, option: item }) => [key, !item || item.missing ? null
      : key === 'zipIncome' ? { min: item.min, max: item.max }
        : Object.hasOwn(item, 'rawValue') ? item.rawValue : item.value]));
  const item = context.find(entry => entry.key === 'residency')?.option;
  if (!item || item.missing) return {};
  if (item.value === 'instate') return { resident: true };
  if (item.value === 'outofstate') return { resident: false };
  return {};
};

const contextId = context => JSON.stringify(context.map(({ key, option: item }) => [key, item.value]));
const contextsFor = (keys, optionsByKey) => keys.reduce((contexts, key) =>
  contexts.flatMap(context => optionsByKey.get(key).map(item => [...context, { key, option: item }])) , [[]]);

export const buildExplorerGroups = ({ records = [], layout = {}, incomeBins, selectedValues = {} } = {}) => {
  const normalized = normalizeExplorerLayout(layout);
  const dimensionKeys = [...normalized.sections, normalized.rows, normalized.columns].filter(Boolean);
  const bins = incomeBins ?? buildIncomeBins(records);
  const optionsByKey = new Map(dimensionKeys.map(key => {
    const options = getExplorerOptions(key, records, bins);
    const selection = selectedValues[key];
    return [key, Array.isArray(selection) ? options.filter(item => selection.includes(item.value)) : options];
  }));
  const columns = normalized.columns ? optionsByKey.get(normalized.columns) : [ALL_OPTION];
  const rows = normalized.rows ? optionsByKey.get(normalized.rows) : [ALL_OPTION];

  // Index records before generating the Cartesian product. Empty panels are
  // still generated, without repeatedly scanning the cohort for every panel.
  const membersByContext = new Map();
  for (const record of records) {
    const context = [];
    for (const key of dimensionKeys) {
      const item = optionsByKey.get(key).find(candidate => matchesOption(record, key, candidate));
      if (!item) break;
      context.push({ key, option: item });
    }
    if (context.length !== dimensionKeys.length) continue;
    const id = contextId(context);
    if (!membersByContext.has(id)) membersByContext.set(id, []);
    membersByContext.get(id).push(record);
  }

  const sections = contextsFor(normalized.sections, optionsByKey).map(sectionContext => ({
    id: `section:${contextId(sectionContext)}`,
    context: sectionContext,
    panels: rows.flatMap(row => columns.map(column => {
      const context = [
        ...sectionContext,
        ...(normalized.rows ? [{ key: normalized.rows, option: row }] : []),
        ...(normalized.columns ? [{ key: normalized.columns, option: column }] : []),
      ];
      const id = contextId(context);
      return {
        id: `panel:${id}`, columnValue: column.value, rowValue: row.value,
        context, members: membersByContext.get(id) ?? [],
      };
    })),
  }));
  return { columns, rows, sections, panelCount: sections.length * rows.length * columns.length };
};

// Pair only actual cross-panel positions in the current layout. A filtered
// endpoint remains null, so navigation never silently changes the filters.
export const buildExplorerProfilePair = (groups, original, draft) => {
  if (![original, draft].every(profile => profile && Number.isFinite(profile.gpa) && Number.isFinite(profile.sat))) return null;
  let originalPanel = null, draftPanel = null;
  for (const section of groups?.sections ?? []) {
    for (const panel of section.panels) {
      if (!originalPanel && panel.members.some(record => record.id === original.id)) originalPanel = panel;
      if (!draftPanel && recordMatchesExplorerContext(draft, panel.context)) draftPanel = panel;
      if (originalPanel && draftPanel) break;
    }
    if (originalPanel && draftPanel) break;
  }
  if (originalPanel && draftPanel) return originalPanel.id === draftPanel.id ? null : { originalPanel, draftPanel };
  if (originalPanel && !recordMatchesExplorerContext(draft, originalPanel.context)) return { originalPanel, draftPanel };
  if (draftPanel && !recordMatchesExplorerContext(original, draftPanel.context)) return { originalPanel, draftPanel };
  return null;
};
