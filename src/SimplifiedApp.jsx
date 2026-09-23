import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cell,
  CartesianGrid,
  ReferenceArea,
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
  School,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunset,
  Target,
  Telescope,
  Users,
  X,
} from 'lucide-react';
import { trackAnonymousEvent } from './data/analytics.js';
import ClassroomSurvey from './ClassroomSurvey.jsx';
import './simplified-workspace.css';
import { scoreStudent, getDecision, backgroundScore, admissionBoundary, backgroundBoundaryBand } from '../shared/admissionModel.js';
import {
  createBundledClassroomView,
  isClassroomApiConfigured,
  loadClassroomView,
} from './data/classroomClient.js';

const LIGHT_OUTCOME_COLORS = {
  admitted: '#047857',
  rejected: '#be123c',
};

const POLICY_PRESENTATION = {
  academic: {
    accent: '#1d4ed8',
    graphiteAccent: '#f2c75c',
    summerAccent: '#f4c95d',
  },
  holistic: {
    accent: '#6d28d9',
    graphiteAccent: '#b8a3f2',
    summerAccent: '#afa6f5',
  },
  opportunity: {
    accent: '#047857',
    graphiteAccent: '#78b7ff',
    summerAccent: '#43d3c1',
  },
};

const THEME_SEQUENCE = ['graphite', 'summer', 'light'];

const DARK_THEME_PALETTES = {
  graphite: {
    surface: '#191c24',
    markerFill: 'rgba(25, 28, 36, 0.88)',
    grid: '#444b5b',
    axis: '#6c758b',
    muted: '#b9bfce',
    primary: '#78b7ff',
    accent: '#c4a2ff',
    connector: '#a78bfa',
    admitted: '#5fd19c',
    rejected: '#ff7b88',
    admittedStroke: '#9be5cf',
    rejectedStroke: '#ffaaa3',
    selectedGlow: 'rgba(120, 183, 255, 0.85)',
  },
  summer: {
    surface: '#102527',
    markerFill: 'rgba(18, 27, 25, 0.88)',
    grid: '#35595b',
    axis: '#71827b',
    muted: '#9aa9a3',
    primary: '#43d3c1',
    accent: '#c4acff',
    connector: '#a78bfa',
    admitted: '#48d6a6',
    rejected: '#ff7f88',
    admittedStroke: '#9be5cf',
    rejectedStroke: '#ffaaa3',
    selectedGlow: 'rgba(67, 211, 193, 0.85)',
  },
};

const TRANSLATIONS = {
  en: {
    prototype: 'SIMPLIFIED PROTOTYPE',
    credits: 'Credits',
    themeGraphite: 'Graphite',
    themeSummer: 'Summer',
    themeLight: 'Light',
    switchTheme: 'Switch theme',
    languageLabel: 'Language',
    mineEdgeCases: 'Find Each Cases',
    edgeCasesFound: 'closest to cutoff',
    fromCutoff: 'from cutoff',
    visualizer: 'Counterfactual Visualizer',
    visualizerSubtitle: 'Move the cutoff. Explore who gets admitted.',
    boundaryHelpTitle: 'How to read the admission boundary',
    boundaryShared: 'Shared admission boundary',
    boundaryBand: 'Background-dependent band',
    boundarySelected: 'Cutoff for this student’s background',
    boundaryEdited: 'Solid: edited background · dashed: original',
    boundaryOriginalEdge: 'Edited background · original cutoff at/beyond chart edge',
    boundaryAll: 'All plotted scores qualify for this background',
    boundaryNone: 'No plotted scores qualify for this background',
    boundaryEdge: 'Cutoff at chart edge',
    boundaryAcademicHelp: 'The line marks score = threshold. Academic Focus uses only GPA and SAT, so the same line applies to everyone. Scores on the line are admitted.',
    boundaryContextHelp: 'These policies also use first-generation, athlete, and residency status. The shaded band spans the possible cutoffs across all eight background combinations. Inside it, the same GPA and SAT can lead to different decisions.',
    boundarySelectedHelp: 'Select a student to see the exact cutoff for that background. If an edit changes the background points, the solid line follows the edited profile and the dashed line keeps the original. Other students retain their own backgrounds and decision colors.',
    boundaryFormula: 'GPA points + SAT points + background points = threshold',
    whatIfStudent: 'What-if student',
    originalProfile: 'Original profile · no changes yet',
    controlsLabel: 'Exploration controls',
    aboutPolicy: 'About this policy',
    choosePolicy: 'Policy Studio',
    choosePolicyDesc: 'Choose a policy. What should admission value?',
    remember: 'Remember',
    simulationNote: 'This is a simplified simulation, not a real admission system. The policy reflects human choices about what counts.',
    seeAffected: 'See who is affected',
    seeAffectedDesc: 'Each dot is one simulated student. Click a dot to investigate a decision.',
    seeAffectedDescApproved: 'Each dot is one record from the approved classroom release. Click a dot to investigate a decision.',
    chartLabel: 'Admission outcomes chart. GPA is on the horizontal axis and SAT is on the vertical axis. Select a student point to investigate the decision.',
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
    compareOutcomes: 'Group Outcomes',
    gapCaution: 'A rate gap is a clue to investigate—not proof of bias.',
    admittedFraction: '{admitted}/{total}',
    admittedCountLabel: '{admitted} of {total} students admitted',
    lowerRateLabel: '{group}: {gap} points lower',
    pointsLower: '{gap} pts lower',
    rateIncrease: 'Admission rate increased to {rate}% since its last change.',
    rateDecrease: 'Admission rate decreased to {rate}% since its last change.',
    sameRateLabel: 'Both groups have the same admission rate.',
    sameRateShort: 'Same rate',
    firstGenStatus: 'First-generation',
    athleticStatus: 'Athletics',
    residency: 'Residency',
    discuss: 'Discuss',
    reflectionLabel: 'Your reflection (not saved)',
    reflectionPlaceholder: 'Fair or unfair? Why?',
    whatIfTitle: 'Counterfactual Editor',
    whatIfDesc: 'What if this student were different?',
    thresholdTitle: 'Admission Threshold',
    thresholdRule: 'Score ≥ cutoff → admitted',
    thresholdHelpTitle: 'What does the threshold change?',
    thresholdHelp: 'The threshold is the minimum decision score needed for admission. Raising it makes admission more selective; lowering it lets more students qualify. It changes the rule for everyone, not any student’s profile.',
    thresholdPreset: 'Switching policies loads that policy’s suggested cutoff. Reset restores it; the policy weights stay the same while you move this slider.',
    thresholdDefault: 'Suggested: {value}',
    thresholdReset: 'Reset cutoff',
    outcomeFlipped: 'Outcome flipped',
    outcomeUnchanged: 'Same outcome',
    outcomeComparison: 'Original: {original} → Edited: {edited}. Compared at the same policy and threshold.',
    adjustedPosition: 'Adjusted position',
    adjustedSamePosition: 'Adjusted profile · same GPA/SAT position',
    chartAxisNote: 'The chart maps GPA and SAT. A background change can alter the decision without moving the point.',
    reset: 'Reset',
    selectStudent: 'Select a student from the chart',
    selectStudentDesc: 'Then test whether a small academic or background change alters the automated decision.',
    decisionScore: 'Decision score',
    scoreHelpTitle: 'How does the decision score work?',
    scoreHelpDescription: 'The selected policy combines GPA, SAT, and any background factors it uses into a score. Different policies give these factors different importance.',
    scoreHelpRule: 'The cutoff for this policy is {cutoff}. A score at or above {cutoff} means admitted in this simulation; a lower score means not admitted.',
    scoreHelpCaution: 'This score is not an admission probability or a measure of a student\'s worth.',
    cutoff: 'Cutoff',
    flipQuestion: 'The result flipped. Which factor caused it, and should it matter?',
    changeQuestion: 'Change one factor until the result flips. Should that factor matter?',
    auditNote: 'Background changes audit the policy; they are not advice for students.',
    datasetSynthetic: 'Synthetic classroom dataset · {count} simulated applicants · No real student data',
    datasetApproved: 'Approved de-identified dataset · {count} records · Public classroom view',
    datasetLoading: 'Loading the classroom dataset…',
    datasetFallback: 'Data API unavailable · Bundled synthetic demo in use',
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
        shortName: 'More points for first-generation students',
        description: 'GPA and SAT still matter, but count less than in Whole-Person Review. First-generation status counts more; athlete and in-state bonuses still apply.',
        details: [
          'First-generation status adds {firstGen} score points here, compared with {comparisonFirstGen} in Whole-Person Review. With other factors equal, this can change who qualifies.',
          'The starting cutoff is {cutoff}, compared with {comparisonCutoff}. You can change it with the threshold slider.',
        ],
        caution: 'First-generation status does not capture every student’s circumstances. This policy is not automatically fairer—it is a different rule to examine.',
        question: 'Who benefits from this rule, and what might it overlook?',
      },
    },
  },
  zh: {
    prototype: '简化版原型',
    credits: '项目团队',
    themeGraphite: '石墨',
    themeSummer: '夏日',
    themeLight: '亮色',
    switchTheme: '切换主题',
    languageLabel: '语言',
    mineEdgeCases: '查看临界案例',
    edgeCasesFound: '名最接近录取线',
    fromCutoff: '距录取线',
    visualizer: '反事实可视化',
    visualizerSubtitle: '移动录取线，看看谁会被录取。',
    boundaryHelpTitle: '如何理解录取边界',
    boundaryShared: '所有学生共用的录取线',
    boundaryBand: '背景可能影响结果的区域',
    boundarySelected: '当前学生背景对应的录取线',
    boundaryEdited: '实线：修改后背景 · 虚线：原始背景',
    boundaryOriginalEdge: '修改后背景 · 原始录取线位于图表边缘或外侧',
    boundaryAll: '这一背景下，图内所有分数均符合条件',
    boundaryNone: '这一背景下，图内没有符合条件的分数',
    boundaryEdge: '录取线位于图表边缘',
    boundaryAcademicHelp: '线上各点的分数等于阈值。Academic Focus 只使用 GPA 和 SAT，因此所有学生共用一条线。恰好在线上的学生也会被录取。',
    boundaryContextHelp: '另外两项政策还考虑一代生、运动员和州内居民身份。阴影带覆盖全部八种背景组合对应的录取线范围。在这一区域内，同样的 GPA 和 SAT 可能产生不同结果。',
    boundarySelectedHelp: '选中学生后，显示其背景对应的准确录取线。如果编辑改变了背景加分，实线对应修改后的背景，虚线保留原始背景。其他学生仍按各自背景评分和着色。',
    boundaryFormula: 'GPA 得分 + SAT 得分 + 背景得分 = 阈值',
    whatIfStudent: '假设调整后的学生',
    originalProfile: '原始档案 · 尚未调整',
    controlsLabel: '探索与调整',
    aboutPolicy: '了解这项政策',
    choosePolicy: '政策工作台',
    choosePolicyDesc: '选择一项政策：录取应该重视什么？',
    remember: '请记住',
    simulationNote: '这是一个简化的模拟实验，并非真实录取系统。政策反映的是人类对于“什么重要”的选择。',
    seeAffected: '观察谁受到影响',
    seeAffectedDesc: '每个点代表一名模拟学生。点击任意点，进一步审查这项决定。',
    seeAffectedDescApproved: '每个点代表获准公开的课堂数据中的一条记录。点击任意点，进一步审查这项决定。',
    chartLabel: '录取结果图。横轴为 GPA，纵轴为 SAT。请选择一个学生样本点来审查这项决定。',
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
    compareOutcomes: '群体结果',
    gapCaution: '录取率差距是调查线索，不能单独证明存在偏见。',
    admittedFraction: '{admitted}/{total}',
    admittedCountLabel: '{total} 名学生中有 {admitted} 名被录取',
    lowerRateLabel: '{group}低 {gap} 个百分点',
    pointsLower: '低 {gap} 个百分点',
    rateIncrease: '录取率比刚才上升，现为 {rate}%。',
    rateDecrease: '录取率比刚才下降，现为 {rate}%。',
    sameRateLabel: '两个群体的录取率相同。',
    sameRateShort: '录取率相同',
    firstGenStatus: '第一代身份',
    athleticStatus: '运动员',
    residency: '居住地',
    discuss: '讨论',
    reflectionLabel: '写下你的思考（不会保存）',
    reflectionPlaceholder: '公平还是不公平？为什么？',
    whatIfTitle: '反事实编辑器',
    whatIfDesc: '如果这名学生有所不同呢？',
    thresholdTitle: '录取阈值',
    thresholdRule: '分数 ≥ 阈值 → 录取',
    thresholdHelpTitle: '阈值改变了什么？',
    thresholdHelp: '阈值就是录取所需的最低决策分数。提高阈值会让录取更严格，降低阈值会让更多学生符合条件。它改变的是所有人的录取标准，而不是学生的特征。',
    thresholdPreset: '切换政策会加载该政策的建议阈值；重置可以恢复建议值。拖动阈值不会改变政策的各项权重。',
    thresholdDefault: '建议值：{value}',
    thresholdReset: '重置阈值',
    outcomeFlipped: '结果已反转',
    outcomeUnchanged: '结果未改变',
    outcomeComparison: '原始：{original} → 修改后：{edited}。两者使用相同的政策与阈值。',
    adjustedPosition: '调整后位置',
    adjustedSamePosition: '背景已调整 · GPA/SAT 坐标不变',
    chartAxisNote: '图中只映射 GPA 和 SAT；背景变化可能在点不移动时仍改变决定。',
    reset: '重置',
    selectStudent: '请从图中选择一名学生',
    selectStudentDesc: '然后测试较小的学业或背景变化是否会改变自动化决定。',
    decisionScore: '决策分数',
    scoreHelpTitle: '决策分数是怎么算的？',
    scoreHelpDescription: '所选政策把 GPA、SAT 和它所考虑的背景因素合成为一个分数。不同政策对这些因素的重视程度不同。',
    scoreHelpRule: '这项政策的录取线是 {cutoff}。在这个模拟中，分数达到或超过 {cutoff} 就会被录取，低于录取线则不被录取。',
    scoreHelpCaution: '这个分数不是录取概率，也不是对学生个人价值的评价。',
    cutoff: '录取线',
    flipQuestion: '结果翻转了。哪个因素造成了变化？它应该重要吗？',
    changeQuestion: '改变一个因素直到结果翻转。这个因素应该重要吗？',
    auditNote: '改变背景是审查政策，并非给学生的建议。',
    datasetSynthetic: '合成课堂数据 · {count} 名模拟申请者 · 不含真实学生数据',
    datasetApproved: '已授权的去标识化数据 · {count} 条记录 · 公开课堂视图',
    datasetLoading: '正在载入课堂数据…',
    datasetFallback: '数据 API 暂不可用 · 当前使用内置合成演示数据',
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
        shortName: '给第一代大学生更多加分',
        description: 'GPA 和 SAT 仍然重要，但比“综合评估”占比更低；第一代大学生身份的加分更多。运动员和州内居民的加分仍然保留。',
        details: [
          '第一代大学生身份在这里加 {firstGen} 分，而“综合评估”加 {comparisonFirstGen} 分。在其他条件相同时，这可能改变录取结果。',
          '默认录取线是 {cutoff}，而“综合评估”是 {comparisonCutoff}。你仍然可以用阈值滑块调整它。',
        ],
        caution: '第一代大学生身份不能完整反映一个人的处境。这项政策不自动等于更公平，而是另一套值得检验的规则。',
        question: '这套规则让谁受益，又可能忽略什么？',
      },
    },
  },
  es: {
    prototype: 'PROTOTIPO SIMPLIFICADO',
    credits: 'Créditos',
    themeGraphite: 'Grafito',
    themeSummer: 'Verano',
    themeLight: 'Claro',
    switchTheme: 'Cambiar tema',
    languageLabel: 'Idioma',
    mineEdgeCases: 'Buscar casos límite',
    edgeCasesFound: 'más cerca del corte',
    fromCutoff: 'del corte',
    visualizer: 'Visualizador contrafactual',
    visualizerSubtitle: 'Mueve el corte. Explora quién es admitido.',
    boundaryHelpTitle: 'Cómo leer el límite de admisión',
    boundaryShared: 'Límite de admisión común',
    boundaryBand: 'Zona dependiente del contexto',
    boundarySelected: 'Corte para el contexto de este estudiante',
    boundaryEdited: 'Continua: contexto editado · discontinua: original',
    boundaryOriginalEdge: 'Contexto editado · corte original en/fuera del borde',
    boundaryAll: 'Todos los puntajes del gráfico califican con este contexto',
    boundaryNone: 'Ningún puntaje del gráfico califica con este contexto',
    boundaryEdge: 'Corte en el borde del gráfico',
    boundaryAcademicHelp: 'La línea marca puntuación = umbral. Academic Focus solo usa GPA y SAT, por lo que la misma línea sirve para todos. Los puntos sobre la línea se admiten.',
    boundaryContextHelp: 'Las otras políticas también usan primera generación, deporte y residencia. La banda abarca los cortes de las ocho combinaciones de contexto. Dentro de ella, el mismo GPA y SAT pueden dar decisiones diferentes.',
    boundarySelectedHelp: 'Selecciona un estudiante para ver su corte exacto. Si cambia la puntuación de contexto, la línea continua sigue al perfil editado y la discontinua mantiene el original. Los demás estudiantes conservan su propio contexto y color.',
    boundaryFormula: 'Puntos GPA + puntos SAT + puntos de contexto = umbral',
    whatIfStudent: 'Estudiante hipotético',
    originalProfile: 'Perfil original · sin cambios',
    controlsLabel: 'Controles de exploración',
    aboutPolicy: 'Acerca de esta política',
    choosePolicy: 'Estudio de políticas',
    choosePolicyDesc: 'Elige una política. ¿Qué debería valorar la admisión?',
    remember: 'Recuerda',
    simulationNote: 'Esta es una simulación simplificada, no un sistema real de admisión. La política refleja decisiones humanas sobre lo que importa.',
    seeAffected: 'Observa a quién afecta',
    seeAffectedDesc: 'Cada punto representa a un estudiante simulado. Haz clic para investigar una decisión.',
    seeAffectedDescApproved: 'Cada punto es un registro de la versión autorizada para clase. Haz clic para investigar una decisión.',
    chartLabel: 'Gráfico de resultados de admisión. GPA está en el eje horizontal y SAT en el vertical. Selecciona un punto para investigar la decisión.',
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
    compareOutcomes: 'Resultados por grupo',
    gapCaution: 'Una diferencia de tasas es una pista, no una prueba de sesgo.',
    admittedFraction: '{admitted}/{total}',
    admittedCountLabel: '{admitted} de {total} estudiantes admitidos',
    lowerRateLabel: '{group}: {gap} puntos menos',
    pointsLower: '{gap} pts menos',
    rateIncrease: 'La tasa de admisión subió al {rate}% desde el último cambio.',
    rateDecrease: 'La tasa de admisión bajó al {rate}% desde el último cambio.',
    sameRateLabel: 'Ambos grupos tienen la misma tasa de admisión.',
    sameRateShort: 'Misma tasa',
    firstGenStatus: 'Primera generación',
    athleticStatus: 'Deporte',
    residency: 'Residencia',
    discuss: 'Debate',
    reflectionLabel: 'Tu reflexión (no se guarda)',
    reflectionPlaceholder: '¿Justa o injusta? ¿Por qué?',
    whatIfTitle: 'Editor contrafactual',
    whatIfDesc: '¿Y si cambiamos este caso?',
    thresholdTitle: 'Umbral de admisión',
    thresholdRule: 'Puntuación ≥ umbral → admisión',
    thresholdHelpTitle: '¿Qué cambia el umbral?',
    thresholdHelp: 'El umbral es la puntuación mínima para la admisión. Subirlo hace la admisión más selectiva; bajarlo permite que más estudiantes cumplan el requisito. Cambia la regla para todos, no el perfil de ningún estudiante.',
    thresholdPreset: 'Al cambiar de política se carga su umbral sugerido. Restablecer recupera ese valor; mover el control no cambia los pesos de la política.',
    thresholdDefault: 'Sugerido: {value}',
    thresholdReset: 'Restablecer umbral',
    outcomeFlipped: 'Resultado cambiado',
    outcomeUnchanged: 'Mismo resultado',
    outcomeComparison: 'Original: {original} → Editado: {edited}. Comparados con la misma política y el mismo umbral.',
    adjustedPosition: 'Posición ajustada',
    adjustedSamePosition: 'Perfil ajustado · misma posición GPA/SAT',
    chartAxisNote: 'El gráfico representa GPA y SAT. Un cambio de contexto puede alterar la decisión sin mover el punto.',
    reset: 'Restablecer',
    selectStudent: 'Selecciona un estudiante en el gráfico',
    selectStudentDesc: 'Después prueba si un pequeño cambio académico o de contexto altera la decisión automatizada.',
    decisionScore: 'Puntuación de decisión',
    scoreHelpTitle: '¿Cómo funciona la puntuación?',
    scoreHelpDescription: 'La política elegida combina GPA, SAT y los factores de contexto que utiliza en una puntuación. Cada política les da distinta importancia.',
    scoreHelpRule: 'El corte de esta política es {cutoff}. Una puntuación igual o superior a {cutoff} significa admisión en esta simulación; una inferior significa no admisión.',
    scoreHelpCaution: 'No es una probabilidad de admisión ni una medida del valor de una persona.',
    cutoff: 'Corte',
    flipQuestion: 'El resultado cambió. ¿Qué factor lo causó y debería importar?',
    changeQuestion: 'Cambia un factor hasta invertir el resultado. ¿Debería importar?',
    auditNote: 'Cambiar el contexto audita la política; no aconseja a estudiantes.',
    datasetSynthetic: 'Datos sintéticos para clase · {count} solicitantes simulados · Sin datos reales',
    datasetApproved: 'Datos desidentificados autorizados · {count} registros · Vista pública',
    datasetLoading: 'Cargando los datos para clase…',
    datasetFallback: 'API de datos no disponible · Se usa la demostración sintética incluida',
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
        shortName: 'Más puntos para estudiantes de primera generación',
        description: 'El GPA y el SAT siguen contando, pero menos que en Evaluación integral. Ser de primera generación suma más; se mantienen los puntos por deporte y residencia en el estado.',
        details: [
          'Ser de primera generación añade {firstGen} puntos, frente a {comparisonFirstGen} en Evaluación integral. Con los demás factores iguales, esto puede cambiar la decisión.',
          'El corte inicial es {cutoff}, frente a {comparisonCutoff}. Puedes cambiarlo con el control del umbral.',
        ],
        caution: 'Ser de primera generación no refleja todas las circunstancias de una persona. Esta política no es automáticamente más justa: es otra regla que examinar.',
        question: '¿A quién beneficia esta regla y qué podría pasar por alto?',
      },
    },
  },
};

const formatCopy = (template, values) => Object.entries(values).reduce(
  (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
  template,
);

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
        {t.decisionScore}: {score.toFixed(1)} · {t.cutoff} {policy.threshold} · {distance.toFixed(1)} {t.fromCutoff}
      </div>
      <div className="mt-1 text-slate-500">
        {[student.firstGen && t.firstGeneration, student.athlete && t.athlete, student.resident && t.inState]
          .filter(Boolean)
          .join(' · ') || t.noContextFlags}
      </div>
    </div>
  );
};

const RateValue = ({ groupLabel, stats, lowerNote, isLower, t }) => {
  const [change, setChange] = useState({ rate: stats.rate, direction: null, revision: 0 });
  // Track changes to the displayed percentage, not unrelated renders (theme, language, editor).
  if (change.rate !== stats.rate) {
    setChange({ rate: stats.rate, direction: stats.rate > change.rate ? 'up' : 'down', revision: change.revision + 1 });
  }
  useEffect(() => {
    if (!change.direction) return;
    const timer = window.setTimeout(() => {
      setChange(current => current.revision === change.revision ? { ...current, direction: null } : current);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [change.direction, change.revision]);
  const countLabel = formatCopy(t.admittedCountLabel, stats);
  const rateLabel = change.direction
    ? formatCopy(change.direction === 'up' ? t.rateIncrease : t.rateDecrease, { rate: stats.rate })
    : `${stats.rate}%`;
  return (
    <div className="simplified-rate-group workspace-rate-value rounded-lg bg-slate-900" data-direction={change.direction || 'steady'}>
      <div className="workspace-rate-label font-semibold text-slate-400">{groupLabel}</div>
      <div className="workspace-rate-numbers">
        <strong className="workspace-rate-current" aria-label={rateLabel} title={rateLabel}>
          {stats.rate}%<span className="workspace-rate-direction" aria-hidden="true">{change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : ''}</span>
        </strong>
        <span className="text-slate-500" title={countLabel} aria-label={countLabel}>{formatCopy(t.admittedFraction, stats)}</span>
      </div>
      <div className="workspace-rate-note font-semibold text-slate-400" style={{ visibility: isLower ? 'visible' : 'hidden' }} aria-hidden={!isLower}>{lowerNote}</div>
    </div>
  );
};

const RateComparison = ({ label, leftLabel, leftStats, rightLabel, rightStats, t }) => {
  const gap = Math.abs(leftStats.rate - rightStats.rate);
  const lowerRateGroup = leftStats.rate <= rightStats.rate ? leftLabel : rightLabel;
  const comparisonText = gap === 0
    ? t.sameRateLabel
    : formatCopy(t.lowerRateLabel, { group: lowerRateGroup, gap });
  const lowerNote = formatCopy(t.pointsLower, { gap });

  return (
    <div className="workspace-rate-row border-b border-slate-800 last:border-b-0" role="group" aria-label={`${label}. ${comparisonText}`}>
      <div className="workspace-rate-category font-bold text-slate-200">{label}</div>
      {[[leftLabel, leftStats, rightStats], [rightLabel, rightStats, leftStats]].map(([groupLabel, stats, other], index) => (
        <RateValue key={index} groupLabel={groupLabel} stats={stats} isLower={stats.rate < other.rate} lowerNote={lowerNote} t={t} />
      ))}
    </div>
  );
};

const StudentDot = ({ cx, cy, fill, fillOpacity, stroke, strokeWidth, className, style, payload, highlightEdge }) => (
  <g className={`recharts-symbols ${className || ''}`} style={style}>
    <circle cx={cx} cy={cy} r="12" fill="transparent" stroke="transparent" />
    {highlightEdge && <circle className="workspace-edge-halo" cx={cx} cy={cy} r="9" fill="none" strokeWidth="1.75" pointerEvents="none" />}
    {payload?.admitted ? (
      <circle
        cx={cx}
        cy={cy}
        r="5.5"
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    ) : (
      <rect
        x={cx - 4.5}
        y={cy - 4.5}
        width="9"
        height="9"
        rx="1.5"
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        transform={`rotate(45 ${cx} ${cy})`}
      />
    )}
  </g>
);

const AdjustedPositionMarker = ({ cx, cy, draftDecision, isLight, samePosition, darkPalette }) => {
  const outcomeColor = draftDecision
    ? (isLight ? LIGHT_OUTCOME_COLORS.admitted : darkPalette.admitted)
    : (isLight ? LIGHT_OUTCOME_COLORS.rejected : darkPalette.rejected);
  const surfaceColor = isLight ? '#f8fafc' : darkPalette.surface;

  return (
    <g className="counterfactual-position-marker" pointerEvents="none">
      <circle
        cx={cx}
        cy={cy}
        r={samePosition ? 11 : 9}
        fill={isLight ? 'rgba(247, 245, 251, 0.9)' : darkPalette.markerFill}
        stroke={isLight ? '#7c3aed' : darkPalette.accent}
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

const BoundaryLine = ({ boundary, color, kind, dashed = false, width = 2.5 }) => {
  if (!boundary?.points.length) return null;
  if (boundary.points.length === 1) return <ReferenceDot className={`workspace-boundary-${kind}`} x={boundary.points[0].x} y={boundary.points[0].y} r={4} fill={color} stroke={color} style={{ pointerEvents: 'none' }} />;
  // Geometry is already clipped to the data domain; clip pixels rather than discard
  // the whole segment when the chart scale rounds an edge a fraction out of range.
  return <ReferenceLine className={`workspace-boundary-${kind}`} segment={boundary.points} ifOverflow="hidden" stroke={color} strokeWidth={width} strokeDasharray={dashed ? '6 5' : undefined} strokeLinecap="round" style={{ pointerEvents: 'none' }} />;
};

const SimplifiedApp = () => {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const [showCredits, setShowCredits] = useState(false);
  const [isMining, setIsMining] = useState(false);
  const [policyId, setPolicyId] = useState('academic');
  const [thresholdOverride, setThresholdOverride] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draftStudent, setDraftStudent] = useState(null);
  const [explainedPolicyId, setExplainedPolicyId] = useState(null);
  const policyHelpTrigger = useRef(null);
  const [classroomView, setClassroomView] = useState(createBundledClassroomView);
  const [dataState, setDataState] = useState(isClassroomApiConfigured ? 'loading' : 'bundled');
  const [dataError, setDataError] = useState('');
  const trackedPageView = useRef('');
  const decisionBadgeRef = useRef(null);
  const previousDecision = useRef(null);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const explainedPolicy = explainedPolicyId ? t.policies[explainedPolicyId] : null;
  useEffect(() => {
    if (!explainedPolicyId) return;
    const dismissOutside = (event) => {
      if (!event.target.closest?.('[data-policy-help], .workspace-policy-info, .workspace-inline-help')) {
        setExplainedPolicyId(null);
      }
    };
    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') {
        setExplainedPolicyId(null);
        policyHelpTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [explainedPolicyId]);
  const students = classroomView.records;
  const policies = useMemo(
    () => classroomView.policies.map((item) => ({
      ...item,
      ...(POLICY_PRESENTATION[item.id] ?? {
        accent: '#2563eb',
        graphiteAccent: '#78b7ff',
        summerAccent: '#43d3c1',
      }),
    })),
    [classroomView.policies],
  );
  const explainedPolicySettings = policies.find(item => item.id === explainedPolicyId);
  const comparisonPolicySettings = policies.find(item => item.id === 'holistic');
  const isLight = theme === 'light';
  const darkPalette = DARK_THEME_PALETTES[isLight ? 'graphite' : theme];
  const outcomeColors = {
    admitted: isLight ? LIGHT_OUTCOME_COLORS.admitted : darkPalette.admitted,
    rejected: isLight ? LIGHT_OUTCOME_COLORS.rejected : darkPalette.rejected,
  };
  const themeLabels = {
    graphite: t.themeGraphite,
    summer: t.themeSummer,
    light: t.themeLight,
  };
  const nextTheme = THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(theme) + 1) % THEME_SEQUENCE.length];
  const ThemeIcon = theme === 'graphite' ? Moon : theme === 'summer' ? Sunset : Sun;
  const presetPolicy = policies.find((item) => item.id === policyId) || policies[0];
  const policy = useMemo(
    () => ({ ...presetPolicy, threshold: thresholdOverride ?? presetPolicy.threshold }),
    [presetPolicy, thresholdOverride],
  );
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedId) || null,
    [selectedId, students],
  );
  const boundaryBand = useMemo(() => backgroundBoundaryBand(policy), [policy]);
  const originalBackground = backgroundScore(selectedStudent, policy);
  const editedBackground = backgroundScore(draftStudent, policy);
  const backgroundBoundaryChanged = Boolean(selectedStudent && draftStudent && Math.abs(originalBackground - editedBackground) > 1e-9);
  const currentBoundary = useMemo(
    () => !boundaryBand.hasContext || draftStudent ? admissionBoundary(policy, editedBackground) : null,
    [boundaryBand.hasContext, draftStudent, editedBackground, policy],
  );
  const originalBoundary = useMemo(
    () => backgroundBoundaryChanged ? admissionBoundary(policy, originalBackground) : null,
    [backgroundBoundaryChanged, originalBackground, policy],
  );
  const boundaryCaption = currentBoundary?.points.length === 0
    ? (currentBoundary.relation === 'all-admitted' ? t.boundaryAll : t.boundaryNone)
    : currentBoundary?.points.length === 1
      ? t.boundaryEdge
      : !boundaryBand.hasContext ? t.boundaryShared
        : !draftStudent ? (boundaryBand.polygon.length ? t.boundaryBand : t.boundaryEdge)
          : backgroundBoundaryChanged ? (originalBoundary.points.length < 2 ? t.boundaryOriginalEdge : t.boundaryEdited) : t.boundarySelected;

  const outcomes = useMemo(
    () => students.map((student) => ({ ...student, admitted: getDecision(student, policy) })),
    [policy, students],
  );

  const policyAdmissionCounts = useMemo(
    () => Object.fromEntries(
      policies.map((item) => [
        item.id,
        students.filter((student) => getDecision(student, item.id === policy.id ? policy : item)).length,
      ]),
    ),
    [policies, policy, students],
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
  const datasetId = classroomView.dataset.id;
  const datasetVersion = classroomView.dataset.version;

  useEffect(() => {
    let active = true;
    loadClassroomView()
      .then(({ view, source }) => {
        if (!active) return;
        setClassroomView(view);
        setDataState(source);
        setDataError('');
        setPolicyId((current) => (
          view.policies.some((item) => item.id === current) ? current : view.policies[0].id
        ));
        setSelectedId(null);
        setDraftStudent(null);
        setThresholdOverride(null);
      })
      .catch((error) => {
        if (!active) return;
        setDataState('error');
        setDataError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dataState === 'loading') return;
    const pageViewKey = `${datasetId}:${datasetVersion}:${dataState}`;
    if (trackedPageView.current === pageViewKey) return;
    trackedPageView.current = pageViewKey;
    trackAnonymousEvent('page_view', {
      datasetId,
      datasetVersion,
      policyId: policy.id,
      locale: lang,
      theme,
    });
  }, [dataState, datasetId, datasetVersion, lang, policy.id, theme]);

  useEffect(() => {
    const previous = previousDecision.current;
    previousDecision.current = { studentId: selectedId, admitted: draftDecision };
    if (!selectedId || previous?.studentId !== selectedId || previous.admitted === draftDecision) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = decisionBadgeRef.current?.animate([
      { transform: 'perspective(400px) rotateX(-18deg) scale(.97)', boxShadow: '0 0 0 0 var(--workspace-edit-ring)' },
      { transform: 'perspective(400px) rotateX(0) scale(1.06)', boxShadow: '0 0 0 7px var(--workspace-edit-ring)', offset: .45 },
      { transform: 'perspective(400px) rotateX(0) scale(1)', boxShadow: '0 0 0 0 var(--workspace-edit-ring)' },
    ], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
    return () => animation?.cancel();
  }, [draftDecision, selectedId]);

  const updateDraft = (field, value) => {
    if (!draftStudent) return;
    const nextStudent = { ...draftStudent, [field]: value };
    // Only count a counterfactual flip caused by editing the student, not by changing the policy/cutoff.
    if (!decisionFlipped && getDecision(nextStudent, policy) !== originalDecision) {
      trackAnonymousEvent('counterfactual_flipped', {
        datasetId,
        datasetVersion,
        policyId: policy.id,
        locale: lang,
        theme,
      });
    }
    setDraftStudent(nextStudent);
  };

  const selectStudent = (studentId) => {
    const student = students.find((item) => item.id === studentId) || null;
    setSelectedId(studentId);
    setDraftStudent(student ? { ...student } : null);
    if (student) {
      trackAnonymousEvent('student_selected', {
        datasetId,
        datasetVersion,
        policyId: policy.id,
        locale: lang,
        theme,
      });
    }
  };

  const datasetStatus = dataState === 'loading'
    ? t.datasetLoading
    : dataState === 'error'
      ? t.datasetFallback
      : formatCopy(
        classroomView.dataset.sourceType === 'synthetic' ? t.datasetSynthetic : t.datasetApproved,
        { count: students.length },
      );

  return (
    <div className={`simplified-app text-slate-200 selection:bg-blue-500/30 ${isLight ? 'theme-daylight simplified-daylight' : `simplified-observatory ${theme === 'summer' ? 'simplified-summer' : ''}`}`}>
      {showCredits && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowCredits(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0f131a] p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30">
                  <Telescope className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">CounterLens</div>
                  <h2 id="credits-title" className="text-xl font-bold text-white">{t.creditsTitle}</h2>
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

      <div className="simplified-shell">
        <header className="mb-3 flex shrink-0 flex-col justify-between gap-3 border-b border-slate-800 pb-3 md:flex-row md:items-center xl:mb-2.5 xl:pb-2.5">
          <div className="flex items-center gap-3.5">
            <div className="workspace-brand-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30">
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
            <ClassroomSurvey lang={lang} />
            <button
              type="button"
              onClick={() => {
                setTheme(nextTheme);
                trackAnonymousEvent('theme_changed', {
                  datasetId,
                  datasetVersion,
                  policyId: policy.id,
                  locale: lang,
                  theme: nextTheme,
                });
              }}
              aria-label={`${t.switchTheme}: ${themeLabels[nextTheme]}`}
              title={`${t.switchTheme}: ${themeLabels[nextTheme]}`}
              className="flex w-[112px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
            >
              <ThemeIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{themeLabels[theme]}</span>
            </button>
            <div className="flex rounded-xl border border-slate-800 bg-slate-900/70 p-1" role="group" aria-label={t.languageLabel}>
              {[
                ['en', 'EN'],
                ['zh', '中文'],
                ['es', 'ES'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={lang === code}
                  onClick={() => {
                    setLang(code);
                    trackAnonymousEvent('language_changed', {
                      datasetId,
                      datasetVersion,
                      policyId: policy.id,
                      locale: code,
                      theme,
                    });
                  }}
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

        <main className="simplified-workspace">

          <section className="workspace-visualizer simplified-panel flex flex-col rounded-2xl border border-slate-800 bg-slate-900/65 shadow-xl shadow-black/10">
              <div className="workspace-visualizer-heading">
                <div className="workspace-visualizer-intro">
                  <h2 className="workspace-visualizer-title font-bold text-white">{t.visualizer}</h2>
                  <p className="workspace-visualizer-subtitle text-slate-400">{t.visualizerSubtitle}</p>
                </div>
                <div className="workspace-visualizer-actions">
                <button
                  type="button"
                  aria-pressed={isMining}
                  title={`${edgeCases.length} ${t.edgeCasesFound}`}
                  onClick={() => {
                    const nextMiningState = !isMining;
                    setIsMining(nextMiningState);
                    if (nextMiningState) {
                      trackAnonymousEvent('borderline_cases_opened', {
                        datasetId, datasetVersion, policyId: policy.id, locale: lang, theme,
                      });
                    }
                  }}
                  className={`workspace-edge-button flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    isMining
                      ? 'workspace-edge-active'
                      : 'border-slate-700 bg-slate-950/45 text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="h-3.5 w-3.5" />
                  {t.mineEdgeCases}
                  <span className="rounded px-1 text-[10px]" style={{ visibility: isMining ? 'visible' : 'hidden', background: 'var(--workspace-edge-ring)' }} aria-hidden={!isMining}>{edgeCases.length}</span>
                </button>
                <div className="simplified-outcome-legend grid shrink-0 justify-items-start gap-1 pt-0.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: outcomeColors.admitted }} />
                    {t.admitted}
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-300">
                    <span className="h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: outcomeColors.rejected }} />
                    {t.notAdmitted}
                  </span>
                  <span className="workspace-adjusted-legend flex items-center gap-1.5 font-medium" style={{ visibility: draftProfileChanged ? 'visible' : 'hidden' }} aria-hidden={!draftProfileChanged}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed" />
                    {t.whatIfStudent}
                  </span>
                </div>
                </div>
              </div>


              <div
                className="simplified-inset simplified-scatter-plot w-full rounded-xl border border-slate-800/80 bg-slate-950/45 p-2"
                role="group"
                aria-label={t.chartLabel}
                onMouseDown={(event) => { if (!event.target.closest?.('[data-boundary-ui]')) event.preventDefault(); }}
                onClick={(event) => {
                  if (!event.target.closest?.('.recharts-scatter-symbol, [data-boundary-ui]')) {
                    setSelectedId(null);
                    setDraftStudent(null);
                  }
                }}
              >
                <span className="sr-only">{t.chartLabel}</span>
                <div data-boundary-ui className="workspace-boundary-key">
                  <span className={`workspace-boundary-swatch ${boundaryBand.hasContext && !draftStudent ? 'is-band' : ''} ${backgroundBoundaryChanged ? 'is-edited' : ''}`} aria-hidden="true" />
                  <span className="workspace-boundary-caption" title={boundaryCaption}>{boundaryCaption}</span>
                  <button type="button" className="workspace-inline-help rounded-md" aria-label={t.boundaryHelpTitle} aria-expanded={explainedPolicyId === 'boundary'} aria-controls="boundary-help" onClick={(event) => {
                    policyHelpTrigger.current = event.currentTarget;
                    setExplainedPolicyId(explainedPolicyId === 'boundary' ? null : 'boundary');
                  }}><Info className="h-3.5 w-3.5" /></button>
                </div>
                {explainedPolicyId === 'boundary' && (
                  <div id="boundary-help" data-boundary-ui data-policy-help role="region" aria-labelledby="boundary-help-title" className="workspace-boundary-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <h3 id="boundary-help-title" className="text-sm font-bold text-white">{t.boundaryHelpTitle}</h3>
                      <button type="button" className="rounded-md p-1" aria-label={t.close} onClick={() => { setExplainedPolicyId(null); policyHelpTrigger.current?.focus(); }}><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2">{boundaryBand.hasContext ? t.boundaryContextHelp : t.boundaryAcademicHelp}</p>
                    {boundaryBand.hasContext && <p className="mt-2">{t.boundarySelectedHelp}</p>}
                    <p className="mt-2 font-semibold text-blue-300">{t.boundaryFormula}</p>
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 32, right: 24, bottom: 22, left: 4 }}>
                    <CartesianGrid stroke={isLight ? '#dbe3ee' : darkPalette.grid} strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      type="number"
                      dataKey="gpa"
                      domain={[2.4, 4]}
                      ticks={[2.4, 2.8, 3.2, 3.6, 4]}
                      stroke={isLight ? '#94a3b8' : darkPalette.axis}
                      tick={{ fill: isLight ? '#475569' : darkPalette.muted, fontSize: 11 }}
                      label={{ value: 'GPA', position: 'insideBottomRight', offset: -12, fill: isLight ? '#475569' : darkPalette.muted, fontSize: 12 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="sat"
                      domain={[950, 1600]}
                      ticks={[1000, 1200, 1400, 1600]}
                      stroke={isLight ? '#94a3b8' : darkPalette.axis}
                      tick={{ fill: isLight ? '#475569' : darkPalette.muted, fontSize: 11 }}
                      label={{ value: 'SAT', angle: -90, position: 'insideLeft', offset: 12, fill: isLight ? '#475569' : darkPalette.muted, fontSize: 12 }}
                    />
                    {boundaryBand.polygon.length > 0 && (
                      <ReferenceArea x1={2.4} x2={4} y1={950} y2={1600} zIndex={-50} shape={({ x, y, width, height }) => (
                        Number.isFinite(width) && Number.isFinite(height)
                          ? <polygon className="workspace-boundary-band" points={boundaryBand.polygon.map(p => `${x + p.x * width},${y + (1 - p.y) * height}`).join(' ')} fill="var(--workspace-edit)" fillOpacity={isLight ? .075 : .12} stroke="none" pointerEvents="none" />
                          : <g />
                      )} />
                    )}
                    {boundaryBand.hasContext && !draftStudent && boundaryBand.edges.map((boundary, index) => (
                      <BoundaryLine key={index} boundary={boundary} color="var(--workspace-edit)" kind="envelope" dashed width={1.5} />
                    ))}
                    <BoundaryLine boundary={originalBoundary} color="var(--workspace-highlight)" kind="original" dashed width={1.75} />
                    <BoundaryLine boundary={currentBoundary} color={backgroundBoundaryChanged ? 'var(--workspace-edit)' : 'var(--workspace-highlight)'} kind="current" />
                    {selectedStudent && (
                      <>
                        <ReferenceLine
                          x={selectedStudent.gpa}
                          stroke={isLight ? '#2563eb' : darkPalette.primary}
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          strokeOpacity={0.9}
                        />
                        <ReferenceLine
                          y={selectedStudent.sat}
                          stroke={isLight ? '#2563eb' : darkPalette.primary}
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
                          stroke={isLight ? '#7c3aed' : darkPalette.accent}
                          strokeDasharray="2 5"
                          strokeWidth={1.25}
                          strokeOpacity={0.68}
                          style={{ pointerEvents: 'none' }}
                        />
                        <ReferenceLine
                          y={draftStudent.sat}
                          stroke={isLight ? '#7c3aed' : darkPalette.accent}
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
                          stroke={isLight ? '#7c3aed' : darkPalette.connector}
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          strokeOpacity={0.9}
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    )}
                    <Tooltip
                      cursor={{ stroke: isLight ? '#94a3b8' : darkPalette.axis, strokeDasharray: '3 3' }}
                      content={<StudentTooltip policy={policy} t={t} />}
                      isAnimationActive={false}
                      animationDuration={0}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Scatter
                      data={outcomes}
                      isAnimationActive={false}
                      shape={(props) => <StudentDot {...props} highlightEdge={isMining && edgeCaseIds.has(props.payload?.id)} />}
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
                            fill={student.admitted ? outcomeColors.admitted : outcomeColors.rejected}
                            fillOpacity={isMining ? (isEdgeCase || isSelected ? 1 : 0.18) : (selectedId && !isSelected ? 0.6 : 1)}
                            stroke={
                              isSelected
                                ? (isLight ? '#2563eb' : darkPalette.primary)
                                : isMining && isEdgeCase
                                ? 'var(--workspace-edge)'
                                : (student.admitted
                                  ? (isLight ? '#065f46' : darkPalette.admittedStroke)
                                  : (isLight ? '#9f1239' : darkPalette.rejectedStroke))
                            }
                            strokeWidth={isSelected ? 2.5 : (isMining && isEdgeCase ? 2.5 : 1.15)}
                            className={isMining && isEdgeCase ? 'workspace-edge-case' : ''}
                            style={{
                              cursor: 'pointer',
                              filter: isMining && isEdgeCase
                                ? 'drop-shadow(0 0 4px var(--workspace-edge-glow))'
                                : (isSelected ? `drop-shadow(0 0 4px ${darkPalette.selectedGlow})` : 'none'),
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
                            darkPalette={darkPalette}
                          />
                        )}
                      />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <section className="workspace-threshold" aria-labelledby="threshold-title" style={{ '--threshold-position': `${policy.threshold}%` }}>
                <div className="workspace-threshold-heading">
                  <div className="workspace-threshold-name">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    <label id="threshold-title" htmlFor="admission-threshold">{t.thresholdTitle}</label>
                    <button type="button" className="workspace-inline-help rounded-md" aria-label={t.thresholdHelpTitle} aria-expanded={explainedPolicyId === 'threshold'} aria-controls="threshold-help" onClick={(event) => {
                      policyHelpTrigger.current = event.currentTarget;
                      setExplainedPolicyId(explainedPolicyId === 'threshold' ? null : 'threshold');
                    }}><Info className="h-4 w-4" /></button>
                  </div>
                  <div className="workspace-threshold-setting">
                    <output htmlFor="admission-threshold" className="workspace-threshold-value">{policy.threshold}<span> / 100</span></output>
                    <button type="button" className="workspace-threshold-reset" title={formatCopy(t.thresholdDefault, { value: presetPolicy.threshold })} disabled={policy.threshold === presetPolicy.threshold} onClick={() => setThresholdOverride(null)}>
                      <RotateCcw className="h-3 w-3" aria-hidden="true" /> {t.thresholdReset}
                    </button>
                  </div>
                </div>
                <div id="threshold-rule" className="workspace-threshold-rule">{t.thresholdRule}</div>
                <input id="admission-threshold" type="range" min="0" max="100" step="1" value={policy.threshold} aria-describedby="threshold-rule" onInput={(event) => setThresholdOverride(Number(event.currentTarget.value))} />
                <div className="workspace-threshold-summary">
                  <div><strong>{impact.admitted}</strong><span> / {students.length} {t.studentsAdmitted}</span></div>
                  <div>{t.overallRate}: <strong>{impact.overallRate}%</strong></div>
                </div>
                {explainedPolicyId === 'threshold' && (
                  <div id="threshold-help" data-policy-help role="region" aria-labelledby="threshold-help-title" className="workspace-threshold-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <h3 id="threshold-help-title" className="text-sm font-bold text-white">{t.thresholdHelpTitle}</h3>
                      <button type="button" aria-label={t.close} className="rounded-md p-1" onClick={() => { setExplainedPolicyId(null); policyHelpTrigger.current?.focus(); }}><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2">{t.thresholdHelp}</p>
                    <p className="mt-2">{t.thresholdPreset}</p>
                  </div>
                )}
              </section>

          </section>

          <aside className="workspace-controls" aria-label={t.controlsLabel}>
            <section className="workspace-policy simplified-panel rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/10">
              <div className="mb-2 flex items-start gap-2.5">
                <div className="simplified-step flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">1</div>
                <div>
                  <h2 className="text-base font-bold leading-tight text-white">{t.choosePolicy}</h2>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.choosePolicyDesc}</p>
                </div>
              </div>

              <div className="workspace-policy-options">
                {policies.map((item) => {
                  const active = item.id === policy.id;
                  const itemCopy = t.policies[item.id] ?? {
                    name: item.id,
                    shortName: 'Policy',
                    description: '',
                  };
                  const admittedCount = policyAdmissionCounts[item.id];
                  return (
                    <div key={item.id} className="workspace-policy-option">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setExplainedPolicyId(null);
                        setPolicyId(item.id);
                        setIsMining(false);
                        if (item.id !== policy.id) {
                          setThresholdOverride(null);
                          trackAnonymousEvent('policy_selected', {
                            datasetId,
                            datasetVersion,
                            policyId: item.id,
                            locale: lang,
                            theme,
                          });
                        }
                      }}
                      className={`simplified-policy-card w-full rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? 'simplified-selected border-blue-400/60 bg-blue-500/12 shadow-lg shadow-blue-500/5'
                          : 'simplified-inset border-slate-800 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <span className={`workspace-policy-name ${active ? 'font-semibold text-white' : 'font-semibold text-slate-300'}`}>{itemCopy.name}</span>
                      <span className="flex items-center justify-between gap-1.5 pr-7">
                          <span
                            className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] font-bold text-slate-400"
                            aria-label={`${admittedCount} / ${students.length} ${t.studentsAdmitted}`}
                          >
                            {admittedCount}/{students.length}
                          </span>
                          {active ? <CheckCircle2 className="h-4 w-4 text-blue-400" /> : <ArrowRight className="h-4 w-4 text-slate-600" />}
                      </span>
                      <span className="sr-only">{itemCopy.shortName}. {itemCopy.description}</span>
                    </button>
                    <button
                      type="button"
                      className="workspace-policy-info rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                      aria-label={`${t.aboutPolicy}: ${itemCopy.name}`}
                      aria-expanded={explainedPolicyId === item.id}
                      aria-controls="policy-help"
                      onClick={(event) => {
                        policyHelpTrigger.current = event.currentTarget;
                        setExplainedPolicyId(explainedPolicyId === item.id ? null : item.id);
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    </div>
                  );
                })}
              </div>
              {explainedPolicy && (
                <div id="policy-help" data-policy-help role="region" aria-labelledby="policy-help-title" className="workspace-policy-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <h3 id="policy-help-title" className="text-sm font-bold text-white">{explainedPolicy.name}</h3>
                    <button
                      type="button"
                      aria-label={t.close}
                      className="rounded-md p-1 text-slate-400 hover:text-white"
                      onClick={() => {
                        setExplainedPolicyId(null);
                        policyHelpTrigger.current?.focus();
                      }}
                    ><X className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-1 font-semibold text-blue-300">{explainedPolicy.shortName}</p>
                  <p className="mt-1">{explainedPolicy.description}</p>
                  {explainedPolicy.details && explainedPolicySettings && comparisonPolicySettings && (
                    <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-relaxed">
                      {explainedPolicy.details.map(detail => (
                        <li key={detail}>{formatCopy(detail, {
                          firstGen: explainedPolicySettings.weights.firstGen,
                          comparisonFirstGen: comparisonPolicySettings.weights.firstGen,
                          cutoff: explainedPolicySettings.threshold,
                          comparisonCutoff: comparisonPolicySettings.threshold,
                        })}</li>
                      ))}
                    </ul>
                  )}
                  {explainedPolicy.caution && <p className="mt-2 border-t border-slate-700 pt-2">{explainedPolicy.caution}</p>}
                </div>
              )}

            </section>


              <section className="workspace-counterfactual simplified-panel flex flex-col rounded-2xl border border-blue-400/20 bg-slate-900/65">
                <div className="mb-2.5 flex shrink-0 items-start justify-between gap-2 xl:mb-1.5">
                  <div className="flex items-start gap-2">
                    <div className="simplified-step flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">2</div>
                    <div>
                      <h2 className="text-[15px] font-bold leading-tight text-white">{t.whatIfTitle}</h2>
                      <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-400">{t.whatIfDesc}</p>
                    </div>
                  </div>
                </div>

                {!draftStudent ? (
                  <div className="workspace-empty simplified-inset flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/35 text-center">
                    <GraduationCap className="h-8 w-8 text-slate-700" />
                    <h3 className="mt-3 text-sm font-semibold text-slate-300">{t.selectStudent}</h3>
                    <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">{t.selectStudentDesc}</p>
                  </div>
                ) : (
                  <div className="workspace-draft-controls">
                    <div className="workspace-profile-bar rounded-xl bg-slate-950/55 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">
                          {t.student} {draftStudent.id}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div ref={decisionBadgeRef} role="status" aria-live="polite" aria-atomic="true"
                          title={formatCopy(t.outcomeComparison, { original: originalDecision ? t.admitted : t.notAdmitted, edited: draftDecision ? t.admitted : t.notAdmitted })}
                          data-flipped={Boolean(decisionFlipped)} data-admitted={draftDecision}
                          className={`workspace-outcome-badge ${decisionFlipped ? 'is-flipped' : ''} ${draftDecision ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                          <span className="workspace-outcome-main">{draftDecision ? t.admitted : t.notAdmitted}</span>
                          <span className="workspace-outcome-change">{decisionFlipped && <ArrowRight className="h-3 w-3" aria-hidden="true" />}{decisionFlipped ? t.outcomeFlipped : t.outcomeUnchanged}</span>
                          <span className="sr-only">{formatCopy(t.outcomeComparison, { original: originalDecision ? t.admitted : t.notAdmitted, edited: draftDecision ? t.admitted : t.notAdmitted })}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraftStudent({ ...selectedStudent })}
                          className="flex min-h-8 items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:border-slate-600 hover:text-white"
                        >
                          <RotateCcw className="h-3 w-3" /> {t.reset}
                        </button>
                      </div>
                    </div>
                    <div className={`workspace-profile-status ${draftProfileChanged ? 'workspace-profile-changed' : 'text-slate-400'}`} aria-live="polite">
                      {draftProfileChanged
                        ? (plotPositionChanged
                          ? `${t.adjustedPosition} · ΔGPA ${(draftStudent.gpa - selectedStudent.gpa).toFixed(2)} · ΔSAT ${draftStudent.sat - selectedStudent.sat}`
                          : t.adjustedSamePosition)
                        : t.originalProfile}
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
                          aria-pressed={draftStudent[field]}
                          onClick={() => updateDraft(field, !draftStudent[field])}
                          className={`min-h-8 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition ${
                            draftStudent[field]
                              ? 'border-blue-400/45 bg-blue-500/12 text-blue-200'
                              : 'border-slate-700 bg-slate-950/50 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {label}: {draftStudent[field] ? t.yes : t.no}
                        </button>
                      ))}
                    </div>

                    <div className={`workspace-decision rounded-xl border p-2.5 xl:p-2 ${decisionFlipped ? 'workspace-decision-flipped' : 'border-slate-800 bg-slate-950/45'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-200">
                          {t.decisionScore}
                          <button
                            type="button"
                            className="workspace-inline-help rounded-md text-slate-400 hover:text-white"
                            aria-label={t.scoreHelpTitle}
                            aria-expanded={explainedPolicyId === 'decision-score'}
                            aria-controls="score-help"
                            onClick={(event) => {
                              policyHelpTrigger.current = event.currentTarget;
                              setExplainedPolicyId(explainedPolicyId === 'decision-score' ? null : 'decision-score');
                            }}
                          ><Info className="h-4 w-4" /></button>
                        </span>
                        <span className="font-mono text-xs text-slate-300">{draftScore.toFixed(1)} · {t.cutoff} {policy.threshold}</span>
                      </div>
                      {explainedPolicyId === 'decision-score' && (
                        <div id="score-help" data-policy-help role="region" aria-labelledby="score-help-title" className="workspace-score-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                          <div className="flex items-start justify-between gap-3">
                            <h3 id="score-help-title" className="text-sm font-bold text-white">{t.scoreHelpTitle}</h3>
                            <button type="button" aria-label={t.close} className="rounded-md p-1 text-slate-400 hover:text-white" onClick={() => {
                              setExplainedPolicyId(null);
                              policyHelpTrigger.current?.focus();
                            }}><X className="h-4 w-4" /></button>
                          </div>
                          <p className="mt-2">{t.scoreHelpDescription}</p>
                          <p className="mt-2 font-semibold text-blue-300">{formatCopy(t.scoreHelpRule, { cutoff: policy.threshold })}</p>
                          <p className="mt-2">{t.scoreHelpCaution}</p>
                          <p className="mt-2">{t.chartAxisNote} {t.auditNote}</p>
                          <p className="mt-2 font-semibold">{decisionFlipped ? t.flipQuestion : t.changeQuestion}</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </section>
              <section className="workspace-comparison simplified-panel rounded-2xl border border-slate-800 bg-slate-900/65">
                <div className="mb-1.5 flex items-start gap-2.5">
                  <div className="simplified-step flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">3</div>
                  <div>
                    <h2 className="text-base font-bold leading-tight text-white">{t.compareOutcomes}</h2>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.gapCaution}</p>
                  </div>
                </div>

                <div className="simplified-inset simplified-rate-table rounded-xl border border-slate-800 bg-slate-950/45 p-1">
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

              </section>
          </aside>
        </main>

        <footer className="mt-3 flex shrink-0 flex-col justify-between gap-1 border-t border-slate-800 pt-3 text-[10px] text-slate-600 sm:flex-row xl:mt-2 xl:pt-2">
          <span
            className={dataState === 'error' ? 'font-semibold text-amber-600' : undefined}
            role={dataState === 'error' ? 'alert' : undefined}
            title={dataError || undefined}
          >
            {datasetStatus}
          </span>
          <span>{t.footerTitle}</span>
        </footer>
      </div>
    </div>
  );
};

export default SimplifiedApp;
