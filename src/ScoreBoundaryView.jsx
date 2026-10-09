import { useEffect, useMemo, useRef, useState } from 'react';
import { getDecision, scoreCoordinates, scoreSpaceBoundary } from '../shared/admissionModel.js';
import './score-boundary-view.css';

const COPY = {
  en: {
    chart: 'Academic and background points with the admission cutoff',
    academic: 'Academic points', background: 'Background points', total: 'Decision score',
    cutoff: 'Cutoff', admitted: 'Admitted', rejected: 'Not admitted', adjusted: 'Adjusted profile',
    equation: 'Academic points + background points = decision score',
    hint: 'Edit profiles on the right; adjust the cutoff below.',
    overlap: '{count} students share this position. Click again to select the next.',
    noBackground: 'This policy assigns no background points.',
  },
  zh: {
    chart: '学业得分、背景加分与录取线',
    academic: '学业得分', background: '背景加分', total: '决策分数',
    cutoff: '录取线', admitted: '录取', rejected: '不录取', adjusted: '调整后的档案',
    equation: '学业得分 + 背景加分 = 决策分数',
    hint: '在右侧修改档案，在下方调整录取线。',
    overlap: '{count} 名学生位于此处，再次点击可切换学生。',
    noBackground: '此政策没有背景加分。',
  },
  es: {
    chart: 'Puntos académicos y de contexto con el corte de admisión',
    academic: 'Puntos académicos', background: 'Puntos de contexto', total: 'Puntuación',
    cutoff: 'Corte', admitted: 'Admitido', rejected: 'No admitido', adjusted: 'Perfil ajustado',
    equation: 'Puntos académicos + puntos de contexto = puntuación',
    hint: 'Edita el perfil a la derecha; ajusta el corte abajo.',
    overlap: '{count} estudiantes comparten esta posición. Vuelve a pulsar para seleccionar el siguiente.',
    noBackground: 'Esta política no asigna puntos de contexto.',
  },
};

const formatScore = value => Number(value.toFixed(1)).toString();
const ticks = (minimum, maximum) => Array.from({ length: 5 }, (_, index) => minimum + (maximum - minimum) * index / 4);
const profileChanged = (original, draft) => original && draft
  && ['gpa', 'sat', 'firstGen', 'athlete', 'resident'].some(key => original[key] !== draft[key]);

// Clip the score rectangle by the exact admission rule, x + y >= cutoff.
const admittedRegion = (xDomain, yDomain, cutoff) => {
  const [left, right] = xDomain;
  const [bottom, top] = yDomain;
  const polygon = [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }];
  const clipped = [];
  polygon.forEach((from, index) => {
    const to = polygon[(index + 1) % polygon.length];
    const fromDistance = from.x + from.y - cutoff;
    const toDistance = to.x + to.y - cutoff;
    if (fromDistance >= 0) clipped.push(from);
    if ((fromDistance >= 0) !== (toDistance >= 0)) {
      const ratio = fromDistance / (fromDistance - toDistance);
      clipped.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
    }
  });
  return clipped;
};

export default function ScoreBoundaryView({
  students, policy, selectedStudent, draftStudent, isMining, edgeCaseIds,
  onSelect, onClear, isLight, colors, lang,
}) {
  const t = COPY[lang] || COPY.en;
  const plotRef = useRef(null);
  const pointerStart = useRef(null);
  const [size, setSize] = useState({ width: 650, height: 300 });
  const [hovered, setHovered] = useState(null);
  const boundary = useMemo(() => scoreSpaceBoundary(policy), [policy]);
  const groups = useMemo(() => {
    const positions = new Map();
    students.forEach(student => {
      const coordinates = scoreCoordinates(student, policy);
      const key = `${coordinates.academic}:${coordinates.background}`;
      const group = positions.get(key);
      if (group) group.students.push(student);
      else positions.set(key, { key, coordinates, students: [student] });
    });
    return [...positions.values()];
  }, [students, policy]);

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const margin = { left: lang === 'es' ? 65 : 60, right: 19, top: 24, bottom: 44 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = Math.max(1, height - margin.top - margin.bottom);
  const xDomain = boundary.xDomain[0] === boundary.xDomain[1] ? [boundary.xDomain[0], boundary.xDomain[0] + 1] : boundary.xDomain;
  const yDomain = boundary.yDomain[0] === boundary.yDomain[1] ? [boundary.yDomain[0], boundary.yDomain[0] + 1] : boundary.yDomain;
  const x = value => margin.left + (value - xDomain[0]) / (xDomain[1] - xDomain[0]) * plotWidth;
  const y = value => margin.top + (yDomain[1] - value) / (yDomain[1] - yDomain[0]) * plotHeight;
  const backgroundIsZero = ['firstGen', 'athlete', 'resident'].every(key => !policy.weights[key]);
  const visibleYTicks = backgroundIsZero ? [0] : ticks(...yDomain);
  const hasDraft = profileChanged(selectedStudent, draftStudent);
  const original = selectedStudent ? scoreCoordinates(selectedStudent, policy) : null;
  const draft = hasDraft ? scoreCoordinates(draftStudent, policy) : null;
  const pointString = points => points.map(point => `${x(point.x)},${y(point.y)}`).join(' ');
  const edges = edgeCaseIds instanceof Set ? edgeCaseIds : new Set(edgeCaseIds || []);
  const hoveredGroup = groups.find(group => group.key === hovered);
  const activeStudent = hovered === 'draft' ? draftStudent
    : hoveredGroup?.students.find(student => student.id === selectedStudent?.id) || hoveredGroup?.students[0];
  const activeCoordinates = activeStudent ? scoreCoordinates(activeStudent, policy) : null;
  const surface = isLight ? '#ffffff' : '#1b1f27';
  const selectFromGroup = group => {
    const currentIndex = group.students.findIndex(student => student.id === selectedStudent?.id);
    onSelect(group.students[(currentIndex + 1) % group.students.length].id);
    setHovered(group.key);
  };

  return (
    <div className={`score-boundary-view${isLight ? ' score-boundary-light' : ''}`} data-boundary-ui data-score-map
      onPointerDown={event => {
        event.stopPropagation();
        pointerStart.current = event.target.closest?.('[data-score-student], [data-draft-score]')
          ? { x: event.clientX, y: event.clientY } : null;
      }}
      onPointerCancel={() => { pointerStart.current = null; }}
      onClickCapture={event => {
        const start = pointerStart.current;
        pointerStart.current = null;
        // This projection cannot be inverted to a unique profile. An attempted
        // drag must not become an accidental blank-space deselection either.
        if (event.detail && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}>
      <div className="score-boundary-canvas" ref={plotRef}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t.chart}
          onClick={() => { setHovered(null); onClear(); }} onMouseLeave={() => setHovered(null)}>
          <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="transparent" />
          {!backgroundIsZero && (
            <polygon points={pointString(admittedRegion(xDomain, yDomain, policy.threshold))} className="score-boundary-region" />
          )}
          {ticks(...xDomain).map(value => (
            <g key={`x-${value}`} aria-hidden="true">
              <line x1={x(value)} y1={margin.top} x2={x(value)} y2={margin.top + plotHeight} className="score-boundary-grid" />
              <text x={x(value)} y={margin.top + plotHeight + 19} textAnchor="middle" className="score-boundary-tick">{formatScore(value)}</text>
            </g>
          ))}
          {visibleYTicks.map(value => (
            <g key={`y-${value}`} aria-hidden="true">
              <line x1={margin.left} y1={y(value)} x2={margin.left + plotWidth} y2={y(value)} className="score-boundary-grid" />
              <text x={margin.left - 10} y={y(value) + 4} textAnchor="end" className="score-boundary-tick">{formatScore(value)}</text>
            </g>
          ))}
          <line x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight} className="score-boundary-axis" />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} className="score-boundary-axis" />
          <text x={margin.left + plotWidth / 2} y={height - 6} textAnchor="middle" className="score-boundary-axis-title">{t.academic}</text>
          <text transform={`translate(15 ${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className="score-boundary-axis-title">{t.background}</text>
          <text x={margin.left + plotWidth} y={14} textAnchor="end" className="score-boundary-cutoff">{t.cutoff}: {formatScore(policy.threshold)}</text>
          {backgroundIsZero && <text x={margin.left + 8} y={margin.top + 24} className="score-boundary-zero-note">{t.noBackground}</text>}
          {boundary.points.length > 1 && <polyline points={pointString(boundary.points)} className="score-boundary-line" data-score-boundary />}
          {boundary.points.length === 1 && (
            <g data-score-boundary>
              {backgroundIsZero && <line x1={x(boundary.points[0].x)} y1={margin.top} x2={x(boundary.points[0].x)} y2={y(boundary.points[0].y)} className="score-boundary-guide" />}
              <circle cx={x(boundary.points[0].x)} cy={y(boundary.points[0].y)} r={5} className="score-boundary-line" fill={surface} />
            </g>
          )}
          {groups.map(group => {
            const selected = group.students.some(student => student.id === selectedStudent?.id);
            const student = group.students.find(item => item.id === selectedStudent?.id) || group.students[0];
            const admitted = getDecision(student, policy);
            const edge = isMining && group.students.some(item => edges.has(item.id));
            const cx = x(group.coordinates.academic);
            const cy = y(group.coordinates.background);
            const color = admitted ? colors.admitted : colors.rejected;
            const overlapText = group.students.length > 1 ? t.overlap.replace('{count}', group.students.length) : '';
            return (
              <g key={group.key} role="button" tabIndex={0} data-score-student={student.id}
                aria-pressed={selected} aria-label={`${student.id}: ${admitted ? t.admitted : t.rejected}. ${t.academic}: ${formatScore(group.coordinates.academic)}. ${t.background}: ${formatScore(group.coordinates.background)}. ${overlapText}`}
                className="score-boundary-student" style={{ opacity: isMining && !edge && !selected ? 0.4 : 1 }}
                onMouseEnter={() => setHovered(group.key)} onFocus={() => setHovered(group.key)}
                onBlur={() => setHovered(null)} onClick={event => { event.stopPropagation(); selectFromGroup(group); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectFromGroup(group); }
                  if (event.key === 'Escape') { event.stopPropagation(); setHovered(null); onClear(); }
                }}>
                <circle cx={cx} cy={cy} r={7} fill="transparent" />
                <circle cx={cx} cy={cy} r={10} fill="none" className="score-boundary-focus-ring" />
                {edge && <circle cx={cx} cy={cy} r={8.5} fill="var(--workspace-edge-ring)" stroke="var(--workspace-edge)" strokeWidth={2} pointerEvents="none" />}
                {selected && <circle cx={cx} cy={cy} r={11} fill="none" stroke="var(--workspace-highlight)" strokeWidth={2.5} pointerEvents="none" />}
                {admitted ? <circle cx={cx} cy={cy} r={4.6} fill={color} stroke={surface} strokeWidth={1.2} />
                  : <path d={`M ${cx} ${cy - 5.5} L ${cx + 5.5} ${cy} L ${cx} ${cy + 5.5} L ${cx - 5.5} ${cy} Z`} fill={color} stroke={surface} strokeWidth={1.2} />}
                {group.students.length > 1 && <text x={cx + 8} y={cy - 7} className="score-boundary-overlap-count" paintOrder="stroke" stroke={surface} strokeWidth={3}>{group.students.length}</text>}
              </g>
            );
          })}
          {draft && original && (
            <g data-draft-score>
              <line x1={x(original.academic)} y1={y(original.background)} x2={x(draft.academic)} y2={y(draft.background)} className="score-boundary-draft-connector" />
              <g role="img" tabIndex={0} aria-label={`${t.adjusted}: ${t.total} ${formatScore(draft.total)}`}
                onMouseEnter={() => setHovered('draft')} onFocus={() => setHovered('draft')} onBlur={() => setHovered(null)}
                onClick={event => { event.stopPropagation(); setHovered('draft'); }}>
                <circle cx={x(draft.academic)} cy={y(draft.background)} r={10} fill={surface} stroke="var(--workspace-edit)" strokeWidth={2.4} strokeDasharray="4 3" />
                {getDecision(draftStudent, policy)
                  ? <circle cx={x(draft.academic)} cy={y(draft.background)} r={4} fill={colors.admitted} />
                  : <rect x={x(draft.academic) - 3.5} y={y(draft.background) - 3.5} width={7} height={7} transform={`rotate(45 ${x(draft.academic)} ${y(draft.background)})`} fill={colors.rejected} />}
              </g>
            </g>
          )}
        </svg>
        {activeStudent && activeCoordinates && (
          <div className="score-boundary-tooltip" role="tooltip">
            <strong>{hovered === 'draft' ? `${activeStudent.id} · ${t.adjusted}` : activeStudent.id}</strong>
            <span className="score-boundary-tooltip-result" style={{ color: getDecision(activeStudent, policy) ? colors.admitted : colors.rejected }}>{getDecision(activeStudent, policy) ? t.admitted : t.rejected}</span>
            <dl>
              <div><dt>{t.academic}</dt><dd>{formatScore(activeCoordinates.academic)}</dd></div>
              <div><dt>{t.background}</dt><dd>{formatScore(activeCoordinates.background)}</dd></div>
              <div className="score-boundary-tooltip-total"><dt>{t.total}</dt><dd>{formatScore(activeCoordinates.total)}</dd></div>
              <div><dt>{t.cutoff}</dt><dd>{formatScore(policy.threshold)}</dd></div>
            </dl>
            {hoveredGroup?.students.length > 1 && <p>{t.overlap.replace('{count}', hoveredGroup.students.length)}</p>}
          </div>
        )}
      </div>
      <div className="score-boundary-caption"><span>{t.equation}</span><span>{t.hint}</span></div>
    </div>
  );
}
