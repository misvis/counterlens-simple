import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getDecision, scoreContributions, scoreStudent } from '../shared/admissionModel.js';
import './score-breakdown-view.css';

const FEATURES = ['gpa', 'sat', 'firstGen', 'athlete', 'resident'];
const PALETTES = {
  light: ['#2563eb', '#60a5fa', '#6d28d9', '#a78bfa', '#c4b5fd'],
  dark: ['#60a5fa', '#93c5fd', '#a78bfa', '#c4b5fd', '#ddd6fe'],
};
const COPY = {
  en: {
    student: 'Student', choose: 'Choose a student', points: 'points', closest: 'Closest to cutoff', others: 'Other students',
    original: 'Original', edited: 'Edited', noChanges: 'No changes', cutoff: 'Cutoff',
    admitted: 'Admitted', rejected: 'Not admitted', score: 'Decision score',
    empty: 'Choose a student to see their score breakdown.',
    contributions: 'Points: original → edited',
    help: 'The five parts add up to the decision score. Reaching the cutoff means admitted.',
    signedHelp: 'Bars show added and subtracted points. The dot marks the total used for admission.',
    chart: 'Original and edited decision scores compared with the admission cutoff',
    fields: { gpa: 'GPA', sat: 'SAT', firstGen: 'First-generation', athlete: 'Athletics', resident: 'Residency' },
    compactFields: { gpa: 'GPA', sat: 'SAT', firstGen: 'First-gen', athlete: 'Athlete', resident: 'Resident' },
  },
  zh: {
    student: '学生', choose: '选择学生', points: '分', closest: '最接近录取线', others: '其他学生',
    original: '原始档案', edited: '调整后', noChanges: '尚未修改', cutoff: '录取线',
    admitted: '录取', rejected: '不录取', score: '决策分数',
    empty: '选择学生，查看各项得分。', contributions: '各项得分：原始 → 调整后',
    help: '五项得分相加就是决策分数，达到录取线即被录取。',
    signedHelp: '色条分别表示加分和减分，圆点表示用于录取判断的总分。',
    chart: '原始和调整后决策分数与录取线的对比',
    fields: { gpa: 'GPA', sat: 'SAT', firstGen: '第一代大学生', athlete: '运动员', resident: '居民身份' },
    compactFields: { gpa: 'GPA', sat: 'SAT', firstGen: '第一代', athlete: '运动员', resident: '居民身份' },
  },
  es: {
    student: 'Estudiante', choose: 'Elige un estudiante', points: 'puntos', closest: 'Más cerca del corte', others: 'Otros estudiantes',
    original: 'Original', edited: 'Editado', noChanges: 'Sin cambios', cutoff: 'Corte',
    admitted: 'Admitido', rejected: 'No admitido', score: 'Puntuación',
    empty: 'Elige un estudiante para ver sus puntos.', contributions: 'Puntos: original → editado',
    help: 'Las cinco partes suman la puntuación. Alcanzar el corte significa admisión.',
    signedHelp: 'Las barras muestran puntos sumados y restados. El punto marca el total usado para la admisión.',
    chart: 'Puntuaciones original y editada comparadas con el corte de admisión',
    fields: { gpa: 'GPA', sat: 'SAT', firstGen: 'Primera generación', athlete: 'Deporte', resident: 'Residencia' },
    compactFields: { gpa: 'GPA', sat: 'SAT', firstGen: '1.ª gen.', athlete: 'Deporte', resident: 'Residencia' },
  },
};

const formatPoints = value => Number(value.toFixed(1)).toString();

// Negative contributions stack to the left of zero; positive ones stack right.
// The net-total marker remains separate so a signed bar cannot imply a false sum.
const contributionSegments = contributions => {
  let positive = 0;
  let negative = 0;
  return contributions.map(contribution => {
    const start = contribution.points < 0 ? negative : positive;
    const end = start + contribution.points;
    if (contribution.points < 0) negative = end;
    else positive = end;
    return { ...contribution, start, end };
  });
};

export default function ScoreBreakdownView({
  students, policy, selectedStudent, draftStudent, onSelect, isLight, colors, lang, isMining, edgeCaseIds,
}) {
  const t = COPY[lang] || COPY.en;
  const selectId = useId();
  const chartRef = useRef(null);
  const [size, setSize] = useState({ width: 650, height: 150 });
  const palette = PALETTES[isLight ? 'light' : 'dark'];
  const editedStudent = selectedStudent ? (draftStudent || selectedStudent) : null;
  const changed = Boolean(selectedStudent && editedStudent && FEATURES.some(key => selectedStudent[key] !== editedStudent[key]));
  const originalParts = useMemo(() => selectedStudent ? scoreContributions(selectedStudent, policy) : [], [selectedStudent, policy]);
  const editedParts = useMemo(() => editedStudent ? scoreContributions(editedStudent, policy) : [], [editedStudent, policy]);
  const negativeLimit = Math.min(0, FEATURES.reduce((sum, key) => sum + Math.min(0, policy.weights[key] || 0), 0));
  const positiveLimit = Math.max(100, FEATURES.reduce((sum, key) => sum + Math.max(0, policy.weights[key] || 0), 0));
  const signed = negativeLimit < 0;
  const edgeIds = edgeCaseIds instanceof Set ? edgeCaseIds : new Set(edgeCaseIds || []);
  const studentOption = student => <option key={student.id} value={student.id}>{student.id} · {formatPoints(scoreStudent(student, policy))} {t.points}</option>;

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const left = width < 450 ? 83 : 104;
  const right = 38;
  const top = 22;
  const bottom = 27;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(60, height - top - bottom);
  const barHeight = Math.min(27, plotHeight * .28);
  const rowCenters = [top + plotHeight * .25, top + plotHeight * .75];
  const x = value => left + (value - negativeLimit) / (positiveLimit - negativeLimit) * plotWidth;
  const ticks = Array.from({ length: 5 }, (_, index) => negativeLimit + (positiveLimit - negativeLimit) * index / 4);
  const surface = isLight ? '#ffffff' : '#1b1f27';
  const rows = [
    { key: 'original', label: t.original, student: selectedStudent, parts: originalParts },
    { key: 'edited', label: t.edited, student: editedStudent, parts: editedParts },
  ];

  return (
    <div className={`score-breakdown-view${isLight ? ' score-breakdown-light' : ''}`} data-boundary-ui data-score-breakdown
      onPointerDown={event => event.stopPropagation()}>
      <div className="score-breakdown-topline">
        <label htmlFor={selectId}>{t.student}</label>
        <select id={selectId} value={selectedStudent?.id || ''} onChange={event => onSelect(event.target.value)}>
          <option value="" disabled>{t.choose}</option>
          {isMining ? <>
            <optgroup label={t.closest}>{students.filter(student => edgeIds.has(student.id)).map(studentOption)}</optgroup>
            <optgroup label={t.others}>{students.filter(student => !edgeIds.has(student.id)).map(studentOption)}</optgroup>
          </> : students.map(studentOption)}
        </select>
        <span className="score-breakdown-change-note">{selectedStudent && !changed ? t.noChanges : '\u00a0'}</span>
      </div>
      <div className="score-breakdown-chart" ref={chartRef}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.chart}>
          <text x={x(policy.threshold)} y={12} textAnchor={policy.threshold >= positiveLimit - 5 ? 'end' : 'middle'} className="score-breakdown-cutoff-label">{t.cutoff}: {formatPoints(policy.threshold)}</text>
          {ticks.map(value => <g key={value} aria-hidden="true">
            <line x1={x(value)} y1={top - 3} x2={x(value)} y2={top + plotHeight + 3} className="score-breakdown-grid" />
            <text x={x(value)} y={height - 6} textAnchor="middle" className="score-breakdown-tick">{formatPoints(value)}</text>
          </g>)}
          {signed && <line x1={x(0)} y1={top - 3} x2={x(0)} y2={top + plotHeight + 3} className="score-breakdown-zero-line" />}
          {rows.map((row, index) => {
            const cy = rowCenters[index];
            const total = row.student ? scoreStudent(row.student, policy) : null;
            const admitted = row.student ? getDecision(row.student, policy) : null;
            const outcome = admitted ? t.admitted : t.rejected;
            const outcomeColor = admitted ? colors.admitted : colors.rejected;
            const badgeWidth = Math.min(left - 11, outcome.length * (lang === 'zh' ? 12 : 5.7) + 12);
            return <g key={row.key} data-profile={row.key} data-score={total ?? ''}>
              <text x={4} y={cy - 3} className="score-breakdown-row-title">{row.label}</text>
              {row.student && <g aria-label={outcome}>
                <rect x={2} y={cy + 2} width={badgeWidth} height={17} rx={5} fill={outcomeColor} fillOpacity={.11} />
                <text x={8} y={cy + 14} className="score-breakdown-outcome" fill={outcomeColor}>{outcome}</text>
              </g>}
              <rect x={left} y={cy - barHeight / 2} width={plotWidth} height={barHeight} rx={4} className="score-breakdown-track" />
              {contributionSegments(row.parts).map((segment, segmentIndex) => <rect key={segment.key}
                x={x(Math.min(segment.start, segment.end))} y={cy - barHeight / 2}
                width={Math.abs(x(segment.end) - x(segment.start))} height={barHeight}
                fill={palette[segmentIndex]} stroke={surface} strokeWidth={.8}
                data-contribution={segment.key} data-points={segment.points}>
                <title>{t.fields[segment.key]}: {formatPoints(segment.points)} {t.points}</title>
              </rect>)}
              {row.student && <g>
                <line x1={x(total)} y1={cy - barHeight / 2 - 3} x2={x(total)} y2={cy + barHeight / 2 + 3} stroke="var(--threshold-text)" strokeWidth={2} />
                <circle cx={x(total)} cy={cy} r={4} fill={surface} stroke="var(--threshold-text)" strokeWidth={2} />
              </g>}
              <text x={width - 2} y={cy + 4} textAnchor="end" className="score-breakdown-total">{total === null ? '—' : formatPoints(total)}</text>
            </g>;
          })}
          <line x1={x(policy.threshold)} y1={top - 5} x2={x(policy.threshold)} y2={top + plotHeight + 7} className="score-breakdown-cutoff-line" data-breakdown-cutoff />
        </svg>
        {!selectedStudent && <div className="score-breakdown-empty"><span>{t.empty}</span></div>}
      </div>
      <div className="score-breakdown-details">
        <div className="score-breakdown-detail-title">{t.contributions}</div>
        <dl className="score-breakdown-features">
          {FEATURES.map((key, index) => {
            const originalValue = originalParts.find(part => part.key === key)?.points;
            const editedValue = editedParts.find(part => part.key === key)?.points;
            return <div key={key} data-feature={key}>
              <dt title={t.fields[key]}><span aria-hidden="true" style={{ background: palette[index] }} /><span className="score-breakdown-feature-full">{t.fields[key]}</span><span className="score-breakdown-feature-compact" aria-hidden="true">{t.compactFields[key]}</span></dt>
              <dd><span>{originalValue === undefined ? '—' : formatPoints(originalValue)}</span><span aria-hidden="true">→</span><strong>{editedValue === undefined ? '—' : formatPoints(editedValue)}</strong></dd>
            </div>;
          })}
        </dl>
      </div>
      <p className="score-breakdown-help">{signed ? t.signedHelp : t.help}</p>
    </div>
  );
}
