import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { EXPLORER_FEATURES, getExplorerOptions } from '../shared/featureExplorer.js';
import ZipIncomeInfo from './ZipIncomeInfo.jsx';
import { ExplorerDropdown } from './ExplorerDropdown.jsx';
import './explorer-background-controls.css';

const COPY = {
  en: { original: 'Original', missing: 'Missing', income: 'ZIP-code median household income ($)', incomePlaceholder: 'Amount', invalid: 'Enter a non-negative amount.', admitted: 'admitted', noStudents: 'No students' },
  zh: { original: '原始', missing: '缺失', income: 'ZIP 地区家庭收入中位数（美元）', incomePlaceholder: '输入金额', invalid: '请输入非负金额。', admitted: '录取', noStudents: '无学生' },
  es: { original: 'Original', missing: 'Sin datos', income: 'Ingreso familiar mediano de zona ZIP ($)', incomePlaceholder: 'Importe', invalid: 'Introduce un importe no negativo.', admitted: 'admitidos', noStudents: 'Sin estudiantes' },
};
const OUTCOME_COLUMNS = {
  en: { group: 'Group', rate: 'Admission rate', count: 'Admitted / total' },
  zh: { group: '群体', rate: '录取率', count: '录取人数 / 总人数' },
  es: { group: 'Grupo', rate: 'Tasa de admisión', count: 'Admitidos / total' },
};
const FIELD_HELP = {
  en: {
    about: name => `About ${name}`,
    ethnicity: 'The ethnic group listed for this student.',
    major: 'The student’s field of study.',
    mathStatus: 'Whether the student is enrolled in math.',
    residency: 'Whether the student lives in the same state as the college.',
    transfer: 'Whether the student is transferring from another college.',
  },
  zh: {
    about: name => `了解${name}`,
    ethnicity: '学生档案里填写的族裔。',
    major: '学生所学的专业。',
    mathStatus: '学生是否选了数学课。',
    residency: '学生住的地方和申请的大学是否在同一个州。',
    transfer: '这名学生是否从另一所大学转入。',
  },
  es: {
    about: name => `Información sobre ${name.toLocaleLowerCase('es')}`,
    ethnicity: 'El grupo étnico que figura en la ficha del estudiante.',
    major: 'Lo que estudia.',
    mathStatus: 'Indica si el estudiante está inscrito en matemáticas.',
    residency: 'Indica si el estudiante vive en el mismo estado que la universidad.',
    transfer: 'Indica si el estudiante se traslada desde otra universidad.',
  },
};
const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
const missingCategory = value => value === null || value === undefined
  || (typeof value === 'string' && !value.trim())
  || (typeof value === 'number' && !Number.isFinite(value))
  || !['string', 'number', 'boolean'].includes(typeof value);
const optionFor = (options, value) => options.find(option => option.missing ? missingCategory(value)
  : Object.is(value, Object.hasOwn(option, 'rawValue') ? option.rawValue : option.value));
const incomeText = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

function FieldHelp({ feature, lang }) {
  const copy = FIELD_HELP[lang] || FIELD_HELP.en;
  const name = localized(feature.label, lang);
  return <ExplorerDropdown className="explorer-info exb-field-help" accessibleLabel={copy.about(name)}
    icon={<CircleAlert size={14} aria-hidden="true" />}>
    <strong>{name}</strong>
    <p>{copy[feature.key]}</p>
  </ExplorerDropdown>;
}

function IncomeField({ student, original, onChange, lang, t, feature }) {
  const disabled = !student || !original;
  const [entry, setEntry] = useState(() => ({ source: student, text: incomeText(student?.zipIncome), invalid: false }));
  // A reset also replaces the profile object when its committed income is
  // unchanged; clear any uncommitted text in that case as well.
  if (entry.source !== student) setEntry({ source: student, text: incomeText(student?.zipIncome), invalid: false });
  const changed = !disabled && !Object.is(student.zipIncome, original.zipIncome);
  const originalValue = incomeText(original?.zipIncome) ? `$${original.zipIncome.toLocaleString()}` : t.missing;
  const commit = () => {
    if (disabled) return;
    if (!entry.text.trim()) {
      setEntry({ source: student, text: incomeText(student.zipIncome), invalid: false });
      return;
    }
    const value = Number(entry.text);
    if (!Number.isFinite(value) || value < 0) {
      setEntry({ ...entry, invalid: true });
      return;
    }
    setEntry({ source: student, text: String(value), invalid: false });
    if (!Object.is(value, student.zipIncome)) onChange('zipIncome', value);
  };
  return <div className="exb-field" data-edited={changed} data-background-field="zipIncome">
    <label htmlFor="explorer-background-zipIncome" title={t.income}>{localized(feature.label, lang)}<span className="sr-only"> ($)</span></label>
    {!disabled && <span className="exb-currency" aria-hidden="true">$</span>}
    <input id="explorer-background-zipIncome" type="text" inputMode="decimal" value={entry.text} disabled={disabled} placeholder={disabled ? '—' : t.incomePlaceholder}
      aria-invalid={entry.invalid || undefined} aria-describedby={entry.invalid ? 'explorer-income-error' : changed ? 'explorer-original-zipIncome' : undefined}
      onChange={event => setEntry({ source: student, text: event.target.value, invalid: false })}
      onBlur={commit} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setEntry({ source: student, text: incomeText(student.zipIncome), invalid: false });
        }
      }} />
    <ZipIncomeInfo lang={lang} />
    <span className="exb-helper">
      {entry.invalid ? <span id="explorer-income-error" className="exb-error" role="alert" title={t.invalid}>{t.invalid}</span>
        : changed && <span id="explorer-original-zipIncome" className="exb-original" title={`${t.original}: ${originalValue}`}>{t.original}: {originalValue}</span>}
    </span>
  </div>;
}

export function ExplorerBackgroundEditor({ student, original, students = [], onChange, lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  const disabled = !student || !original;
  const records = [...students, ...[original, student].filter(Boolean)];
  return <div className="explorer-background-editor" data-explorer-background-editor>
    {EXPLORER_FEATURES.map(feature => {
      if (feature.type === 'number') return <IncomeField key={feature.key} {...{ student, original, onChange, lang, t, feature }} />;
      const options = getExplorerOptions(feature.key, records, []);
      const current = !disabled && optionFor(options, student[feature.key]);
      const initial = !disabled && optionFor(options, original[feature.key]);
      const changed = !disabled && !Object.is(student[feature.key], original[feature.key]);
      return <div className="exb-field" key={feature.key} data-edited={changed} data-background-field={feature.key}>
        <label htmlFor={`explorer-background-${feature.key}`} title={localized(feature.label, lang)}>{localized(feature.label, lang)}</label>
        <select id={`explorer-background-${feature.key}`} value={current?.value ?? ''} disabled={disabled} title={disabled ? undefined : localized(current?.label, lang) || t.missing}
          aria-describedby={changed ? `explorer-original-${feature.key}` : undefined}
          onChange={event => {
            if (disabled) return;
            const chosen = options.find(option => option.value === event.target.value);
            if (!chosen) return;
            const raw = chosen.missing ? (current?.missing ? student[feature.key] : initial?.missing ? original[feature.key] : null)
              : Object.hasOwn(chosen, 'rawValue') ? chosen.rawValue : chosen.value;
            onChange(feature.key, raw);
          }}>
          {disabled && <option value="">—</option>}
          {options.map(option => <option key={option.value} value={option.value}>{localized(option.label, lang)}</option>)}
        </select>
        <FieldHelp feature={feature} lang={lang} />
        <span className="exb-helper">{changed && <span id={`explorer-original-${feature.key}`} className="exb-original" title={`${t.original}: ${localized(initial?.label, lang) || t.missing}`}>{t.original}: {localized(initial?.label, lang) || t.missing}</span>}</span>
      </div>;
    })}
  </div>;
}

export function ExplorerOutcomeColumns({ lang = 'en' }) {
  const columns = OUTCOME_COLUMNS[lang] || OUTCOME_COLUMNS.en;
  return <div className="exb-outcome-columns">
    <span>{columns.group}</span><span>{columns.rate}</span><span>{columns.count}</span>
  </div>;
}

export function ExplorerGroupOutcomes({ groups = [], binning, lang = 'en', expandedKeys, onToggle, onHighlight, highlightContextKey }) {
  const t = COPY[lang] || COPY.en;
  const hovered = useRef(null);
  const focused = useRef(null);
  const [selection, setSelection] = useState(null);
  const selectedOption = selection && selection.contextKey === highlightContextKey && expandedKeys.includes(selection.key)
    ? groups.find(feature => feature.key === selection.key)?.groups.find(group => group.option.value === selection.value)?.option
    : null;
  if (selection && !selectedOption) setSelection(null);
  // Threshold edits keep the selection. A view reset or a change to its grouping can clear it.
  const highlightScope = JSON.stringify([highlightContextKey, expandedKeys,
    groups.map(feature => [feature.key, feature.groups.map(group => group.option.value)])]);
  useLayoutEffect(() => {
    hovered.current = null;
    focused.current = null;
    onHighlight?.(selectedOption ? { key: selection.key, option: selectedOption } : null);
    return () => onHighlight?.(null);
  }, [highlightScope, onHighlight, selection, selectedOption]);
  return <div className="explorer-group-outcomes" data-explorer-group-outcomes>
    {groups.map(feature => <section className="exb-outcome-group" key={feature.key} data-outcome-feature={feature.key}
      aria-labelledby={`explorer-outcome-${feature.key}`}>
      <div className="exb-outcome-accordion-heading">
        <h3>
          <span className="exb-outcome-heading-label" id={`explorer-outcome-${feature.key}`} aria-hidden="true">
            <ChevronDown size={13} /><span>{localized(feature.label, lang)}</span>
          </span>
          <button type="button" aria-labelledby={`explorer-outcome-${feature.key}`}
            aria-expanded={expandedKeys.includes(feature.key)} aria-controls={`explorer-outcome-rows-${feature.key}`}
            aria-describedby={`explorer-outcome-count-${feature.key}`}
            onClick={() => onToggle(feature.key)} />
        </h3>
        {feature.key === 'zipIncome' && <ZipIncomeInfo lang={lang} binning={binning} />}
        <span className="exb-outcome-category-count" id={`explorer-outcome-count-${feature.key}`}>{feature.groups.length}</span>
      </div>
      <div className="exb-outcome-collapse" id={`explorer-outcome-rows-${feature.key}`}
        data-expanded={expandedKeys.includes(feature.key)} aria-hidden={!expandedKeys.includes(feature.key)} inert={!expandedKeys.includes(feature.key)}>
      <div className="exb-outcome-collapse-inner"><div className="exb-outcome-rows">{feature.groups.map(group => {
        const name = localized(group.option.label, lang);
        const hasStudents = group.total > 0 && Number.isFinite(group.rate);
        const rate = hasStudents ? Math.round(group.rate) : null;
        const accessible = hasStudents ? `${name}: ${group.admitted}/${group.total} ${t.admitted}, ${rate}%` : `${name}: ${t.noStudents}, 0/0`;
        const context = { key: feature.key, option: group.option };
        const selected = selection?.key === feature.key && selection.value === group.option.value;
        return <button type="button" className="exb-outcome-row" key={group.option.value} data-outcome-value={group.option.value}
          data-total={group.total} data-admitted={group.admitted} aria-label={accessible} aria-pressed={selected}
          onClick={() => setSelection(selected ? null : { key: feature.key, value: group.option.value, contextKey: highlightContextKey })}
          onPointerEnter={event => {
            if (selection || event.pointerType === 'touch') return;
            hovered.current = context;
            onHighlight?.(context);
          }} onPointerLeave={() => { hovered.current = null; if (!selection) onHighlight?.(focused.current); }}
          onFocus={() => { focused.current = context; hovered.current = null; if (!selection) onHighlight?.(context); }}
          onBlur={() => { focused.current = null; if (!selection) onHighlight?.(hovered.current); }}>
          <span className="exb-outcome-label" data-english-label={localized(group.option.label, 'en')} title={name}><span>{name}</span></span>
          <span className="exb-outcome-rate">{hasStudents ? `${rate}%` : '—'}</span>
          <span className="exb-outcome-count">{group.admitted}/{group.total}</span>
          <span className="exb-outcome-track" aria-hidden="true"><span style={{ width: `${hasStudents ? Math.max(0, Math.min(100, group.rate)) : 0}%` }} /></span>
        </button>;
      })}</div></div></div>
    </section>)}
  </div>;
}
