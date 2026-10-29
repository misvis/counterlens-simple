import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ADMISSION_DOMAINS, getDecision } from '../shared/admissionModel.js';
import { EXPLORER_FEATURES, getExplorerOptions, normalizeExplorerLayout, buildExplorerGroups, buildExplorerProfilePair, recordMatchesExplorerContext } from '../shared/featureExplorer.js';
import { ExplorerPointLens } from './ExplorerPointLens.jsx';
import { ExplorerDropdown } from './ExplorerDropdown.jsx';
import { cutoffMatchesContext, getExplorerCutoff } from './explorerCutoff.js';
import useExplorerDrag from './useExplorerDrag.js';
import './feature-explorer-matrix.css';

const ROW_LABEL_MAX_WIDTH = 102;
const MATRIX_COLUMN_GAP = 6;

const COPY = {
  en: { columns: 'Columns', rows: 'Rows', sections: 'Sections', add: 'Add sections', none: 'None', all: 'All', clear: 'Clear', search: 'Search values', values: 'values', bins: 'Income bins', fixed: 'Fixed intervals', quantile: 'Quantiles', custom: 'Custom', count: 'Bins', cutPoints: 'Cut points ($)', apply: 'Apply', invalid: 'Enter increasing, positive amounts separated by commas.', student: 'Student', choose: 'Choose a student', profile: 'Background', empty: 'No students', missingCoordinates: 'Missing coordinates', noValues: 'Select at least one value.', original: 'Original', hypothetical: 'Hypothetical', admitted: 'Admitted', rejected: 'Not admitted', currentCutoff: 'Current cutoff', plots: 'plots', missing: 'Unknown', allStudents: 'All students', closest: 'Closest to cutoff' },
  zh: { columns: '列', rows: '行', sections: '分区', add: '添加分区', none: '无', all: '全部', clear: '清空', search: '搜索类别', values: '类', bins: '收入分箱', fixed: '固定区间', quantile: '分位数', custom: '自定义', count: '区间数', cutPoints: '分界值（美元）', apply: '应用', invalid: '请输入递增的正数金额，用逗号分隔。', student: '学生', choose: '选择学生', profile: '背景', empty: '无学生', missingCoordinates: '缺少坐标数据', noValues: '请至少选择一个类别。', original: '原始', hypothetical: '假设', admitted: '录取', rejected: '未录取', currentCutoff: '当前录取线', plots: '张图', missing: '未知', allStudents: '全部学生', closest: '最接近录取线' },
  es: { columns: 'Columnas', rows: 'Filas', sections: 'Secciones', add: 'Añadir secciones', none: 'Ninguno', all: 'Todos', clear: 'Vaciar', search: 'Buscar categorías', values: 'valores', bins: 'Intervalos de ingresos', fixed: 'Intervalos fijos', quantile: 'Cuantiles', custom: 'Personalizados', count: 'Intervalos', cutPoints: 'Límites ($)', apply: 'Aplicar', invalid: 'Introduce importes positivos en orden creciente, separados por comas.', student: 'Estudiante', choose: 'Elige un estudiante', profile: 'Contexto', empty: 'Sin estudiantes', missingCoordinates: 'Sin coordenadas', noValues: 'Selecciona al menos un valor.', original: 'Original', hypothetical: 'Hipotético', admitted: 'Admitido', rejected: 'No admitido', currentCutoff: 'Corte actual', plots: 'gráficos', missing: 'Desconocido', allStudents: 'Todos los estudiantes', closest: 'Más cerca del corte' },
};
const PAIR_COPY = {
  en: { original: 'Show original', draft: 'Show hypothetical', hidden: 'Other group is filtered out' },
  zh: { original: '定位原始点', draft: '定位假设点', hidden: '另一分组已被筛选隐藏' },
  es: { original: 'Ver original', draft: 'Ver hipotético', hidden: 'El otro grupo está oculto por el filtro' },
};
const RESET_COPY = {
  en: { label: 'Reset', accessible: 'Reset visualizer' },
  zh: { label: '重置', accessible: '重置可视化视图' },
  es: { label: 'Restablecer', accessible: 'Restablecer visualizador' },
};
const SHARED_CUTOFF_COPY = {
  en: 'Shared cutoff · Applies to all students (GPA and SAT only)',
  zh: '统一录取边界 · 适用于所有学生（仅考虑 GPA 和 SAT）',
  es: 'Corte común · Se aplica a todos los estudiantes (solo GPA y SAT)',
};
const DRAG_COPY = {
  en: { cutoff: 'Drag to adjust the admission threshold. Arrow keys also adjust it; Escape cancels a drag.', student: 'Drag to edit GPA and SAT. Escape cancels a drag.' },
  zh: { cutoff: '拖动以调整录取阈值，也可用方向键调整；Esc 取消拖动。', student: '拖动以修改 GPA 和 SAT；Esc 取消拖动。' },
  es: { cutoff: 'Arrastra para ajustar el umbral. También puedes usar las flechas; Escape cancela el arrastre.', student: 'Arrastra para editar GPA y SAT. Escape cancela el arrastre.' },
};
const label = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
const featureFor = key => EXPLORER_FEATURES.find(feature => feature.key === key);
const featureLabel = (key, lang) => label(featureFor(key)?.label, lang);
const formatValue = (value, key) => key === 'gpa' ? Number(value.toFixed(2)).toString() : String(Math.round(value));
const ticks = domain => Array.from({ length: 4 }, (_, index) => domain[0] + (domain[1] - domain[0]) * index / 3);
const contextLabel = (context, lang) => EXPLORER_FEATURES.flatMap(feature => {
  const entry = context.find(item => item.key === feature.key);
  return entry ? [`${featureLabel(feature.key, lang)}: ${label(entry.option.label, lang)}`] : [];
}).join(' · ');
const PROFILE_FIELDS = ['gpa', 'sat', ...EXPLORER_FEATURES.map(feature => feature.key)];
const profilesDiffer = (original, edited) => Boolean(original && edited && PROFILE_FIELDS.some(key => !Object.is(original[key], edited[key])));
const profileValueLabel = (student, key, options, lang, t) => {
  const value = student?.[key];
  if (key === 'zipIncome' && typeof value === 'number' && Number.isFinite(value)) return `$${value.toLocaleString()}`;
  const missing = value === null || value === undefined || (typeof value === 'string' && !value.trim())
    || (typeof value === 'number' && !Number.isFinite(value)) || !['string', 'number', 'boolean'].includes(typeof value);
  const matched = options.find(option => option.missing ? missing
    : Object.hasOwn(option, 'rawValue') ? Object.is(option.rawValue, value) : option.value === value);
  return label(matched?.label, lang) || t.missing;
};

function ValuePicker({ feature, options, selected, onChange, binning, onBinningChange, lang, t }) {
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState(() => (binning.thresholds || [50000, 75000, 100000]).join(', '));
  const [invalid, setInvalid] = useState(false);
  const chosen = selected ?? options.map(option => option.value);
  const all = options.length > 0 && options.every(option => chosen.includes(option.value));
  const filtered = options.filter(option => label(option.label, lang).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const applyCuts = () => {
    const pieces = customInput.split(/[,，]/).map(piece => piece.trim());
    const thresholds = pieces.map(Number);
    if (!pieces.length || pieces.some(piece => !piece) || thresholds.some((value, index) => !Number.isFinite(value) || value <= 0 || (index && value <= thresholds[index - 1]))) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setCustomInput(thresholds.join(', '));
    onBinningChange({ ...binning, method: 'custom', thresholds });
  };
  return <ExplorerDropdown featureKey={feature.key} label={<>{label(feature.label, lang)}<span className="fex-picker-selection">{all ? t.all : `${chosen.length} ${t.values}`}</span></>}>
      {feature.key === 'zipIncome' && <div className="fex-binning">
        <label>{t.bins}<select aria-label={t.bins} value={binning.method} onChange={event => {
          setInvalid(false);
          if (event.target.value === 'custom') {
            onBinningChange({ ...binning, method: 'custom', thresholds: binning.thresholds || [50000, 75000, 100000] });
          } else onBinningChange({ ...binning, method: event.target.value });
        }}>
          <option value="fixed">{t.fixed}</option><option value="quantile">{t.quantile}</option><option value="custom">{t.custom}</option>
        </select></label>
        {binning.method !== 'custom' ? <label>{t.count}<select aria-label={t.count} value={binning.count} onChange={event => onBinningChange({ ...binning, count: Number(event.target.value) })}>
          {[3, 4, 5, 6].map(count => <option key={count} value={count}>{count}</option>)}
        </select></label> : <div className="fex-custom-bins">
          <label>{t.cutPoints}<input aria-label={t.cutPoints} value={customInput} onChange={event => { setCustomInput(event.target.value); setInvalid(false); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyCuts(); } }} /></label>
          <button type="button" onClick={applyCuts}>{t.apply}</button>
        </div>}
        {invalid && <span className="fex-error" role="alert">{t.invalid}</span>}
      </div>}
      {options.length > 4 && <input type="search" className="fex-value-search" aria-label={`${t.search}: ${label(feature.label, lang)}`} placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)} />}
      <div className="fex-value-actions"><button type="button" onClick={() => onChange(undefined)}>{t.all}</button><button type="button" onClick={() => onChange([])}>{t.clear}</button></div>
      <div className="fex-value-options">{filtered.map(option => <label key={option.value}>
        <input type="checkbox" checked={chosen.includes(option.value)} onChange={event => onChange(event.target.checked ? [...chosen, option.value] : chosen.filter(value => value !== option.value))} />
        <span>{label(option.label, lang)}</span>
      </label>)}</div>
  </ExplorerDropdown>;
}

function OutcomeMark({ admitted, cx, cy, color, size = 4 }) {
  return admitted ? <circle cx={cx} cy={cy} r={size} fill={color} /> : <path d={`M${cx},${cy - size - 1} L${cx + size + 1},${cy} L${cx},${cy + size + 1} L${cx - size - 1},${cy} Z`} fill={color} />;
}

function ExplorerPlot({ panel, width: requestedWidth, fillHeight, domains, policy, colors, selectedStudent, draftStudent, onSelect, onEdit, onThresholdChange, onRestoreSelection, contextKey, isLight, edgeIds, isMining, lang, t, descriptions, currentCutoff, pairRole, peerPanel, registerPair, navigatePair }) {
  const plotElement = useRef(null);
  const svgElement = useRef(null);
  const [plotSize, setPlotSize] = useState({ width: 0, height: 340 });
  useEffect(() => {
    if (!fillHeight || !plotElement.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width), height = Math.floor(entry.contentRect.height);
      if (width <= 0 || height <= 0) return;
      setPlotSize(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(plotElement.current);
    return () => observer.disconnect();
  }, [fillHeight]);
  const width = fillHeight && plotSize.width ? plotSize.width : requestedWidth;
  const height = fillHeight ? plotSize.height : 220;
  const margin = { left: 43, right: 16, top: 22, bottom: 42 };
  const { dragKind, dragHandlers } = useExplorerDrag({
    svgRef: svgElement, width, height, margin, domains, policy, students: panel.members,
    selectedStudent, draftStudent, onSelect, onEdit, onThresholdChange, onRestoreSelection,
    contextKey: `${contextKey}:${policy.id}:${panel.id}`,
  });
  const dragCopy = DRAG_COPY[lang] || DRAG_COPY.en;
  const x = value => margin.left + (value - domains.gpa[0]) / (domains.gpa[1] - domains.gpa[0]) * (width - margin.left - margin.right);
  const y = value => height - margin.bottom - (value - domains.sat[0]) / (domains.sat[1] - domains.sat[0]) * (height - margin.top - margin.bottom);
  const originalHere = selectedStudent && panel.members.some(student => student.id === selectedStudent.id);
  const draftChanged = profilesDiffer(selectedStudent, draftStudent);
  const draftHere = draftChanged && recordMatchesExplorerContext(draftStudent, panel.context);
  const finite = student => Number.isFinite(student?.gpa) && Number.isFinite(student?.sat);
  const visibleMembers = panel.members.filter(finite);
  const showDraft = draftHere && finite(draftStudent);
  const draftX = showDraft ? x(draftStudent.gpa) : 0;
  const draftY = showDraft ? y(draftStudent.sat) : 0;
  const draftMoved = showDraft && originalHere && finite(selectedStudent)
    && (draftStudent.gpa !== selectedStudent.gpa || draftStudent.sat !== selectedStudent.sat);
  const draftAdmitted = showDraft && getDecision(draftStudent, policy);
  const title = contextLabel(panel.context, lang) || t.allStudents;
  const boundary = cutoffMatchesContext(currentCutoff, panel.context) ? currentCutoff.boundary : null;
  const peerRole = pairRole === 'original' ? 'draft' : 'original';
  const pairCopy = PAIR_COPY[lang] || PAIR_COPY.en;
  const pairTitle = pairRole ? `${pairRole === 'original' ? t.original : t.hypothetical}: ${selectedStudent.id} · ${peerPanel ? `${pairCopy[peerRole]} · ${contextLabel(peerPanel.context, lang)}` : pairCopy.hidden}` : '';
  return <div ref={plotElement} className="fex-plot" data-explorer-panel={panel.id} data-original-group={Boolean(originalHere)} data-pair-role={pairRole || undefined} data-dragging={dragKind || undefined} {...dragHandlers}>
    <svg ref={svgElement} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title}>
      <title>{title}</title>
      <rect className="fex-frame" x={margin.left} y={margin.top} width={width - margin.left - margin.right} height={height - margin.top - margin.bottom} />
      {ticks(domains.gpa).map((value, index) => <g key={`x-${index}`}><line className="fex-gridline" x1={x(value)} x2={x(value)} y1={margin.top} y2={height - margin.bottom} /><text x={x(value)} y={height - margin.bottom + 16} textAnchor="middle">{formatValue(value, 'gpa')}</text></g>)}
      {ticks(domains.sat).map((value, index) => <g key={`y-${index}`}><line className="fex-gridline" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} /><text x={margin.left - 6} y={y(value) + 4} textAnchor="end">{formatValue(value, 'sat')}</text></g>)}
      {boundary?.points.length > 1 && <line className="fex-current-cutoff" data-cutoff-scope={currentCutoff.scope}
        data-profile-cutoff={currentCutoff.scope === 'profile' ? 'current' : undefined}
        data-policy-cutoff={currentCutoff.scope === 'all' ? 'academic' : undefined} aria-label={currentCutoff.description}
        data-cutoff-income={currentCutoff.scope === 'profile' ? (Number.isFinite(currentCutoff.profile.zipIncome) ? currentCutoff.profile.zipIncome : 'missing') : undefined}
        data-cutoff-background-score={currentCutoff.score}
        x1={x(boundary.points[0].x)} y1={y(boundary.points[0].y)} x2={x(boundary.points[1].x)} y2={y(boundary.points[1].y)}>
        <title>{currentCutoff.description}</title>
      </line>}
      {boundary?.points.length > 1 && onThresholdChange && <g className="fex-cutoff-control" data-cutoff-drag role="slider" tabIndex={0}
        aria-label={`${currentCutoff.description}. ${dragCopy.cutoff}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={policy.threshold}
        onClick={event => event.stopPropagation()} onKeyDown={event => {
          const delta = event.shiftKey ? 10 : 1;
          const next = { ArrowRight: policy.threshold + delta, ArrowUp: policy.threshold + delta,
            ArrowLeft: policy.threshold - delta, ArrowDown: policy.threshold - delta, Home: 0, End: 100 }[event.key];
          if (next === undefined) return;
          event.preventDefault(); event.stopPropagation();
          onThresholdChange(Math.max(0, Math.min(100, next)));
        }}>
        <title>{`${currentCutoff.description}. ${dragCopy.cutoff}`}</title>
        <line className="fex-cutoff-hit" x1={x(boundary.points[0].x)} y1={y(boundary.points[0].y)} x2={x(boundary.points[1].x)} y2={y(boundary.points[1].y)} />
      </g>}
      <text className="fex-axis" x={(margin.left + width - margin.right) / 2} y={height - 5} textAnchor="middle">GPA</text>
      <text className="fex-axis" transform={`translate(12 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle">SAT Percentile</text>
      <text className="fex-member-count" x={width - margin.right} y={13} textAnchor="end">n={panel.members.length}</text>
      {draftMoved && <line className="fex-draft-connector" x1={x(selectedStudent.gpa)} y1={y(selectedStudent.sat)} x2={draftX} y2={draftY} />}
      {visibleMembers.map(student => {
        const admitted = getDecision(student, policy), cx = x(student.gpa), cy = y(student.sat);
        return <g key={student.id} role="button" tabIndex={0} className="fex-student" data-explorer-student={student.id} aria-pressed={student.id === selectedStudent?.id}
          aria-label={`${student.id === selectedStudent?.id ? `${t.original}: ` : ''}${descriptions.get(student.id)}`} opacity={isMining && !edgeIds.has(student.id) && student.id !== selectedStudent?.id ? .3 : 1}>
          <title>{`${descriptions.get(student.id)}. ${dragCopy.student}`}</title>
          <circle className="fex-hit" cx={cx} cy={cy} r={11} />
          {isMining && edgeIds.has(student.id) && <circle className="fex-edge-case" cx={cx} cy={cy} r={8} />}
          {student.id === selectedStudent?.id && <circle className="fex-original-ring" cx={cx} cy={cy} r={8} />}
          <OutcomeMark admitted={admitted} cx={cx} cy={cy} color={admitted ? colors.admitted : colors.rejected} />
        </g>;
      })}
      {showDraft && <g className="fex-draft" data-draft-student={draftStudent.id} role="img" aria-label={`${t.hypothetical}: ${draftStudent.id}, GPA ${draftStudent.gpa}, SAT Percentile ${draftStudent.sat}`}>
        <title>{`${t.hypothetical}: ${draftStudent.id}. ${dragCopy.student}`}</title>
        <circle className="fex-draft-hit" cx={draftX} cy={draftY} r={12} />
        <circle className="fex-draft-ring" cx={draftX} cy={draftY} r={11} />
        <OutcomeMark admitted={draftAdmitted} cx={draftX} cy={draftY} color={draftAdmitted ? colors.admitted : colors.rejected} size={4.5} />
      </g>}
      {!panel.members.length && <text className="fex-empty-panel" x={(margin.left + width - margin.right) / 2} y={(margin.top + height - margin.bottom) / 2} textAnchor="middle">{t.empty}</text>}
      {!!panel.members.length && !visibleMembers.length && <text className="fex-empty-panel" x={(margin.left + width - margin.right) / 2} y={(margin.top + height - margin.bottom) / 2} textAnchor="middle">{t.missingCoordinates}</text>}
    </svg>
    {pairRole && <button type="button" className={`fex-pair-link fex-pair-${pairRole}`} data-profile-pair={pairRole}
      ref={element => registerPair(pairRole, element)} disabled={!peerPanel} aria-label={pairTitle} title={pairTitle}
      onClick={event => { event.stopPropagation(); navigatePair(peerRole); }}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" /></svg>
      <span>{selectedStudent.id}</span>{peerPanel && <span className="fex-pair-arrow" aria-hidden="true">↔</span>}
    </button>}
    <ExplorerPointLens svgRef={svgElement} panelId={panel.id} panelLabel={title} records={panel.members}
      width={width} height={height} margin={margin} domains={domains} boundary={boundary}
      selectedStudentId={selectedStudent?.id} policy={policy} colors={colors} isLight={isLight} lang={lang} onSelect={onSelect} disabled={Boolean(dragKind)} />
  </div>;
}

export function ExplorerStudentSelect({ students, selectedStudent, onSelect, isMining, edgeCaseIds, lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  const edgeIds = useMemo(() => edgeCaseIds instanceof Set ? edgeCaseIds : new Set(edgeCaseIds || []), [edgeCaseIds]);
  const studentChoices = useMemo(() => {
    if (!isMining) return students;
    const recordsById = new Map(students.map(student => [student.id, student]));
    return [
      ...Array.from(edgeIds, id => recordsById.get(id)).filter(Boolean),
      ...students.filter(student => !edgeIds.has(student.id)),
    ];
  }, [students, edgeIds, isMining]);
  return <select className="workspace-student-select" aria-label={t.student} value={selectedStudent?.id || ''} onChange={event => onSelect(event.target.value || null)}>
    <option value="">{t.choose}</option>
    {studentChoices.map(student => <option key={student.id} value={student.id}>{student.id} · GPA {student.gpa} · SAT {student.sat}{isMining && edgeIds.has(student.id) ? ` · ${t.closest}` : ''}</option>)}
  </select>;
}

export default function FeatureExplorer({ students, policy, selectedStudent, draftStudent, onSelect, onEdit, onThresholdChange, onRestoreSelection, contextKey, isLight, colors, lang = 'en', isMining, edgeCaseIds, binning, onBinningChange, incomeBins }) {
  const t = COPY[lang] || COPY.en;
  const resetCopy = RESET_COPY[lang] || RESET_COPY.en;
  const [layout, setLayout] = useState({ columns: '', rows: '', sections: [] });
  const [selectedValues, setSelectedValues] = useState({});
  const [resetVersion, setResetVersion] = useState(0);
  const viewport = useRef(null);
  const rowLabelMeasure = useRef(null);
  const pairButtons = useRef({});
  const [availableWidth, setAvailableWidth] = useState(800);
  const [rowLabelWidth, setRowLabelWidth] = useState(ROW_LABEL_MAX_WIDTH);
  const options = useMemo(() => Object.fromEntries(EXPLORER_FEATURES.map(feature => [feature.key, getExplorerOptions(feature.key, students, incomeBins)])), [students, incomeBins]);
  const groups = useMemo(() => buildExplorerGroups({ records: students, layout, incomeBins, selectedValues }), [students, layout, incomeBins, selectedValues]);
  const profilePair = useMemo(() => buildExplorerProfilePair(groups, selectedStudent, draftStudent), [groups, selectedStudent, draftStudent]);
  const activeKeys = EXPLORER_FEATURES.map(feature => feature.key)
    .filter(key => key === layout.rows || key === layout.columns || layout.sections.includes(key));
  const rowGutter = layout.rows ? rowLabelWidth + MATRIX_COLUMN_GAP : 0;
  useLayoutEffect(() => {
    if (!layout.rows || !rowLabelMeasure.current) return;
    const widths = Array.from(rowLabelMeasure.current.children, element => element.getBoundingClientRect().width);
    setRowLabelWidth(Math.min(ROW_LABEL_MAX_WIDTH, Math.ceil(Math.max(0, ...widths)) + 4));
  }, [groups.rows, layout.rows, lang]);
  const edgeIds = useMemo(() => edgeCaseIds instanceof Set ? edgeCaseIds : new Set(edgeCaseIds || []), [edgeCaseIds]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setAvailableWidth(entry.contentRect.width); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const domains = useMemo(() => Object.fromEntries(['gpa', 'sat'].map(key => {
      const values = students.map(student => student[key]).filter(Number.isFinite);
      return [key, [Math.min(ADMISSION_DOMAINS[key][0], ...values), Math.max(ADMISSION_DOMAINS[key][1], ...values)]];
    })), [students]);
  const profile = selectedStudent ? draftStudent || selectedStudent : null;
  const currentCutoff = useMemo(() => {
    const cutoff = getExplorerCutoff(policy, profile);
    if (!cutoff) return null;
    return {
      ...cutoff,
      description: cutoff.scope === 'all' ? (SHARED_CUTOFF_COPY[lang] || SHARED_CUTOFF_COPY.en)
        : `${t.currentCutoff} · ${EXPLORER_FEATURES.map(feature => `${label(feature.label, lang)}: ${profileValueLabel(profile, feature.key, options[feature.key], lang, t)}`).join(' · ')}`,
    };
  }, [profile, policy, lang, options, t]);
  const descriptions = useMemo(() => new Map(students.map(student => [student.id, `${student.id} · GPA ${student.gpa} · SAT Percentile ${student.sat} · ${EXPLORER_FEATURES.map(feature => `${label(feature.label, lang)}: ${profileValueLabel(student, feature.key, options[feature.key], lang, t)}`).join(' · ')} · ${getDecision(student, policy) ? t.admitted : t.rejected}`])), [students, options, lang, policy, t]);
  const changeLayout = patch => setLayout(current => normalizeExplorerLayout({ ...current, ...patch }));
  const changeBinning = next => { onBinningChange(next); setSelectedValues(current => { const nextValues = { ...current }; delete nextValues.zipIncome; return nextValues; }); };
  const resetView = event => {
    event.stopPropagation();
    setLayout({ columns: '', rows: '', sections: [] });
    setSelectedValues({});
    onBinningChange({ method: 'fixed', count: 3, thresholds: [50000, 75000, 100000] });
    setResetVersion(current => current + 1);
    viewport.current?.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  };
  const registerPair = (role, element) => { pairButtons.current[role] = element; };
  const navigatePair = role => {
    const target = pairButtons.current[role];
    const scrollport = viewport.current;
    if (!target || !scrollport) return;
    const plot = target.closest('[data-explorer-panel]');
    const bounds = plot.getBoundingClientRect();
    const view = scrollport.getBoundingClientRect();
    // Keep navigation inside the matrix and clear its sticky row-label gutter.
    const left = view.left + scrollport.clientLeft + rowGutter;
    const right = view.left + scrollport.clientLeft + scrollport.clientWidth;
    const top = view.top + scrollport.clientTop;
    const bottom = top + scrollport.clientHeight;
    const dx = bounds.left < left ? bounds.left - left : bounds.right > right ? Math.min(bounds.right - right, bounds.left - left) : 0;
    const dy = bounds.top < top ? bounds.top - top : bounds.bottom > bottom ? Math.min(bounds.bottom - bottom, bounds.top - top) : 0;
    scrollport.scrollBy({ left: dx, top: dy, behavior: 'instant' });
    // Narrow layouts scroll with the page rather than a fixed-height matrix.
    const visiblePlot = plot.getBoundingClientRect();
    if (visiblePlot.top < 0 || visiblePlot.bottom > window.innerHeight) {
      const alignedLeft = scrollport.scrollLeft;
      plot.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      // Native horizontal alignment can hide the badge under a sticky row
      // label when a full plot does not fit beside that label on mobile.
      scrollport.scrollLeft = alignedLeft;
    }
    target.focus({ preventScroll: true });
  };
  const selectFromEvent = event => {
    const point = event.target.closest?.('[data-explorer-student]');
    if (point) {
      onSelect(point.dataset.explorerStudent);
      return;
    }
    if (event.target.closest?.('.fex-controls, [data-draft-student], [data-explorer-lens], [data-profile-pair]')) return;
    onSelect(null);
  };
  const columnCount = Math.max(1, groups.columns.length);
  const singlePlot = groups.panelCount === 1;
  const plotWidth = Math.max(240, Math.floor((availableWidth - rowGutter - (columnCount - 1) * MATRIX_COLUMN_GAP) / columnCount));
  const matrixWidth = rowGutter + columnCount * plotWidth + (columnCount - 1) * MATRIX_COLUMN_GAP;
  return <div lang={lang} className={`feature-explorer-matrix${isLight ? ' fex-light' : ''}${singlePlot ? ' fex-single' : ''}`} data-feature-explorer data-panel-count={groups.panelCount} data-boundary-ui onPointerDown={event => event.stopPropagation()} onClick={selectFromEvent}
    onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-explorer-student]')) { event.preventDefault(); onSelect(event.target.dataset.explorerStudent); } }}>
    <div className="fex-controls">
      <button type="button" className="workspace-reset" data-explorer-reset aria-label={resetCopy.accessible} title={resetCopy.accessible} onClick={resetView}>
        <RotateCcw size={12} aria-hidden="true" /><span>{resetCopy.label}</span>
      </button>
      {['rows', 'columns'].map(role => <label key={role}>{t[role]}<select aria-label={t[role]} value={layout[role]} onChange={event => changeLayout({ [role]: event.target.value })}>
        <option value="">{t.none}</option>{EXPLORER_FEATURES.map(feature => <option key={feature.key} value={feature.key} disabled={activeKeys.includes(feature.key) && layout[role] !== feature.key}>{label(feature.label, lang)}</option>)}
      </select></label>)}
      <ExplorerDropdown key={resetVersion} className="fex-sections-picker" bodyClassName="fex-value-options" label={layout.sections.length ? `${t.sections} · ${layout.sections.length}` : t.add}>
        <div className="fex-value-actions">
          <button type="button" onClick={() => changeLayout({ sections: EXPLORER_FEATURES.map(feature => feature.key).filter(key => key !== layout.rows && key !== layout.columns) })}>{t.all}</button>
          <button type="button" onClick={() => changeLayout({ sections: [] })}>{t.clear}</button>
        </div>
        {EXPLORER_FEATURES.map(feature => <label key={feature.key}>
          <input type="checkbox" disabled={feature.key === layout.columns || feature.key === layout.rows} checked={layout.sections.includes(feature.key)} onChange={event => changeLayout({ sections: event.target.checked ? [...layout.sections, feature.key] : layout.sections.filter(key => key !== feature.key) })} />{label(feature.label, lang)}
        </label>)}
      </ExplorerDropdown>
      {activeKeys.map(key => <ValuePicker key={key} feature={featureFor(key)} options={options[key]} selected={selectedValues[key]} onChange={values => setSelectedValues(current => ({ ...current, [key]: values }))} binning={binning} onBinningChange={changeBinning} lang={lang} t={t} />)}
    </div>
    <div className="sr-only" role="status" aria-live="polite">{groups.panelCount} {t.plots}</div>
    <div ref={rowLabelMeasure} className="fex-row-measure" aria-hidden="true">
      {layout.rows && groups.rows.map(row => <span key={row.value}>{label(row.label, lang)}</span>)}
    </div>
    <div className="fex-matrix-viewport" ref={viewport}>
      {!groups.panelCount ? <p className="fex-no-values">{t.noValues}</p> : groups.sections.map(section => <section className="fex-section" key={`${resetVersion}:${section.id}`} data-explorer-section={section.id}>
        {!!section.context.length && <h3>{contextLabel(section.context, lang)}</h3>}
        <div className="fex-grid" style={{ width: matrixWidth, columnGap: MATRIX_COLUMN_GAP, gridTemplateColumns: `${layout.rows ? `${rowLabelWidth}px ` : ''}repeat(${columnCount}, ${plotWidth}px)`, gridTemplateRows: singlePlot && layout.columns ? 'auto minmax(0, 1fr)' : undefined }}>
          {layout.columns && <>{layout.rows && <span className="fex-corner" />}{groups.columns.map(option => <div className="fex-column-label" key={option.value}>{label(option.label, lang)}</div>)}</>}
          {groups.rows.map(row => <div className="fex-grid-row" key={row.value}>
            {layout.rows && <div className="fex-row-label">{label(row.label, lang)}</div>}
            {section.panels.filter(panel => panel.rowValue === row.value).map(panel => {
              const pairRole = profilePair?.originalPanel?.id === panel.id ? 'original' : profilePair?.draftPanel?.id === panel.id ? 'draft' : null;
              return <ExplorerPlot key={panel.id} panel={panel} width={plotWidth} fillHeight={singlePlot} domains={domains} policy={policy} colors={colors} selectedStudent={selectedStudent} draftStudent={draftStudent} onSelect={onSelect} isLight={isLight} edgeIds={edgeIds} isMining={isMining} lang={lang} t={t} descriptions={descriptions} currentCutoff={currentCutoff}
                onEdit={onEdit} onThresholdChange={onThresholdChange} onRestoreSelection={onRestoreSelection} contextKey={contextKey}
                pairRole={pairRole} peerPanel={pairRole === 'original' ? profilePair?.draftPanel : profilePair?.originalPanel} registerPair={registerPair} navigatePair={navigatePair} />;
            })}
          </div>)}
        </div>
      </section>)}
    </div>
  </div>;
}
