import { useState } from 'react';
import { EXPLORER_FEATURES, getExplorerOptions } from '../shared/featureExplorer.js';
import './explorer-background-controls.css';

const COPY = {
  en: { original: 'Original', missing: 'Missing', income: 'ZIP-code median household income ($)', invalid: 'Enter a non-negative amount.', admitted: 'admitted', noStudents: 'No students' },
  zh: { original: '原始', missing: '缺失', income: 'ZIP 地区家庭收入中位数（美元）', invalid: '请输入非负金额。', admitted: '录取', noStudents: '无学生' },
  es: { original: 'Original', missing: 'Sin datos', income: 'Ingreso familiar mediano de zona ZIP ($)', invalid: 'Introduce un importe no negativo.', admitted: 'admitidos', noStudents: 'Sin estudiantes' },
};
const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
const missingCategory = value => value === null || value === undefined
  || (typeof value === 'string' && !value.trim())
  || (typeof value === 'number' && !Number.isFinite(value))
  || !['string', 'number', 'boolean'].includes(typeof value);
const optionFor = (options, value) => options.find(option => option.missing ? missingCategory(value)
  : Object.is(value, Object.hasOwn(option, 'rawValue') ? option.rawValue : option.value));
const incomeText = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

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
    <label htmlFor="explorer-background-zipIncome" title={t.income}>{localized(feature.label, lang)} ($)</label>
    <input id="explorer-background-zipIncome" type="text" inputMode="decimal" value={entry.text} disabled={disabled} placeholder={disabled ? '—' : undefined}
      aria-invalid={entry.invalid || undefined} aria-describedby={entry.invalid ? 'explorer-income-error' : changed ? 'explorer-original-zipIncome' : undefined}
      onChange={event => setEntry({ source: student, text: event.target.value, invalid: false })}
      onBlur={commit} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') setEntry({ source: student, text: incomeText(student.zipIncome), invalid: false });
      }} />
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
        <label htmlFor={`explorer-background-${feature.key}`}>{localized(feature.label, lang)}</label>
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
        <span className="exb-helper">{changed && <span id={`explorer-original-${feature.key}`} className="exb-original" title={`${t.original}: ${localized(initial?.label, lang) || t.missing}`}>{t.original}: {localized(initial?.label, lang) || t.missing}</span>}</span>
      </div>;
    })}
  </div>;
}

export function ExplorerGroupOutcomes({ groups = [], lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  return <div className="explorer-group-outcomes" data-explorer-group-outcomes>
    {groups.map(feature => <section className="exb-outcome-group" key={feature.key} data-outcome-feature={feature.key}
      aria-labelledby={`explorer-outcome-${feature.key}`}>
      <h3 id={`explorer-outcome-${feature.key}`}>{localized(feature.label, lang)}</h3>
      <div className="exb-outcome-rows">{feature.groups.map(group => {
        const name = localized(group.option.label, lang);
        const hasStudents = group.total > 0 && Number.isFinite(group.rate);
        const rate = hasStudents ? Math.round(group.rate) : null;
        const accessible = hasStudents ? `${name}: ${group.admitted}/${group.total} ${t.admitted}, ${rate}%` : `${name}: ${t.noStudents}, 0/0`;
        return <div className="exb-outcome-row" key={group.option.value} data-outcome-value={group.option.value}
          data-total={group.total} data-admitted={group.admitted} aria-label={accessible}>
          <span className="exb-outcome-label" title={name}>{name}</span>
          <span className="exb-outcome-rate">{hasStudents ? `${rate}%` : '—'}</span>
          <span className="exb-outcome-count">{group.admitted}/{group.total}</span>
          <span className="exb-outcome-track" aria-hidden="true"><span style={{ width: `${hasStudents ? Math.max(0, Math.min(100, group.rate)) : 0}%` }} /></span>
        </div>;
      })}</div>
    </section>)}
  </div>;
}
