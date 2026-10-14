import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ADMISSION_DOMAINS, getDecision, scoreStudent } from '../shared/admissionModel.js';
import { backgroundScenarios } from '../shared/backgroundScenarios.js';
import './background-scenarios-view.css';

const COPY = {
  en: {
    shortFirstGen: 'First-gen', shortNotFirstGen: 'Not first-gen', shortAthlete: 'Athlete', shortNotAthlete: 'Non-athlete',
    profile: 'Profile', student: 'Student', choose: 'Choose a student', closest: 'Closest to cutoff', others: 'Other students', residency: 'Residency', follow: 'Use profile residency',
    resident: 'In-state', nonresident: 'Out-of-state', firstGen: 'First generation', notFirstGen: 'Not first generation',
    athlete: 'Athlete', notAthlete: 'Not an athlete', original: 'Original', hypothetical: 'Hypothetical', edited: 'Current edit · hypothetical',
    admitted: 'Admitted', rejected: 'Not admitted', points: 'pts', members: 'students in this group',
    originalProfile: 'Original profile', comparing: 'Comparing', originalMark: 'Original student', scenarioMark: 'Hypothetical student',
    outside: 'The original student has a different residency and is outside these four groups.',
    academic: 'This policy gives no background points, so all eight cutoffs are the same.',
    all: 'All admitted in this panel', none: 'None admitted in this panel', empty: 'No original students',
    current: 'matches the editor', clear: 'Clear student selection', background: 'Background points',
  },
  zh: {
    profile: '当前档案', student: '学生', choose: '选择一名学生', closest: '最接近录取线', others: '其他学生', residency: '居住地', follow: '使用当前档案的居住地',
    resident: '州内居民', nonresident: '州外居民', firstGen: '第一代大学生', notFirstGen: '非第一代大学生',
    athlete: '运动员', notAthlete: '非运动员', original: '原始', hypothetical: '假设', edited: '当前修改 · 假设',
    admitted: '录取', rejected: '未录取', points: '分', members: '名原始学生',
    originalProfile: '原始档案', comparing: '正在比较', originalMark: '原始学生', scenarioMark: '假设学生',
    outside: '原始学生的居住地不同，不属于当前四个组。',
    academic: '当前政策没有背景加分，八格的录取线相同。',
    all: '本格全部录取', none: '本格全部未录取', empty: '没有原始学生',
    current: '与右侧编辑器一致', clear: '取消选择学生', background: '背景加分',
  },
  es: {
    profile: 'Perfil', student: 'Estudiante', choose: 'Elige un estudiante', closest: 'Más cerca del corte', others: 'Otros estudiantes', residency: 'Residencia', follow: 'Usar residencia del perfil',
    resident: 'Del estado', nonresident: 'De otro estado', firstGen: 'Primera generación', notFirstGen: 'No primera generación',
    athlete: 'Deportista', notAthlete: 'No deportista', original: 'Original', hypothetical: 'Hipotético', edited: 'Edición actual · hipotética',
    admitted: 'Admitido', rejected: 'No admitido', points: 'pts', members: 'estudiantes del grupo',
    originalProfile: 'Perfil original', comparing: 'Comparación', originalMark: 'Estudiante original', scenarioMark: 'Estudiante hipotético',
    outside: 'El estudiante original tiene otra residencia y no pertenece a estos cuatro grupos.',
    academic: 'Esta política no da puntos de contexto: los ocho cortes son iguales.',
    all: 'Todos admitidos en este panel', none: 'Ninguno admitido en este panel', empty: 'Sin estudiantes originales',
    current: 'coincide con el editor', clear: 'Quitar selección', background: 'Puntos de contexto',
  },
};

const scoreText = value => Number(value.toFixed(2)).toString();

function OutcomeMark({ cx, cy, admitted, color, size = 4, ...rest }) {
  return admitted
    ? <circle cx={cx} cy={cy} r={size} fill={color} {...rest} />
    : <path d={`M ${cx} ${cy - size - 1} L ${cx + size + 1} ${cy} L ${cx} ${cy + size + 1} L ${cx - size - 1} ${cy} Z`} fill={color} {...rest} />;
}

function ScenarioPanel({ panel, policy, selectedStudent, onSelect, colors, t, isMining, edgeCaseIds, isLight }) {
  const plotRef = useRef(null);
  const lensRef = useRef(null);
  const closeTimer = useRef(null);
  const openTimer = useRef(null);
  const [lensStudent, setLensStudent] = useState(null);
  const [lens, setLens] = useState(null);
  const keepLens = () => window.clearTimeout(closeTimer.current);
  const closeLens = () => {
    window.clearTimeout(openTimer.current);
    keepLens();
    closeTimer.current = window.setTimeout(() => setLens(null), 180);
  };
  useEffect(() => {
    const dismiss = () => { window.clearTimeout(openTimer.current); setLens(null); };
    const escape = event => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(openTimer.current);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, []);
  const [{ width, height }, setPlotSize] = useState({ width: 320, height: 164 });
  useEffect(() => {
    const element = plotRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setPlotSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const margin = { left: 36, right: 10, top: 18, bottom: 40 };
  const lensDiameter = Math.max(1, height - margin.top - margin.bottom);
  const lensCenter = lensDiameter / 2;
  const lensZoom = 4;
  const [gpaMin, gpaMax] = ADMISSION_DOMAINS.gpa;
  const [satMin, satMax] = ADMISSION_DOMAINS.sat;
  const x = value => margin.left + (value - gpaMin) / (gpaMax - gpaMin) * Math.max(1, width - margin.left - margin.right);
  const y = value => height - margin.bottom - (value - satMin) / (satMax - satMin) * (height - margin.top - margin.bottom);
  const { scenario, context, boundary } = panel;
  const label = `${context.resident ? t.resident : t.nonresident} · ${context.firstGen ? t.firstGen : t.notFirstGen} · ${context.athlete ? t.athlete : t.notAthlete}`;
  const groups = new Map();
  panel.members.forEach(student => {
    const key = `${student.gpa}:${student.sat}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(student);
  });
  // Keep the selected original and exact overlaps above nearby cohort marks.
  const pointPriority = records => records.some(item => item.id === selectedStudent?.id) ? 2 : records.length > 1 ? 1 : 0;
  const orderedGroups = [...groups].sort(([, left], [, right]) => pointPriority(left) - pointPriority(right));
  const originalHere = panel.members.find(student => student.id === selectedStudent?.id);
  const showComparing = Boolean(scenario?.isDraft && !scenario.isOriginal);
  const scenarioLabel = scenario?.isOriginal ? t.original : scenario?.isDraft ? t.edited : t.hypothetical;
  const changedPosition = originalHere && scenario && (originalHere.gpa !== scenario.student.gpa || originalHere.sat !== scenario.student.sat);
  const openLens = (clientX, clientY) => {
    const rect = plotRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    if (px < margin.left || px > width - margin.right || py < margin.top || py > height - margin.bottom) {
      closeLens();
      return;
    }
    keepLens();
    const nextLens = {
      x: px, y: py,
      left: rect.right + lensDiameter + 8 <= window.innerWidth ? rect.right + 8 : Math.max(8, rect.left - lensDiameter - 8),
      top: Math.max(8, Math.min(window.innerHeight - lensDiameter - 8, rect.top + margin.top)),
    };
    const nearby = [...panel.members, ...(scenario && !scenario.isOriginal ? [scenario.student] : [])]
      .map(student => ({ student, distance: Math.hypot(x(student.gpa) - px, y(student.sat) - py) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const show = () => {
      setLens(nextLens);
      setLensStudent(nearby?.distance <= 12 ? nearby.student : null);
    };
    window.clearTimeout(openTimer.current);
    if (lens) show();
    else openTimer.current = window.setTimeout(show, 650);
  };
  const zoomX = value => lensCenter + (x(value) - lens.x) * lensZoom;
  const zoomY = value => lensCenter + (y(value) - lens.y) * lensZoom;
  return (
    <section className="background-scenario-panel" data-scenario-panel={panel.id}
      data-comparing-group={showComparing} data-original-group={Boolean(originalHere)} data-scenario-score={scenario?.score} data-scenario-original={scenario?.isOriginal ?? false}
      data-scenario-decision={scenario?.admitted ?? ''} aria-label={label}>
      <div className="background-scenario-heading">
        <h3 title={label}><span className="background-scenario-residency">{context.resident ? t.resident : t.nonresident}</span><span>{context.firstGen ? (t.shortFirstGen || t.firstGen) : (t.shortNotFirstGen || t.notFirstGen)}</span><span>{context.athlete ? (t.shortAthlete || t.athlete) : (t.shortNotAthlete || t.notAthlete)}</span></h3>
      </div>
      <div className="background-scenario-plot" ref={plotRef}
        onPointerLeave={closeLens} onPointerEnter={keepLens}>
        <span className="background-scenario-heading-meta">{originalHere && <span className="background-original-badge">{t.original}</span>}{showComparing && <span className="background-comparing-badge">{t.comparing}</span>}</span>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${label}, GPA × SAT Percentile`}
          onPointerMove={event => { if (event.pointerType === 'mouse' && !event.buttons) openLens(event.clientX, event.clientY); }}
          onFocusCapture={event => {
            const point = event.target.closest('[data-scenario-student]');
            const circle = point?.querySelector('circle');
            if (circle) {
              const rect = circle.getBoundingClientRect();
              openLens(rect.x + rect.width / 2, rect.y + rect.height / 2);
            }
          }}
          onBlurCapture={event => { if (!lensRef.current?.contains(event.relatedTarget)) closeLens(); }}>
          <rect x={margin.left} y={margin.top} width={Math.max(1, width - margin.left - margin.right)} height={height - margin.top - margin.bottom} className="background-scenario-frame" />
          {panel.admittedPolygon.length > 2 && <polygon className="background-scenario-region" points={panel.admittedPolygon.map(point => `${x(point.x)},${y(point.y)}`).join(' ')} />}
          {[gpaMin, 3.3, gpaMax].map(value => <g key={`gpa-${value}`} aria-hidden="true">
            <line className="background-scenario-gridline" x1={x(value)} x2={x(value)} y1={margin.top} y2={height - margin.bottom} />
            <text x={x(value)} y={height - margin.bottom + 23} textAnchor={value === gpaMin ? 'start' : value === gpaMax ? 'end' : 'middle'}>{value.toFixed(1)}</text>
          </g>)}
          {[satMin, 80, satMax].map(value => <g key={`sat-${value}`} aria-hidden="true">
            <line className="background-scenario-gridline" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} />
            <text x={margin.left - 4} y={y(value) + 3} textAnchor="end">{value}</text>
          </g>)}
          <text x={(margin.left + width - margin.right) / 2} y={height - 2} textAnchor="middle" className="background-scenario-axis">GPA</text>
          <text x={width - margin.right} y={height - 2} textAnchor="end" className="background-scenario-count"><title>{`${panel.members.length} ${t.members}`}</title>n={panel.members.length}</text>
          <text transform={`translate(9 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="background-scenario-axis">SAT Percentile</text>
          {boundary.points.length > 1 && <line className="background-scenario-boundary" x1={x(boundary.points[0].x)} y1={y(boundary.points[0].y)} x2={x(boundary.points[1].x)} y2={y(boundary.points[1].y)} />}
          {boundary.points.length === 1 && <circle cx={x(boundary.points[0].x)} cy={y(boundary.points[0].y)} r={2.5} className="background-scenario-tangent" />}
          {changedPosition && <line className="background-scenario-connector" x1={x(originalHere.gpa)} y1={y(originalHere.sat)} x2={x(scenario.student.gpa)} y2={y(scenario.student.sat)} />}
          {orderedGroups.map(([key, records]) => {
            const student = records.find(item => item.id === selectedStudent?.id) || records[0];
            const selected = records.some(item => item.id === selectedStudent?.id);
            const edge = records.some(item => edgeCaseIds?.has(item.id));
            const admitted = getDecision(student, policy);
            const description = `${t.student} ${records.map(item => item.id).join(', ')} · GPA ${student.gpa} · SAT Percentile ${student.sat} · ${admitted ? t.admitted : t.rejected}`;
            const select = () => {
              if (records.length === 1 && selected) return;
              const current = records.findIndex(item => item.id === selectedStudent?.id);
              onSelect(records[(current + 1) % records.length].id);
            };
            return <g key={key} role="button" tabIndex={0} aria-label={description} aria-pressed={selected}
              data-scenario-student={student.id} className="background-scenario-student"
              onClick={event => { event.stopPropagation(); select(); }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }}>
              <circle cx={x(student.gpa)} cy={y(student.sat)} r={12} fill="transparent" className="background-scenario-focus" />
              {selected && <circle cx={x(student.gpa)} cy={y(student.sat)} r={8} className="background-scenario-original" />}
              <OutcomeMark cx={x(student.gpa)} cy={y(student.sat)} admitted={admitted} color={admitted ? colors.admitted : colors.rejected}
                opacity={selected ? 1 : isMining ? edge ? 1 : 0.18 : selectedStudent ? 0.4 : 0.75} size={selected ? 4.5 : 3.2}
                stroke={isMining && edge ? 'var(--workspace-edge)' : 'none'} strokeWidth={1.5} />
            </g>;
          })}
          {scenario && !scenario.isOriginal && <g className={`background-scenario-hypothetical${showComparing ? ' is-comparing' : ''}`} data-scenario-hypothetical
            onClick={event => event.stopPropagation()}
            aria-label={`${t.hypothetical}: GPA ${scenario.student.gpa}, SAT Percentile ${scenario.student.sat}, ${scoreText(scenario.score)} ${t.points}, ${scenario.admitted ? t.admitted : t.rejected}`}>
            {showComparing && <circle cx={x(scenario.student.gpa)} cy={y(scenario.student.sat)} r={14} className="background-scenario-comparing-halo" />}
            <circle cx={x(scenario.student.gpa)} cy={y(scenario.student.sat)} r={12} fill="transparent" />
            <circle cx={x(scenario.student.gpa)} cy={y(scenario.student.sat)} r={9.5} className="background-scenario-hypothetical-ring" />
            <OutcomeMark cx={x(scenario.student.gpa)} cy={y(scenario.student.sat)} admitted={scenario.admitted} color={scenario.admitted ? colors.admitted : colors.rejected} size={showComparing ? 5.5 : 4.5} />
          </g>}
          {!panel.members.length && !scenario && <text x={(margin.left + width - margin.right) / 2} y={78} textAnchor="middle">{t.empty}</text>}
          {lens && <circle cx={lens.x} cy={lens.y} r={lensCenter / lensZoom} className="background-lens-source" />}
        </svg>
      </div>
      {lens && createPortal(
        <div ref={lensRef} className="background-detail-lens" data-scenario-lens={panel.id}
          style={{ left: lens.left, top: lens.top, width: lensDiameter, height: lensDiameter, background: isLight ? 'rgba(255, 255, 255, .88)' : 'rgba(27, 31, 39, .88)', color: isLight ? '#334155' : '#e2e8f0' }} role="group" aria-label={`${label} · 4×`}
          onPointerEnter={keepLens} onPointerLeave={closeLens} onFocusCapture={keepLens}
          onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) closeLens(); }}
          onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
          <svg viewBox={`0 0 ${lensDiameter} ${lensDiameter}`} width={lensDiameter} height={lensDiameter} aria-label={`${label} · 4×`}>
            {panel.admittedPolygon.length > 2 && <polygon points={panel.admittedPolygon.map(p => `${zoomX(p.x)},${zoomY(p.y)}`).join(' ')} fill={colors.admitted} opacity=".07" />}
            {boundary.points.length > 1 && <line x1={zoomX(boundary.points[0].x)} y1={zoomY(boundary.points[0].y)} x2={zoomX(boundary.points[1].x)} y2={zoomY(boundary.points[1].y)} stroke="#3b82f6" strokeWidth="1.5" />}
            {orderedGroups.map(([key, records]) => {
              const student = records.find(item => item.id === selectedStudent?.id) || records[0];
              const cx = zoomX(student.gpa);
              const cy = zoomY(student.sat);
              if (Math.hypot(cx - lensCenter, cy - lensCenter) > lensCenter - 9) return null;
              const admitted = getDecision(student, policy);
              const selected = records.some(item => item.id === selectedStudent?.id);
              const description = `${t.student} ${records.map(item => item.id).join(', ')} · GPA ${student.gpa} · SAT Percentile ${student.sat} · ${admitted ? t.admitted : t.rejected}`;
              const choose = event => {
                let candidates = records;
                if (event?.detail > 0) {
                  const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
                  const px = (event.clientX - rect.left) * lensDiameter / rect.width;
                  const py = (event.clientY - rect.top) * lensDiameter / rect.height;
                  // Overlapping hit areas must select the closest visible point,
                  // not whichever SVG group happens to be painted last.
                  candidates = orderedGroups.filter(([, items]) => Math.hypot(zoomX(items[0].gpa) - lensCenter, zoomY(items[0].sat) - lensCenter) <= lensCenter - 9)
                    .sort(([, a], [, b]) => Math.hypot(zoomX(a[0].gpa) - px, zoomY(a[0].sat) - py) - Math.hypot(zoomX(b[0].gpa) - px, zoomY(b[0].sat) - py))[0]?.[1] || records;
                }
                const current = candidates.findIndex(item => item.id === selectedStudent?.id);
                onSelect(candidates[(current + 1) % candidates.length].id);
              };
              return <g key={key} role="button" tabIndex={0} aria-label={description} aria-pressed={selected}
                className="background-lens-point" onClick={choose}
                onPointerEnter={() => setLensStudent(student)} onFocus={() => setLensStudent(student)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }}>
                <circle cx={cx} cy={cy} r={8} fill="transparent" className="background-lens-hit" />
                {selected && <circle cx={cx} cy={cy} r={7} fill={isLight ? '#fff' : '#1b1f27'} stroke="#2563eb" strokeWidth={2} />}
                <OutcomeMark cx={cx} cy={cy} admitted={admitted} color={admitted ? colors.admitted : colors.rejected} size={4.5} />
              </g>;
            })}
            {scenario && !scenario.isOriginal && Math.hypot(zoomX(scenario.student.gpa) - lensCenter, zoomY(scenario.student.sat) - lensCenter) <= lensCenter - 12 && <g pointerEvents="none">
              <circle cx={zoomX(scenario.student.gpa)} cy={zoomY(scenario.student.sat)} r={9} fill={isLight ? '#fff' : '#1b1f27'} stroke="#8b5cf6" strokeWidth={showComparing ? 3 : 2} strokeDasharray={showComparing ? undefined : '3 2'} />
              <OutcomeMark cx={zoomX(scenario.student.gpa)} cy={zoomY(scenario.student.sat)} admitted={scenario.admitted} color={scenario.admitted ? colors.admitted : colors.rejected} size={4.5} />
            </g>}
            <path transform={`translate(${lensCenter} ${lensCenter})`} d="M 0 -12 V -4 M 0 4 V 12 M -12 0 H -4 M 4 0 H 12" className="background-lens-crosshair" aria-hidden="true" />
          </svg>
          {lensStudent && <div className="background-lens-info" style={{ background: isLight ? 'rgba(255,255,255,.92)' : 'rgba(27,31,39,.92)' }}>
            <span><strong>{lensStudent.id}</strong> · <span style={{ color: getDecision(lensStudent, policy) ? colors.admitted : colors.rejected }}>{getDecision(lensStudent, policy) ? t.admitted : t.rejected}</span></span>
            <span>GPA {scoreText(lensStudent.gpa)} · SAT {lensStudent.sat}</span>
          </div>}
        </div>, document.body)}
      <div className="sr-only" aria-live="polite">
        {scenario ? <>
          <span className={scenario.isOriginal ? 'is-original' : 'is-hypothetical'}>{scenarioLabel}</span>
          <strong>{scoreText(scenario.score)} {t.points} · {scenario.admitted ? t.admitted : t.rejected}</strong>
        </> : null}
      </div>
    </section>
  );
}

export default function BackgroundScenariosView({
  students, policy, selectedStudent, draftStudent, onSelect, isLight, colors, lang,
  isMining, edgeCaseIds,
}) {
  const t = COPY[lang] || COPY.en;
  const activeProfile = draftStudent || selectedStudent;
  const profileValueChanged = (profile, kind, field) => {
    if (kind !== 'hypothetical' || !profile || !selectedStudent) return false;
    if (field === 'score') return Math.abs(scoreStudent(profile, policy) - scoreStudent(selectedStudent, policy)) > 1e-9;
    if (field === 'decision') return getDecision(profile, policy) !== getDecision(selectedStudent, policy);
    return profile[field] !== selectedStudent[field];
  };
  const panels = useMemo(() => backgroundScenarios({ students, policy, selectedStudent, draftStudent }),
    [students, policy, selectedStudent, draftStudent]);
  const edgeIds = edgeCaseIds instanceof Set ? edgeCaseIds : new Set(edgeCaseIds || []);
  const studentOption = student => <option key={student.id} value={student.id}>
    {student.id} · GPA {student.gpa} · SAT Percentile {student.sat} · {student.firstGen ? t.firstGen : t.notFirstGen} · {student.athlete ? t.athlete : t.notAthlete} · {student.resident ? t.resident : t.nonresident}
  </option>;
  const closestStudents = students.filter(student => edgeIds.has(student.id)).sort((a, b) =>
    Math.abs(scoreStudent(a, policy) - policy.threshold) - Math.abs(scoreStudent(b, policy) - policy.threshold));
  return (
    <div className={`background-scenarios-view${isLight ? ' background-scenarios-light' : ''}`} data-boundary-ui data-background-scenarios
      onPointerDown={event => event.stopPropagation()}>
      <div className="background-scenarios-toolbar">
        <label>
          <select aria-label={t.student} value={selectedStudent?.id || ''} onChange={event => onSelect(event.target.value || null)}>
            <option value="">{t.choose}</option>
            {isMining ? <>
              <optgroup label={t.closest}>{closestStudents.map(studentOption)}</optgroup>
              <optgroup label={t.others}>{students.filter(student => !edgeIds.has(student.id)).map(studentOption)}</optgroup>
            </> : students.map(studentOption)}
          </select>
        </label>

      </div>
      <div className="background-scenarios-profile" role="table" aria-label={t.comparing}>
        {[[t.originalProfile, selectedStudent, 'original'], [t.comparing, activeProfile, 'hypothetical']].map(([name, profile, kind]) => (
          <div className="background-profile-row" role="row" key={kind}>
            <span className="background-profile-heading" role="rowheader"><span className={`background-scenarios-${kind}-key`} /><strong>{name}</strong></span>
            <span role="cell">{profile?.id}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'gpa')}>{profile && `GPA ${profile.gpa.toFixed(2)}`}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'sat')}>{profile && `SAT Percentile ${profile.sat}`}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'resident')}>{profile && (profile.resident ? t.resident : t.nonresident)}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'firstGen')}>{profile && (profile.firstGen ? (t.shortFirstGen || t.firstGen) : (t.shortNotFirstGen || t.notFirstGen))}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'athlete')}>{profile && (profile.athlete ? (t.shortAthlete || t.athlete) : (t.shortNotAthlete || t.notAthlete))}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'score')}>{profile && `${scoreStudent(profile, policy).toFixed(2)} ${t.points}`}</span>
            <span role="cell" data-changed={profileValueChanged(profile, kind, 'decision')}>{profile && (getDecision(profile, policy) ? t.admitted : t.rejected)}</span>
          </div>
        ))}
      </div>
      <div className="background-scenarios-grid">
        {panels.map(panel => <ScenarioPanel key={panel.id} panel={panel} policy={policy} selectedStudent={selectedStudent}
          onSelect={onSelect} colors={colors} t={t} isMining={isMining} edgeCaseIds={edgeCaseIds} isLight={isLight} />)}
      </div>

    </div>
  );
}
