import { useMemo, useState } from 'react';
import {
  Cell,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  GraduationCap,
  Info,
  Moon,
  RotateCcw,
  Scale,
  School,
  Sparkles,
  Sun,
  Target,
  Telescope,
  UserRoundSearch,
  Users,
  X,
} from 'lucide-react';

const POLICIES = [
  {
    id: 'academic',
    weights: { gpa: 60, sat: 40, firstGen: 0, athlete: 0, resident: 0 },
    threshold: 62,
    accent: '#60a5fa',
    darkAccent: '#ffd66b',
  },
  {
    id: 'holistic',
    weights: { gpa: 45, sat: 35, firstGen: 8, athlete: 5, resident: 7 },
    threshold: 52,
    accent: '#a78bfa',
    darkAccent: '#cab8ff',
  },
  {
    id: 'opportunity',
    weights: { gpa: 35, sat: 25, firstGen: 25, athlete: 5, resident: 10 },
    threshold: 43,
    accent: '#34d399',
    darkAccent: '#82c8ff',
  },
];

const TRANSLATIONS = {
  en: {
    prototype: 'SIMPLIFIED PROTOTYPE',
    credits: 'Credits',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    mineEdgeCases: 'Mine edge cases',
    edgeCasesFound: 'closest to cutoff',
    fromCutoff: 'from cutoff',
    choosePolicy: 'Choose a policy',
    choosePolicyDesc: 'Each policy represents a different idea about what admission should value.',
    remember: 'Remember',
    simulationNote: 'This is a simplified simulation, not a real admission system. The policy reflects human choices about what counts.',
    seeAffected: 'See who is affected',
    seeAffectedDesc: 'Each dot is one simulated student. Click a dot to investigate a decision.',
    admitted: 'Admitted',
    notAdmitted: 'Not admitted',
    student: 'Student',
    noContextFlags: 'No context flags',
    firstGeneration: 'First-generation',
    continuingGeneration: 'Continuing-generation',
    firstGenerationShort: 'First-gen',
    continuingGenerationShort: 'Not first-gen',
    athlete: 'Athlete',
    athletes: 'Athletes',
    nonAthletes: 'Non-athletes',
    athletesShort: 'Athletes',
    nonAthletesShort: 'Non-athletes',
    inState: 'In-state',
    outOfState: 'Out-of-state',
    inStateShort: 'In-state',
    outOfStateShort: 'Out-of-state',
    yes: 'Yes',
    no: 'No',
    studentsAdmitted: 'students admitted',
    overallRate: 'Overall admission rate',
    compareOutcomes: 'Compare admission rates',
    gapCaution: 'Within each group, how many were admitted? Differences are clues—not proof of bias.',
    admittedFraction: '{admitted}/{total}',
    lowerRateLabel: '{group}: {gap} points lower',
    sameRateLabel: 'Both groups have the same admission rate.',
    firstGenStatus: 'First-generation',
    athleticStatus: 'Athletics',
    residency: 'Residency',
    discuss: 'Discuss',
    reflectionLabel: 'Your reflection (not saved)',
    reflectionPlaceholder: 'I think this policy is... because...',
    whatIfTitle: 'What if this student were different?',
    whatIfDesc: 'Change one factor at a time to audit the decision.',
    adjustedPosition: 'Adjusted position',
    adjustedSamePosition: 'Adjusted profile · same GPA/SAT position',
    chartAxisNote: 'The chart maps GPA and SAT. A background change can alter the decision without moving the point.',
    reset: 'Reset',
    selectStudent: 'Select a student from the chart',
    selectStudentDesc: 'Then test whether a small academic or background change alters the automated decision.',
    decisionScore: 'Decision score',
    flipQuestion: 'The result flipped. Which factor caused it, and should it matter?',
    changeQuestion: 'Change one factor until the result flips. Should that factor matter?',
    auditNote: 'Background changes audit the policy; they are not advice for students.',
    fixedDataset: 'Fixed classroom dataset · 72 simulated applicants · No real student data',
    footerTitle: 'CounterLens simplified AI Ethics learning prototype',
    creditsTitle: 'Project Team & Institution',
    principalInvestigator: 'Principal Investigator',
    researcherDeveloper: 'Researcher & Developer',
    projectLead: 'Prof. Rebecca Williams',
    contributor: 'Eric Yang, Ph.D. Student',
    department: 'Dept. of Computer Science and Electrical Engineering (CSEE)',
    college: 'College of Engineering and Information Technology',
    university: 'University of Maryland, Baltimore County (UMBC)',
    datasetReference: 'Dataset Reference',
    datasetDesc: "Inspired by the UC Berkeley 1973 Admissions Dataset (Bickel et al., 1975). Used for exploring Simpson's Paradox and algorithmic bias.",
    visitLab: 'Visit Lab Site',
    visitDepartment: 'Department Website',
    close: 'Close',
    policies: {
      academic: {
        name: 'Academic Focus',
        shortName: 'Strict academic cutoff',
        description: 'GPA and SAT only, with a strict admission cutoff.',
        question: 'Does one academic rule guarantee a fair result?',
      },
      holistic: {
        name: 'Whole-Person Review',
        shortName: 'Context + balance',
        description: 'Academic achievement and context, with a moderate cutoff.',
        question: 'Which context should an admission system consider?',
      },
      opportunity: {
        name: 'Opportunity-Aware',
        shortName: 'Broader access',
        description: 'More weight for barriers, plus a broader-access cutoff.',
        question: 'When does addressing barriers become unfair preference?',
      },
    },
  },
  zh: {
    prototype: '简化版原型',
    credits: '项目团队',
    lightTheme: '亮色',
    darkTheme: '暗色',
    mineEdgeCases: '挖掘边缘案例',
    edgeCasesFound: '名最接近录取线',
    fromCutoff: '距录取线',
    choosePolicy: '选择一项政策',
    choosePolicyDesc: '每项政策都代表一种不同的录取价值取向。',
    remember: '请记住',
    simulationNote: '这是一个简化的模拟实验，并非真实录取系统。政策反映的是人类对于“什么重要”的选择。',
    seeAffected: '观察谁受到影响',
    seeAffectedDesc: '每个点代表一名模拟学生。点击任意点，进一步审查这项决定。',
    admitted: '已录取',
    notAdmitted: '未录取',
    student: '学生',
    noContextFlags: '无背景标签',
    firstGeneration: '第一代大学生',
    continuingGeneration: '非第一代大学生',
    firstGenerationShort: '第一代',
    continuingGenerationShort: '非第一代',
    athlete: '运动员',
    athletes: '运动员',
    nonAthletes: '非运动员',
    athletesShort: '运动员',
    nonAthletesShort: '非运动员',
    inState: '州内学生',
    outOfState: '州外学生',
    inStateShort: '州内',
    outOfStateShort: '州外',
    yes: '是',
    no: '否',
    studentsAdmitted: '名学生被录取',
    overallRate: '总体录取率',
    compareOutcomes: '比较群体录取率',
    gapCaution: '每个群体中有多少人被录取？差距是调查线索，并不能单独证明存在偏见。',
    admittedFraction: '{admitted}/{total}',
    lowerRateLabel: '{group}低 {gap} 个百分点',
    sameRateLabel: '两个群体的录取率相同。',
    firstGenStatus: '第一代身份',
    athleticStatus: '运动员',
    residency: '居住地',
    discuss: '讨论',
    reflectionLabel: '写下你的思考（不会保存）',
    reflectionPlaceholder: '我认为这项政策……因为……',
    whatIfTitle: '如果这名学生有所不同呢？',
    whatIfDesc: '每次改变一个因素，审查这项决定。',
    adjustedPosition: '调整后位置',
    adjustedSamePosition: '背景已调整 · GPA/SAT 坐标不变',
    chartAxisNote: '图中只映射 GPA 和 SAT；背景变化可能在点不移动时仍改变决定。',
    reset: '重置',
    selectStudent: '请从图中选择一名学生',
    selectStudentDesc: '然后测试较小的学业或背景变化是否会改变自动化决定。',
    decisionScore: '决策分数',
    flipQuestion: '结果翻转了。哪个因素造成了变化？它应该重要吗？',
    changeQuestion: '改变一个因素直到结果翻转。这个因素应该重要吗？',
    auditNote: '改变背景是审查政策，并非给学生的建议。',
    fixedDataset: '固定课堂数据 · 72 名模拟申请者 · 不含真实学生数据',
    footerTitle: 'CounterLens 简化版 AI Ethics 教学原型',
    creditsTitle: '项目团队与机构',
    principalInvestigator: '首席研究员',
    researcherDeveloper: '研究与开发',
    projectLead: 'Prof. Rebecca Williams',
    contributor: 'Eric Yang，博士生',
    department: '计算机科学与电气工程系（CSEE）',
    college: '工程与信息技术学院',
    university: '马里兰大学巴尔的摩县分校（UMBC）',
    datasetReference: '数据集参考',
    datasetDesc: '灵感来自 1973 年加州大学伯克利分校录取数据集（Bickel 等，1975），用于探索辛普森悖论与算法偏见。',
    visitLab: '访问实验室主页',
    visitDepartment: '访问院系网站',
    close: '关闭',
    policies: {
      academic: {
        name: '学业优先',
        shortName: '严格学业录取线',
        description: '只看 GPA 与 SAT，并采用严格录取线。',
        question: '同一套学业标准一定公平吗？',
      },
      holistic: {
        name: '综合评估',
        shortName: '背景与平衡',
        description: '同时考虑学业和背景，采用中等录取线。',
        question: '录取系统应该考虑哪些背景？',
      },
      opportunity: {
        name: '机会补偿',
        shortName: '扩大入学机会',
        description: '更加重视机会障碍，并采用较宽松录取线。',
        question: '弥补机会差距何时会变成不公平优待？',
      },
    },
  },
  es: {
    prototype: 'PROTOTIPO SIMPLIFICADO',
    credits: 'Créditos',
    lightTheme: 'Claro',
    darkTheme: 'Oscuro',
    mineEdgeCases: 'Casos límite',
    edgeCasesFound: 'más cerca del corte',
    fromCutoff: 'del corte',
    choosePolicy: 'Elige una política',
    choosePolicyDesc: 'Cada política representa una idea distinta sobre lo que debe valorar la admisión.',
    remember: 'Recuerda',
    simulationNote: 'Esta es una simulación simplificada, no un sistema real de admisión. La política refleja decisiones humanas sobre lo que importa.',
    seeAffected: 'Observa a quién afecta',
    seeAffectedDesc: 'Cada punto representa a un estudiante simulado. Haz clic para investigar una decisión.',
    admitted: 'Admitido',
    notAdmitted: 'No admitido',
    student: 'Estudiante',
    noContextFlags: 'Sin etiquetas de contexto',
    firstGeneration: 'Primera generación',
    continuingGeneration: 'Generación continua',
    firstGenerationShort: '1.ª gen.',
    continuingGenerationShort: 'No 1.ª gen.',
    athlete: 'Deportista',
    athletes: 'Deportistas',
    nonAthletes: 'No deportistas',
    athletesShort: 'Deportistas',
    nonAthletesShort: 'No deport.',
    inState: 'Del estado',
    outOfState: 'Fuera del estado',
    inStateShort: 'Del estado',
    outOfStateShort: 'Fuera',
    yes: 'Sí',
    no: 'No',
    studentsAdmitted: 'estudiantes admitidos',
    overallRate: 'Tasa general de admisión',
    compareOutcomes: 'Compara tasas de admisión',
    gapCaution: '¿Cuántos fueron admitidos en cada grupo? Las diferencias son pistas, no pruebas de sesgo.',
    admittedFraction: '{admitted}/{total}',
    lowerRateLabel: '{group}: {gap} puntos menos',
    sameRateLabel: 'Ambos grupos tienen la misma tasa de admisión.',
    firstGenStatus: 'Primera generación',
    athleticStatus: 'Deporte',
    residency: 'Residencia',
    discuss: 'Debate',
    reflectionLabel: 'Tu reflexión (no se guarda)',
    reflectionPlaceholder: 'Creo que esta política es... porque...',
    whatIfTitle: '¿Y si cambiamos este caso?',
    whatIfDesc: 'Cambia un factor y audita la decisión.',
    adjustedPosition: 'Posición ajustada',
    adjustedSamePosition: 'Perfil ajustado · misma posición GPA/SAT',
    chartAxisNote: 'El gráfico representa GPA y SAT. Un cambio de contexto puede alterar la decisión sin mover el punto.',
    reset: 'Restablecer',
    selectStudent: 'Selecciona un estudiante en el gráfico',
    selectStudentDesc: 'Después prueba si un pequeño cambio académico o de contexto altera la decisión automatizada.',
    decisionScore: 'Puntuación de decisión',
    flipQuestion: 'El resultado cambió. ¿Qué factor lo causó y debería importar?',
    changeQuestion: 'Cambia un factor hasta invertir el resultado. ¿Debería importar?',
    auditNote: 'Cambiar el contexto audita la política; no aconseja a estudiantes.',
    fixedDataset: 'Datos fijos para clase · 72 solicitantes simulados · Sin datos reales',
    footerTitle: 'Prototipo simplificado de aprendizaje de Ética de IA de CounterLens',
    creditsTitle: 'Equipo del proyecto e institución',
    principalInvestigator: 'Investigadora principal',
    researcherDeveloper: 'Investigación y desarrollo',
    projectLead: 'Prof. Rebecca Williams',
    contributor: 'Eric Yang, estudiante de doctorado',
    department: 'Departamento de Informática e Ingeniería Eléctrica (CSEE)',
    college: 'Facultad de Ingeniería y Tecnología de la Información',
    university: 'Universidad de Maryland, Condado de Baltimore (UMBC)',
    datasetReference: 'Referencia del conjunto de datos',
    datasetDesc: 'Inspirado en el conjunto de datos de admisiones de UC Berkeley de 1973 (Bickel et al., 1975), usado para explorar la paradoja de Simpson y el sesgo algorítmico.',
    visitLab: 'Sitio del laboratorio',
    visitDepartment: 'Sitio del departamento',
    close: 'Cerrar',
    policies: {
      academic: {
        name: 'Enfoque académico',
        shortName: 'Corte académico estricto',
        description: 'Solo GPA y SAT, con un corte de admisión estricto.',
        question: '¿Una misma regla académica garantiza justicia?',
      },
      holistic: {
        name: 'Evaluación integral',
        shortName: 'Contexto + equilibrio',
        description: 'Logro académico y contexto, con un corte moderado.',
        question: '¿Qué contexto debería considerar el sistema?',
      },
      opportunity: {
        name: 'Atención a oportunidades',
        shortName: 'Acceso más amplio',
        description: 'Más peso a las barreras y un corte de acceso más amplio.',
        question: '¿Cuándo abordar barreras se vuelve preferencia injusta?',
      },
    },
  },
};

const formatCopy = (template, values) => Object.entries(values).reduce(
  (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
  template,
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createSeededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const createStudents = () => {
  const random = createSeededRandom(1973);
  return Array.from({ length: 72 }, (_, index) => {
    const firstGen = random() < 0.3;
    const athlete = random() < 0.16;
    const resident = random() < 0.6;
    const academicSignal = (random() + random() + random() + random()) / 4;
    const gpa = clamp(2.45 + academicSignal * 1.55 - (firstGen ? 0.1 : 0), 2.4, 4);
    const satSignal = (random() + random() + academicSignal) / 3;
    const sat = clamp(Math.round((1030 + satSignal * 570 - (firstGen ? 55 : 0)) / 10) * 10, 950, 1600);

    return {
      id: `S${String(index + 1).padStart(2, '0')}`,
      gpa: Number(gpa.toFixed(2)),
      sat,
      firstGen,
      athlete,
      resident,
    };
  });
};

const STUDENTS = createStudents();

const scoreStudent = (student, policy) => {
  if (!student) return 0;
  const gpaScore = clamp((student.gpa - 2.4) / 1.6, 0, 1) * policy.weights.gpa;
  const satScore = clamp((student.sat - 950) / 650, 0, 1) * policy.weights.sat;
  const contextScore =
    (student.firstGen ? policy.weights.firstGen : 0) +
    (student.athlete ? policy.weights.athlete : 0) +
    (student.resident ? policy.weights.resident : 0);
  return gpaScore + satScore + contextScore;
};

const getDecision = (student, policy) => scoreStudent(student, policy) >= policy.threshold;

const percentage = (part, total) => (total ? Math.round((part / total) * 100) : 0);

const StudentTooltip = ({ active, payload, policy, t }) => {
  if (!active || !payload?.[0]?.payload) return null;
  const student = payload[0].payload;
  const admitted = getDecision(student, policy);
  const score = scoreStudent(student, policy);
  const distance = Math.abs(score - policy.threshold);

  return (
    <div className="simplified-student-tooltip rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-2xl">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="font-bold text-white">{t.student} {student.id}</span>
        <span className={admitted ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
          {admitted ? t.admitted : t.notAdmitted}
        </span>
      </div>
      <div className="text-slate-300">GPA {student.gpa.toFixed(2)} · SAT {student.sat}</div>
      <div className="mt-1 font-mono text-[10px] text-slate-400">
        {t.decisionScore}: {score.toFixed(1)} / {policy.threshold} · {distance.toFixed(1)} {t.fromCutoff}
      </div>
      <div className="mt-1 text-slate-500">
        {[student.firstGen && t.firstGeneration, student.athlete && t.athlete, student.resident && t.inState]
          .filter(Boolean)
          .join(' · ') || t.noContextFlags}
      </div>
    </div>
  );
};

const RateComparison = ({ label, leftLabel, leftStats, rightLabel, rightStats, t }) => {
  const gap = Math.abs(leftStats.rate - rightStats.rate);
  const lowerRateGroup = leftStats.rate <= rightStats.rate ? leftLabel : rightLabel;
  const comparisonText = gap === 0
    ? t.sameRateLabel
    : formatCopy(t.lowerRateLabel, { group: lowerRateGroup, gap });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-1.5">
      <div className="mb-1 text-[10px] font-semibold leading-tight text-slate-200">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1 rounded-lg bg-slate-900 px-1.5 py-1">
          <div className="text-[9px] leading-tight text-slate-500" title={leftLabel}>{leftLabel}</div>
          <div className="flex shrink-0 items-baseline gap-1 text-right">
            <div className="text-sm font-bold leading-none text-white">{leftStats.rate}%</div>
            <div className="text-[8px] leading-none text-slate-500">
              {formatCopy(t.admittedFraction, leftStats)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 rounded-lg bg-slate-900 px-1.5 py-1">
          <div className="text-[9px] leading-tight text-slate-500" title={rightLabel}>{rightLabel}</div>
          <div className="flex shrink-0 items-baseline gap-1 text-right">
            <div className="text-sm font-bold leading-none text-white">{rightStats.rate}%</div>
            <div className="text-[8px] leading-none text-slate-500">
              {formatCopy(t.admittedFraction, rightStats)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-1.5 border-t border-slate-800 pt-1 text-[9px] leading-tight text-slate-400">
        {comparisonText}
      </div>
    </div>
  );
};

const StudentDot = ({ cx, cy, fill, fillOpacity, stroke, strokeWidth, className, style }) => (
  <circle
    className={`recharts-symbols ${className || ''}`}
    cx={cx}
    cy={cy}
    r="5.5"
    fill={fill}
    fillOpacity={fillOpacity}
    stroke={stroke}
    strokeWidth={strokeWidth}
    style={style}
  />
);

const AdjustedPositionMarker = ({ cx, cy, draftDecision, isLight, samePosition }) => {
  const outcomeColor = draftDecision
    ? (isLight ? '#059669' : '#72dda9')
    : (isLight ? '#e11d48' : '#ff9187');
  const surfaceColor = isLight ? '#f8fafc' : '#343d55';

  return (
    <g className="counterfactual-position-marker" pointerEvents="none">
      <circle
        cx={cx}
        cy={cy}
        r={samePosition ? 11 : 9}
        fill={isLight ? 'rgba(255, 251, 235, 0.82)' : 'rgba(18, 27, 25, 0.88)'}
        stroke={isLight ? '#d97706' : '#ffd66b'}
        strokeDasharray="3 2.5"
        strokeWidth="2.25"
      />
      <circle
        cx={samePosition ? cx + 7 : cx}
        cy={samePosition ? cy - 7 : cy}
        r={samePosition ? 4.25 : 4}
        fill={outcomeColor}
        stroke={surfaceColor}
        strokeWidth="1.75"
      />
    </g>
  );
};

const SimplifiedApp = () => {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('dark');
  const [showCredits, setShowCredits] = useState(false);
  const [isMining, setIsMining] = useState(false);
  const [policyId, setPolicyId] = useState('academic');
  const [selectedId, setSelectedId] = useState(null);
  const [draftStudent, setDraftStudent] = useState(null);
  const [reflection, setReflection] = useState('');

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const isLight = theme === 'light';
  const policy = POLICIES.find((item) => item.id === policyId) || POLICIES[0];
  const policyCopy = t.policies[policy.id];
  const selectedStudent = useMemo(
    () => STUDENTS.find((student) => student.id === selectedId) || null,
    [selectedId],
  );

  const outcomes = useMemo(
    () => STUDENTS.map((student) => ({ ...student, admitted: getDecision(student, policy) })),
    [policy],
  );

  const policyAdmissionCounts = useMemo(
    () => Object.fromEntries(
      POLICIES.map((item) => [
        item.id,
        STUDENTS.filter((student) => getDecision(student, item)).length,
      ]),
    ),
    [],
  );

  const edgeCases = useMemo(
    () => outcomes
      .map((student) => ({
        ...student,
        distance: Math.abs(scoreStudent(student, policy) - policy.threshold),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 8),
    [outcomes, policy],
  );
  const edgeCaseIds = useMemo(() => new Set(edgeCases.map((student) => student.id)), [edgeCases]);

  const impact = useMemo(() => {
    const admitted = outcomes.filter((student) => student.admitted).length;
    const getGroupStats = (filter) => {
      const group = outcomes.filter(filter);
      const groupAdmitted = group.filter((student) => student.admitted).length;
      return {
        admitted: groupAdmitted,
        total: group.length,
        rate: percentage(groupAdmitted, group.length),
      };
    };

    return {
      admitted,
      overallRate: percentage(admitted, outcomes.length),
      firstGen: getGroupStats((student) => student.firstGen),
      continuingGen: getGroupStats((student) => !student.firstGen),
      athletes: getGroupStats((student) => student.athlete),
      nonAthletes: getGroupStats((student) => !student.athlete),
      residents: getGroupStats((student) => student.resident),
      nonResidents: getGroupStats((student) => !student.resident),
    };
  }, [outcomes]);

  const originalDecision = selectedStudent ? getDecision(selectedStudent, policy) : false;
  const draftDecision = draftStudent ? getDecision(draftStudent, policy) : false;
  const draftScore = draftStudent ? scoreStudent(draftStudent, policy) : 0;
  const decisionFlipped = selectedStudent && draftStudent && originalDecision !== draftDecision;
  const draftProfileChanged = Boolean(selectedStudent && draftStudent && (
    selectedStudent.gpa !== draftStudent.gpa ||
    selectedStudent.sat !== draftStudent.sat ||
    selectedStudent.firstGen !== draftStudent.firstGen ||
    selectedStudent.athlete !== draftStudent.athlete ||
    selectedStudent.resident !== draftStudent.resident
  ));
  const plotPositionChanged = Boolean(selectedStudent && draftStudent && (
    selectedStudent.gpa !== draftStudent.gpa || selectedStudent.sat !== draftStudent.sat
  ));

  const updateDraft = (field, value) => {
    setDraftStudent((current) => (current ? { ...current, [field]: value } : current));
  };

  const selectStudent = (studentId) => {
    const student = STUDENTS.find((item) => item.id === studentId) || null;
    setSelectedId(studentId);
    setDraftStudent(student ? { ...student } : null);
  };

  return (
    <div className={`min-h-screen overflow-y-auto text-slate-200 selection:bg-blue-500/30 xl:h-screen xl:overflow-hidden ${isLight ? 'theme-daylight simplified-daylight' : 'simplified-observatory'}`}>
      {showCredits && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowCredits(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0f131a] p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30">
                  <Telescope className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">CounterLens</div>
                  <h2 className="text-xl font-bold text-white">{t.creditsTitle}</h2>
                </div>
              </div>
              <button
                type="button"
                aria-label={t.close}
                onClick={() => setShowCredits(false)}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
                  <Users className="h-4 w-4" /> {t.principalInvestigator}
                </div>
                <div className="font-semibold text-white">{t.projectLead}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                  <Sparkles className="h-4 w-4" /> {t.researcherDeveloper}
                </div>
                <div className="font-semibold text-white">{t.contributor}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="flex items-start gap-3">
                <School className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <div className="space-y-1 text-sm">
                  <div className="text-slate-300">{t.department}</div>
                  <div className="text-slate-400">{t.college}</div>
                  <div className="font-semibold text-white">{t.university}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                <Database className="h-4 w-4" /> {t.datasetReference}
              </div>
              <p className="text-sm leading-relaxed text-slate-400">{t.datasetDesc}</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href="https://sites.google.com/umbc.edu/prof-rebecca-williams/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <ExternalLink className="h-4 w-4" /> {t.visitLab}
              </a>
              <a
                href="https://www.csee.umbc.edu/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                <ExternalLink className="h-4 w-4" /> {t.visitDepartment}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-5 xl:h-screen xl:min-h-0 xl:py-3">
        <header className="mb-3 flex shrink-0 flex-col justify-between gap-3 border-b border-slate-800 pb-3 md:flex-row md:items-center xl:mb-2.5 xl:pb-2.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30">
              <Telescope className="h-6 w-6 text-amber-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[26px]">CounterLens</h1>
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-amber-300">
                {t.prototype}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
            >
              {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {isLight ? t.darkTheme : t.lightTheme}
            </button>
            <div className="flex rounded-xl border border-slate-800 bg-slate-900/70 p-1">
              {[
                ['en', 'EN'],
                ['zh', '中文'],
                ['es', 'ES'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    lang === code ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCredits(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
            >
              <Info className="h-3.5 w-3.5" /> {t.credits}
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[245px_minmax(520px,1.55fr)_minmax(370px,0.9fr)] xl:gap-3">
          <aside className="space-y-3 xl:min-h-0 xl:overflow-y-auto xl:pr-0.5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 shadow-xl shadow-black/10">
              <div className="mb-2 flex items-start gap-2.5">
                <div className="obs-step-brass flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">1</div>
                <div>
                  <h2 className="font-semibold text-white">{t.choosePolicy}</h2>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.choosePolicyDesc}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                {POLICIES.map((item) => {
                  const active = item.id === policy.id;
                  const itemCopy = t.policies[item.id];
                  const admittedCount = policyAdmissionCounts[item.id];
                  const itemAccent = isLight ? item.accent : item.darkAccent;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPolicyId(item.id);
                        setIsMining(false);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? 'border-blue-400/60 bg-blue-500/12 shadow-lg shadow-blue-500/5'
                          : 'border-slate-800 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={active ? 'font-semibold text-white' : 'font-semibold text-slate-300'}>{itemCopy.name}</span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="rounded-full bg-slate-800/70 px-1.5 py-0.5 text-[9px] font-bold text-slate-400"
                            aria-label={`${admittedCount} / ${STUDENTS.length} ${t.studentsAdmitted}`}
                          >
                            {admittedCount}/{STUDENTS.length}
                          </span>
                          {active ? <CheckCircle2 className="h-4 w-4 text-blue-400" /> : <ArrowRight className="h-4 w-4 text-slate-600" />}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: itemAccent }}>
                        {itemCopy.shortName}
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500 xl:text-[10px]">{itemCopy.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-2.5">
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-100">{t.remember}</h3>
                  <p className="mt-1 text-[11px] leading-snug text-amber-100/65 xl:text-[10px]">{t.simulationNote}</p>
                </div>
              </div>
            </section>
          </aside>

          <section className="flex min-h-[520px] flex-col rounded-2xl border border-slate-800 bg-slate-900/65 p-4 shadow-xl shadow-black/10 xl:min-h-0">
              <div className="mb-2.5 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <div className="obs-step-verdigris flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white">2</div>
                  <div>
                    <h2 className="font-semibold text-white">{t.seeAffected}</h2>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.seeAffectedDesc}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    aria-pressed={isMining}
                    title={`${edgeCases.length} ${t.edgeCasesFound}`}
                    onClick={() => setIsMining((current) => !current)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-semibold transition ${
                      isMining
                        ? 'border-amber-400/50 bg-amber-400/12 text-amber-300 shadow-sm shadow-amber-500/15'
                        : 'border-slate-700 bg-slate-950/45 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Target className={`h-3.5 w-3.5 ${isMining ? 'animate-pulse' : ''}`} />
                    {t.mineEdgeCases}
                    {isMining && <span className="rounded bg-amber-400/15 px-1 text-[9px]">8</span>}
                  </button>
                  <span className="flex items-center gap-1.5 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />{t.admitted}</span>
                  <span className="flex items-center gap-1.5 text-rose-300"><span className="h-2 w-2 rounded-full bg-rose-400" />{t.notAdmitted}</span>
                  {draftProfileChanged && (
                    <span className="flex items-center gap-1.5 font-medium text-amber-300">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-400" />
                      {plotPositionChanged ? t.adjustedPosition : t.adjustedSamePosition}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="simplified-scatter-plot h-[390px] min-h-[320px] w-full rounded-xl border border-slate-800/80 bg-slate-950/45 p-2 xl:h-auto xl:min-h-0 xl:flex-1"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  if (!event.target.closest?.('.recharts-scatter-symbol')) {
                    setSelectedId(null);
                    setDraftStudent(null);
                  }
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 24, bottom: 22, left: 4 }}>
                    <CartesianGrid stroke={isLight ? '#dbe3ee' : '#7887a5'} strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      type="number"
                      dataKey="gpa"
                      domain={[2.4, 4]}
                      ticks={[2.4, 2.8, 3.2, 3.6, 4]}
                      stroke={isLight ? '#94a3b8' : '#71827b'}
                      tick={{ fill: isLight ? '#475569' : '#9aa9a3', fontSize: 11 }}
                      label={{ value: 'GPA', position: 'insideBottomRight', offset: -12, fill: isLight ? '#475569' : '#9aa9a3', fontSize: 12 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="sat"
                      domain={[950, 1600]}
                      ticks={[1000, 1200, 1400, 1600]}
                      stroke={isLight ? '#94a3b8' : '#71827b'}
                      tick={{ fill: isLight ? '#475569' : '#9aa9a3', fontSize: 11 }}
                      label={{ value: 'SAT', angle: -90, position: 'insideLeft', offset: 12, fill: isLight ? '#475569' : '#9aa9a3', fontSize: 12 }}
                    />
                    {selectedStudent && (
                      <>
                        <ReferenceLine
                          x={selectedStudent.gpa}
                          stroke={isLight ? '#2563eb' : '#82c8ff'}
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          strokeOpacity={0.9}
                        />
                        <ReferenceLine
                          y={selectedStudent.sat}
                          stroke={isLight ? '#2563eb' : '#82c8ff'}
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          strokeOpacity={0.9}
                        />
                      </>
                    )}
                    {draftProfileChanged && plotPositionChanged && (
                      <>
                        <ReferenceLine
                          x={draftStudent.gpa}
                          stroke={isLight ? '#d97706' : '#ffd66b'}
                          strokeDasharray="2 5"
                          strokeWidth={1.25}
                          strokeOpacity={0.68}
                          style={{ pointerEvents: 'none' }}
                        />
                        <ReferenceLine
                          y={draftStudent.sat}
                          stroke={isLight ? '#d97706' : '#ffd66b'}
                          strokeDasharray="2 5"
                          strokeWidth={1.25}
                          strokeOpacity={0.68}
                          style={{ pointerEvents: 'none' }}
                        />
                        <ReferenceLine
                          segment={[
                            { x: selectedStudent.gpa, y: selectedStudent.sat },
                            { x: draftStudent.gpa, y: draftStudent.sat },
                          ]}
                          stroke={isLight ? '#b45309' : '#c79245'}
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          strokeOpacity={0.9}
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    )}
                    <Tooltip
                      cursor={{ stroke: isLight ? '#94a3b8' : '#71827b', strokeDasharray: '3 3' }}
                      content={<StudentTooltip policy={policy} t={t} />}
                      isAnimationActive={false}
                      animationDuration={0}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Scatter
                      data={outcomes}
                      shape={<StudentDot />}
                      onClick={(entry) => {
                        if (entry?.id) selectStudent(entry.id);
                      }}
                    >
                      {outcomes.map((student) => {
                        const isEdgeCase = edgeCaseIds.has(student.id);
                        const isSelected = selectedId === student.id;
                        return (
                          <Cell
                            key={student.id}
                            fill={student.admitted ? (isLight ? '#059669' : '#72dda9') : (isLight ? '#e11d48' : '#ff9187')}
                            fillOpacity={isMining ? (isEdgeCase || isSelected ? 1 : 0.18) : (selectedId && !isSelected ? 0.6 : 1)}
                            stroke={
                              isSelected
                                ? (isLight ? '#2563eb' : '#82c8ff')
                                : isMining && isEdgeCase
                                ? (isLight ? '#f59e0b' : '#ffd66b')
                                : (student.admitted
                                  ? (isLight ? '#065f46' : '#9be5cf')
                                  : (isLight ? '#9f1239' : '#ffaaa3'))
                            }
                            strokeWidth={isSelected ? 2.5 : (isMining && isEdgeCase ? 2.5 : 1.15)}
                            className={isMining && isEdgeCase ? 'animate-pulse' : ''}
                            style={{
                              cursor: 'pointer',
                              filter: isSelected
                                ? 'drop-shadow(0 0 4px rgba(130, 200, 255, 0.92))'
                                : (isMining && isEdgeCase ? 'drop-shadow(0 0 4px rgba(255, 214, 107, 0.88))' : 'none'),
                              transition: 'all 0.25s ease',
                            }}
                          />
                        );
                      })}
                    </Scatter>
                    {draftProfileChanged && (
                      <ReferenceDot
                        x={draftStudent.gpa}
                        y={draftStudent.sat}
                        isFront
                        ifOverflow="visible"
                        shape={(props) => (
                          <AdjustedPositionMarker
                            {...props}
                            draftDecision={draftDecision}
                            isLight={isLight}
                            samePosition={!plotPositionChanged}
                          />
                        )}
                      />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/50 px-3 py-2">
                <div>
                  <span className="text-xl font-bold text-white">{impact.admitted}</span>
                  <span className="ml-2 text-xs text-slate-400">/ {STUDENTS.length} {t.studentsAdmitted}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {t.overallRate}: <span className="font-semibold text-slate-200">{impact.overallRate}%</span>
                </div>
              </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-3">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-2.5 xl:min-h-0">
                <div className="mb-1.5 flex items-start gap-2.5">
                  <div className="obs-step-iris flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-slate-950">3</div>
                  <div>
                    <h2 className="font-semibold text-white">{t.compareOutcomes}</h2>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.gapCaution}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <RateComparison
                    label={t.firstGenStatus}
                    leftLabel={t.firstGenerationShort}
                    leftStats={impact.firstGen}
                    rightLabel={t.continuingGenerationShort}
                    rightStats={impact.continuingGen}
                    t={t}
                  />
                  <RateComparison
                    label={t.athleticStatus}
                    leftLabel={t.athletesShort}
                    leftStats={impact.athletes}
                    rightLabel={t.nonAthletesShort}
                    rightStats={impact.nonAthletes}
                    t={t}
                  />
                  <RateComparison
                    label={t.residency}
                    leftLabel={t.inStateShort}
                    leftStats={impact.residents}
                    rightLabel={t.outOfStateShort}
                    rightStats={impact.nonResidents}
                    t={t}
                  />
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.07] p-1.5">
                    <div className="flex items-start gap-2">
                      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">{t.discuss}</div>
                        <p className="mt-0.5 text-[10px] leading-snug text-violet-100/80">{policyCopy.question}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400" htmlFor="reflection">{t.reflectionLabel}</label>
                    <textarea
                      id="reflection"
                      value={reflection}
                      onChange={(event) => setReflection(event.target.value)}
                      placeholder={t.reflectionPlaceholder}
                      className="mt-1 h-9 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-[10px] text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400"
                    />
                  </div>
                </div>
              </section>

              <section className="flex min-h-[390px] flex-col rounded-2xl border border-blue-400/20 bg-slate-900/65 p-3 xl:min-h-0 xl:p-2.5">
                <div className="mb-2.5 flex shrink-0 items-start justify-between gap-2 xl:mb-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                      <UserRoundSearch className="h-4 w-4 text-blue-300" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold leading-tight text-white">{t.whatIfTitle}</h2>
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{t.whatIfDesc}</p>
                    </div>
                  </div>
                  {draftStudent && (
                    <button
                      type="button"
                      onClick={() => setDraftStudent({ ...selectedStudent })}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" /> {t.reset}
                    </button>
                  )}
                </div>

                {!draftStudent ? (
                  <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/35 p-5 text-center xl:min-h-0">
                    <GraduationCap className="h-8 w-8 text-slate-700" />
                    <h3 className="mt-3 text-sm font-semibold text-slate-300">{t.selectStudent}</h3>
                    <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">{t.selectStudentDesc}</p>
                  </div>
                ) : (
                  <div className="space-y-2 xl:space-y-1">
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/55 px-3 py-2 xl:py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">
                          <span className="font-normal text-slate-500">{t.student} {draftStudent.id}</span>
                          <span className="mx-1.5 text-slate-700">·</span>
                          GPA {draftStudent.gpa.toFixed(2)} · SAT {draftStudent.sat}
                        </div>
                        {draftProfileChanged && (
                          <div className="mt-0.5 text-[10px] font-medium text-amber-300">
                            {plotPositionChanged
                              ? `${t.adjustedPosition} · ΔGPA ${(draftStudent.gpa - selectedStudent.gpa).toFixed(2)} · ΔSAT ${draftStudent.sat - selectedStudent.sat}`
                              : t.adjustedSamePosition}
                          </div>
                        )}
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-bold ${draftDecision ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                        {draftDecision ? t.admitted : t.notAdmitted}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <label htmlFor="gpa-slider" className="font-medium text-slate-300">GPA</label>
                          <span className="font-mono text-blue-300">{draftStudent.gpa.toFixed(2)}</span>
                        </div>
                        <input
                          id="gpa-slider"
                          type="range"
                          min="2.4"
                          max="4"
                          step="0.01"
                          value={draftStudent.gpa}
                          onInput={(event) => updateDraft('gpa', Number(event.currentTarget.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <label htmlFor="sat-slider" className="font-medium text-slate-300">SAT</label>
                          <span className="font-mono text-blue-300">{draftStudent.sat}</span>
                        </div>
                        <input
                          id="sat-slider"
                          type="range"
                          min="950"
                          max="1600"
                          step="10"
                          value={draftStudent.sat}
                          onInput={(event) => updateDraft('sat', Number(event.currentTarget.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        ['firstGen', t.firstGenerationShort],
                        ['athlete', t.athlete],
                        ['resident', t.inState],
                      ].map(([field, label]) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => updateDraft(field, !draftStudent[field])}
                          className={`rounded-xl border px-2 py-1.5 text-[10px] font-medium transition xl:py-1 ${
                            draftStudent[field]
                              ? 'border-blue-400/45 bg-blue-500/12 text-blue-200'
                              : 'border-slate-700 bg-slate-950/50 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {label}: {draftStudent[field] ? t.yes : t.no}
                        </button>
                      ))}
                    </div>

                    <div className={`rounded-xl border p-2.5 xl:p-2 ${decisionFlipped ? 'border-amber-400/35 bg-amber-400/[0.08]' : 'border-slate-800 bg-slate-950/45'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-200">{t.decisionScore}</span>
                        <span className="font-mono text-xs text-slate-300">{draftScore.toFixed(1)} / {policy.threshold}</span>
                      </div>
                      <p className={`mt-1 text-[10px] leading-snug ${decisionFlipped ? 'text-amber-200/80' : 'text-slate-500'}`}>
                        {decisionFlipped ? t.flipQuestion : t.changeQuestion}
                      </p>
                    </div>

                    <p className="text-[10px] leading-snug text-slate-600">
                      {draftProfileChanged && !plotPositionChanged ? t.chartAxisNote : t.auditNote}
                    </p>
                  </div>
                )}
              </section>
          </div>
        </main>

        <footer className="mt-3 flex shrink-0 flex-col justify-between gap-1 border-t border-slate-800 pt-3 text-[10px] text-slate-600 sm:flex-row xl:mt-2 xl:pt-2">
          <span>{t.fixedDataset}</span>
          <span>{t.footerTitle}</span>
        </footer>
      </div>
    </div>
  );
};

export default SimplifiedApp;
