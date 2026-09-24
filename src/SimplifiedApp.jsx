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
  MoveUpRight,
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
import ThresholdDragSurface from './ThresholdDragSurface.jsx';
import useStudentDrag from './useStudentDrag.js';
import './simplified-workspace.css';
import { ADMISSION_DOMAINS, scoreStudent, getDecision, backgroundScore, admissionBoundary, backgroundBoundaryBand, confusionMatrix } from '../shared/admissionModel.js';
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
    confusionTitle: 'Confusion Matrix',
    matrixDecision: 'Policy decision',
    confusionHelpTitle: 'How to read the confusion matrix',
    benchmarkMet: 'Meets benchmark',
    benchmarkNotMet: 'Below benchmark',
    matrixSamples: 'Samples',
    matrixIncluded: '{labeled} used',
    matrixCellShare: '{count} of {total} labeled samples ({percent}%)',
    matrixBarHelp: 'Each bar shows the cell’s share of all samples with a benchmark label.',
    matrixCoverage: '{labeled}/{total} labeled',
    matrixMissing: 'Benchmark labels needed',
    matrixHelp: 'Rows show the policy’s admission decision. Columns show whether each student meets the dataset’s benchmark. Moving the admission threshold changes the decisions; the benchmark labels stay fixed.',
    matrixDemoHelp: 'The benchmark labels in this demo are simulated using GPA, SAT, and fixed random noise. They do not measure actual student performance.',
    matrixFormula: 'Benchmark met when: 18 × GPA + 20 × SAT / 1600 + noise (0–15) > 72.',
    matrixScope: 'The matrix counts the original student records. Missing labels are skipped. Editing one student leaves these counts unchanged.',
    matrixField: 'Benchmark field: {field}',
    matrixCells: { tp: 'True positive: admitted and meets the benchmark', fp: 'False positive: admitted and below the benchmark', fn: 'False negative: not admitted and meets the benchmark', tn: 'True negative: not admitted and below the benchmark' },
    credits: 'Credits',
    themeGraphite: 'Graphite',
    themeSummer: 'Summer',
    themeLight: 'Light',
    switchTheme: 'Switch theme',
    languageLabel: 'Language',
    mineEdgeCases: 'Mine Edge Cases',
    edgeCasesFound: 'closest to cutoff',
    fromCutoff: 'from cutoff',
    visualizer: 'Counterfactual Visualizer',
    visualizerSubtitle: 'Drag a student or the cutoff to explore outcomes.',
    studentDragHelp: 'Drag to change GPA and SAT. Press Esc to undo this drag.',
    boundaryHelpTitle: 'How to read the admission boundary',
    boundaryShared: 'Shared admission boundary',
    boundaryBand: 'Background-dependent band',
    boundarySelected: 'Cutoff for this student’s background',
    boundaryEdited: 'Cutoff for the edited background',
    boundaryAll: 'All plotted scores qualify for this background',
    boundaryNone: 'No plotted scores qualify for this background',
    boundaryEdge: 'Cutoff at chart edge',
    boundaryAcademicHelp: 'The line marks score = threshold. Academic Focus uses only GPA and SAT, so the same line applies to everyone. Scores on the line are admitted.',
    boundaryContextHelp: 'These policies also use first-generation, athlete, and residency status. The shaded band spans the possible cutoffs across all eight background combinations. Inside it, the same GPA and SAT can lead to different decisions.',
    boundarySelectedHelp: 'Select a student to see the cutoff for their background. The line moves when you edit their background points. The band keeps showing the full range of possible cutoffs. Other students keep their own backgrounds and results.',
    boundaryFormula: 'GPA points + SAT points + background points = threshold',
    boundaryDragHint: 'Drag to adjust',
    boundaryDragging: 'Adjusting cutoff',
    boundaryUseSlider: 'Use slider below',
    boundaryDragHelp: 'Drag the line or shaded band to change the cutoff. Up or right raises it; down or left lowers it. Press Esc during a drag to undo. The slider below works too.',
    whatIfStudent: 'What-if student',
    originalProfile: 'Original profile · no changes yet',
    controlsLabel: 'Exploration controls',
    aboutPolicy: 'About this policy',
    choosePolicy: 'Policy Studio',
    choosePolicyDesc: 'Choose how GPA, SAT, and background count.',
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
    groupOutcomesDesc: 'Percentage of students admitted in each group.',
    admittedFraction: '{admitted}/{total}',
    admittedCountLabel: '{admitted} of {total} students admitted',
    rateIncrease: 'Admission rate increased to {rate}% since its last change.',
    rateDecrease: 'Admission rate decreased to {rate}% since its last change.',
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
    thresholdHelp: 'The threshold is the minimum score needed for admission. Raise it to admit fewer students; lower it to admit more. The same cutoff applies to everyone. Student profiles stay unchanged.',
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
    selectStudentDesc: 'Drag a dot to try different scores, or use the controls here. The original profile stays unchanged.',
    decisionScore: 'Decision score',
    scoreHelpTitle: 'How does the decision score work?',
    scoreHelpDescription: 'The selected policy combines GPA, SAT, and any background factors it uses into a score. Different policies give these factors different importance.',
    scoreHelpRule: 'The cutoff for this policy is {cutoff}. A score at or above {cutoff} means admitted in this simulation; a lower score means not admitted.',
    scoreHelpCaution: 'The score is used only to apply the selected rule. A score of 70 does not mean a 70% chance of admission.',
    cutoff: 'Cutoff',
    flipQuestion: 'The result flipped. Which factor caused it, and should it matter?',
    changeQuestion: 'Change one factor until the result flips. Should that factor matter?',
    auditNote: 'Try changing one background factor to see how the policy uses it.',
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
        shortName: 'Academic scores + background points',
        description: 'Uses GPA and SAT, with extra points for first-generation students, athletes, and in-state residents.',
        question: 'Which context should an admission system consider?',
      },
      opportunity: {
        name: 'Opportunity-Aware',
        shortName: 'More points for first-generation students',
        description: 'Gives more points for first-generation status and less weight to GPA and SAT than Whole-Person Review. Also adds points for athletes and in-state residents.',
        details: [
          'First-generation status adds {firstGen} score points here, compared with {comparisonFirstGen} in Whole-Person Review. With other factors equal, this can change who qualifies.',
          'The starting cutoff is {cutoff}, compared with {comparisonCutoff}. You can change it with the threshold slider.',
        ],
        caution: 'Family income and school resources are not included in this simulation.',
        question: 'Who benefits from this rule, and what might it overlook?',
      },
    },
  },
  zh: {
    confusionTitle: '混淆矩阵',
    matrixDecision: '政策决定',
    confusionHelpTitle: '如何阅读混淆矩阵',
    benchmarkMet: '达到基准',
    benchmarkNotMet: '未达基准',
    matrixSamples: '样本总数',
    matrixIncluded: '{labeled} 个参与统计',
    matrixCellShare: '{total} 个有标签样本中的 {count} 个（{percent}%）',
    matrixBarHelp: '每条色条表示这一格的人数占全部有基准标签样本的比例。',
    matrixCoverage: '{labeled}/{total} 有标签',
    matrixMissing: '需要基准标签',
    matrixHelp: '行表示政策是否录取，列表示学生是否达到数据集设定的基准。调整录取阈值会改变录取决定，基准标签保持不变。',
    matrixDemoHelp: '当前演示的基准标签由 GPA、SAT 和固定随机扰动模拟生成，不代表学生的实际表现。',
    matrixFormula: '达到基准的条件：18 × GPA + 20 × SAT / 1600 + 扰动（0–15）> 72。',
    matrixScope: '矩阵统计原始学生档案，跳过缺少基准标签的样本。编辑单个学生不会改变这些统计。',
    matrixField: '基准字段：{field}',
    matrixCells: { tp: '真正类：已录取，达到基准', fp: '假正类：已录取，未达基准', fn: '假负类：未录取，达到基准', tn: '真负类：未录取，未达基准' },
    credits: '项目团队',
    themeGraphite: '石墨',
    themeSummer: '夏日',
    themeLight: '亮色',
    switchTheme: '切换主题',
    languageLabel: '语言',
    mineEdgeCases: '挖掘临界案例',
    edgeCasesFound: '名最接近录取线',
    fromCutoff: '距录取线',
    visualizer: '反事实可视化',
    visualizerSubtitle: '拖动学生点或录取线，观察结果如何变化。',
    studentDragHelp: '拖动调整 GPA 和 SAT；按 Esc 撤销本次拖动。',
    boundaryHelpTitle: '如何理解录取边界',
    boundaryShared: '所有学生共用的录取线',
    boundaryBand: '背景可能影响结果的区域',
    boundarySelected: '当前学生背景对应的录取线',
    boundaryEdited: '修改后背景对应的录取线',
    boundaryAll: '这一背景下，图内所有分数均符合条件',
    boundaryNone: '这一背景下，图内没有符合条件的分数',
    boundaryEdge: '录取线位于图表边缘',
    boundaryAcademicHelp: '线上各点的分数等于阈值。Academic Focus 只使用 GPA 和 SAT，因此所有学生共用一条线。恰好在线上的学生也会被录取。',
    boundaryContextHelp: '另外两项政策还考虑一代生、运动员和州内居民身份。阴影带覆盖全部八种背景组合对应的录取线范围。在这一区域内，同样的 GPA 和 SAT 可能产生不同结果。',
    boundarySelectedHelp: '选中学生后，实线显示其背景对应的录取线。修改背景加分时，这条线会随之移动。阴影带始终表示所有背景组合的录取线范围。其他学生仍按各自背景评分和着色。',
    boundaryFormula: 'GPA 得分 + SAT 得分 + 背景得分 = 阈值',
    boundaryDragHint: '拖动调整阈值',
    boundaryDragging: '正在调整阈值',
    boundaryUseSlider: '使用下方滑块',
    boundaryDragHelp: '拖动实线或阴影带即可调整阈值。向上或向右提高，向下或向左降低。拖动时按 Esc 可撤销；也可以使用下方滑块。',
    whatIfStudent: '假设调整后的学生',
    originalProfile: '原始档案 · 尚未调整',
    controlsLabel: '探索与调整',
    aboutPolicy: '了解这项政策',
    choosePolicy: '政策工作台',
    choosePolicyDesc: '选择 GPA、SAT 和背景的计分方式。',
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
    groupOutcomesDesc: '各组学生中被录取的人数占比。',
    admittedFraction: '{admitted}/{total}',
    admittedCountLabel: '{total} 名学生中有 {admitted} 名被录取',
    rateIncrease: '录取率比刚才上升，现为 {rate}%。',
    rateDecrease: '录取率比刚才下降，现为 {rate}%。',
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
    thresholdHelp: '阈值是录取所需的最低分数。提高阈值，录取人数减少；降低阈值，录取人数增加。所有学生使用同一个阈值，学生档案保持不变。',
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
    selectStudentDesc: '拖动学生点尝试不同分数，也可以使用这里的控件。原始档案保持不变。',
    decisionScore: '决策分数',
    scoreHelpTitle: '决策分数是怎么算的？',
    scoreHelpDescription: '所选政策把 GPA、SAT 和它所考虑的背景因素合成为一个分数。不同政策对这些因素的重视程度不同。',
    scoreHelpRule: '这项政策的录取线是 {cutoff}。在这个模拟中，分数达到或超过 {cutoff} 就会被录取，低于录取线则不被录取。',
    scoreHelpCaution: '这个分数仅用于执行所选录取规则。70 分并不表示有 70% 的录取概率。',
    cutoff: '录取线',
    flipQuestion: '结果翻转了。哪个因素造成了变化？它应该重要吗？',
    changeQuestion: '改变一个因素直到结果翻转。这个因素应该重要吗？',
    auditNote: '试着只改变一项背景，看看政策如何使用这个因素。',
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
        shortName: '学业成绩 + 背景加分',
        description: '使用 GPA 和 SAT，并为第一代大学生、运动员和州内居民加分。',
        question: '录取系统应该考虑哪些背景？',
      },
      opportunity: {
        name: '机会补偿',
        shortName: '给第一代大学生更多加分',
        description: '相比“综合评估”，这项政策给第一代大学生更多加分，GPA 和 SAT 的权重更低。运动员和州内居民也有加分。',
        details: [
          '第一代大学生身份在这里加 {firstGen} 分，而“综合评估”加 {comparisonFirstGen} 分。在其他条件相同时，这可能改变录取结果。',
          '默认录取线是 {cutoff}，而“综合评估”是 {comparisonCutoff}。你仍然可以用阈值滑块调整它。',
        ],
        caution: '这个模拟尚未纳入家庭收入和学校资源等因素。',
        question: '这套规则让谁受益，又可能忽略什么？',
      },
    },
  },
  es: {
    confusionTitle: 'Matriz de confusión',
    matrixDecision: 'Decisión de la política',
    confusionHelpTitle: 'Cómo leer la matriz de confusión',
    benchmarkMet: 'Cumple el criterio',
    benchmarkNotMet: 'No cumple el criterio',
    matrixSamples: 'Muestras',
    matrixIncluded: '{labeled} incluidas',
    matrixCellShare: '{count} de {total} muestras etiquetadas ({percent}%)',
    matrixBarHelp: 'Cada barra muestra la proporción de la celda entre todas las muestras con etiqueta del criterio.',
    matrixCoverage: '{labeled}/{total} etiquetados',
    matrixMissing: 'Faltan etiquetas del criterio',
    matrixHelp: 'Las filas muestran la decisión de admisión. Las columnas indican si cada estudiante cumple el criterio del conjunto de datos. Al mover el umbral cambian las decisiones; las etiquetas del criterio se mantienen fijas.',
    matrixDemoHelp: 'En esta demo, las etiquetas del criterio se simulan con GPA, SAT y ruido aleatorio fijo. No miden el desempeño real de los estudiantes.',
    matrixFormula: 'Cumple el criterio si: 18 × GPA + 20 × SAT / 1600 + ruido (0–15) > 72.',
    matrixScope: 'La matriz cuenta los perfiles originales. Se omiten los casos sin etiqueta. Editar un estudiante mantiene estos conteos iguales.',
    matrixField: 'Campo del criterio: {field}',
    matrixCells: { tp: 'Verdadero positivo: admitido y cumple el criterio', fp: 'Falso positivo: admitido y no cumple el criterio', fn: 'Falso negativo: no admitido y cumple el criterio', tn: 'Verdadero negativo: no admitido y no cumple el criterio' },
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
    visualizerSubtitle: 'Arrastra un estudiante o el umbral para explorar los resultados.',
    studentDragHelp: 'Arrastra para cambiar GPA y SAT. Pulsa Esc para deshacer este movimiento.',
    boundaryHelpTitle: 'Cómo leer el límite de admisión',
    boundaryShared: 'Límite de admisión común',
    boundaryBand: 'Zona dependiente del contexto',
    boundarySelected: 'Corte para el contexto de este estudiante',
    boundaryEdited: 'Corte para el contexto editado',
    boundaryAll: 'Todos los puntajes del gráfico califican con este contexto',
    boundaryNone: 'Ningún puntaje del gráfico califica con este contexto',
    boundaryEdge: 'Corte en el borde del gráfico',
    boundaryAcademicHelp: 'La línea marca puntuación = umbral. Academic Focus solo usa GPA y SAT, por lo que la misma línea sirve para todos. Los puntos sobre la línea se admiten.',
    boundaryContextHelp: 'Las otras políticas también usan primera generación, deporte y residencia. La banda abarca los cortes de las ocho combinaciones de contexto. Dentro de ella, el mismo GPA y SAT pueden dar decisiones diferentes.',
    boundarySelectedHelp: 'Selecciona un estudiante para ver el corte de su contexto. La línea se mueve al editar sus puntos de contexto. La banda mantiene el rango completo de cortes posibles. Los demás estudiantes conservan su contexto y sus resultados.',
    boundaryFormula: 'Puntos GPA + puntos SAT + puntos de contexto = umbral',
    boundaryDragHint: 'Arrastra para ajustar',
    boundaryDragging: 'Ajustando el umbral',
    boundaryUseSlider: 'Usa el control inferior',
    boundaryDragHelp: 'Arrastra la línea o la banda para cambiar el umbral. Hacia arriba o a la derecha lo sube; hacia abajo o a la izquierda lo baja. Pulsa Esc al arrastrar para deshacer. También puedes usar el control inferior.',
    whatIfStudent: 'Estudiante hipotético',
    originalProfile: 'Perfil original · sin cambios',
    controlsLabel: 'Controles de exploración',
    aboutPolicy: 'Acerca de esta política',
    choosePolicy: 'Estudio de políticas',
    choosePolicyDesc: 'Elige cómo cuentan el GPA, el SAT y el contexto.',
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
    groupOutcomesDesc: 'Porcentaje de estudiantes admitidos en cada grupo.',
    admittedFraction: '{admitted}/{total}',
    admittedCountLabel: '{admitted} de {total} estudiantes admitidos',
    rateIncrease: 'La tasa de admisión subió al {rate}% desde el último cambio.',
    rateDecrease: 'La tasa de admisión bajó al {rate}% desde el último cambio.',
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
    thresholdHelp: 'El umbral es la puntuación mínima para la admisión. Súbelo para admitir menos estudiantes; bájalo para admitir más. El mismo corte se aplica a todos. Los perfiles se mantienen iguales.',
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
    selectStudentDesc: 'Arrastra un punto para probar otras notas o usa estos controles. El perfil original se conserva.',
    decisionScore: 'Puntuación de decisión',
    scoreHelpTitle: '¿Cómo funciona la puntuación?',
    scoreHelpDescription: 'La política elegida combina GPA, SAT y los factores de contexto que utiliza en una puntuación. Cada política les da distinta importancia.',
    scoreHelpRule: 'El corte de esta política es {cutoff}. Una puntuación igual o superior a {cutoff} significa admisión en esta simulación; una inferior significa no admisión.',
    scoreHelpCaution: 'La puntuación se usa solo para aplicar la regla elegida. Una puntuación de 70 no significa un 70% de probabilidad de admisión.',
    cutoff: 'Corte',
    flipQuestion: 'El resultado cambió. ¿Qué factor lo causó y debería importar?',
    changeQuestion: 'Cambia un factor hasta invertir el resultado. ¿Debería importar?',
    auditNote: 'Prueba cambiar un factor de contexto para ver cómo lo usa la política.',
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
        shortName: 'Notas académicas + puntos de contexto',
        description: 'Usa GPA y SAT, con puntos adicionales por primera generación, deporte y residencia en el estado.',
        question: '¿Qué contexto debería considerar el sistema?',
      },
      opportunity: {
        name: 'Atención a oportunidades',
        shortName: 'Más puntos para estudiantes de primera generación',
        description: 'Da más puntos por primera generación y menos peso al GPA y al SAT que Evaluación integral. También añade puntos por deporte y residencia en el estado.',
        details: [
          'Ser de primera generación añade {firstGen} puntos, frente a {comparisonFirstGen} en Evaluación integral. Con los demás factores iguales, esto puede cambiar la decisión.',
          'El corte inicial es {cutoff}, frente a {comparisonCutoff}. Puedes cambiarlo con el control del umbral.',
        ],
        caution: 'Los ingresos familiares y los recursos escolares no se incluyen en esta simulación.',
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

const RateValue = ({ groupLabel, stats, t }) => {
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
    </div>
  );
};

const RateComparison = ({ label, leftLabel, leftStats, rightLabel, rightStats, t }) => {
  return (
    <div className="workspace-rate-row border-b border-slate-800 last:border-b-0" role="group" aria-label={label}>
      <div className="workspace-rate-category font-bold text-slate-200">{label}</div>
      {[[leftLabel, leftStats], [rightLabel, rightStats]].map(([groupLabel, stats], index) => (
        <RateValue key={index} groupLabel={groupLabel} stats={stats} t={t} />
      ))}
    </div>
  );
};

const StudentDot = ({ cx, cy, fill, fillOpacity, stroke, strokeWidth, className, style, payload, highlightEdge, dragHelp }) => (
  <g className={`recharts-symbols workspace-student-drag-target ${className || ''}`} style={style} data-student-id={payload?.id}>
    <title>{dragHelp}</title>
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

const AdjustedPositionMarker = ({ cx, cy, draftDecision, isLight, samePosition, darkPalette, dragHelp }) => {
  const outcomeColor = draftDecision
    ? (isLight ? LIGHT_OUTCOME_COLORS.admitted : darkPalette.admitted)
    : (isLight ? LIGHT_OUTCOME_COLORS.rejected : darkPalette.rejected);
  const surfaceColor = isLight ? '#f8fafc' : darkPalette.surface;

  return (
    <g className="counterfactual-position-marker workspace-student-drag-target" data-draft-student>
      <title>{dragHelp}</title>
      <circle className="workspace-draft-hit-target" cx={cx} cy={cy} r="14" fill="transparent" pointerEvents="all" />
      <circle
        pointerEvents="none"
        cx={cx}
        cy={cy}
        r={samePosition ? 11 : 9}
        fill={isLight ? 'rgba(247, 245, 251, 0.9)' : darkPalette.markerFill}
        stroke={isLight ? '#7c3aed' : darkPalette.accent}
        strokeDasharray="3 2.5"
        strokeWidth="2.25"
      />
      <circle
        pointerEvents="none"
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

const BoundaryLine = ({ boundary, color, kind, width = 2.5 }) => {
  if (!boundary?.points.length) return null;
  if (boundary.points.length === 1) return <ReferenceDot className={`workspace-boundary-${kind}`} x={boundary.points[0].x} y={boundary.points[0].y} r={4} fill={color} stroke={color} style={{ pointerEvents: 'none' }} />;
  // Geometry is already clipped to the data domain; clip pixels rather than discard
  // the whole segment when the chart scale rounds an edge a fraction out of range.
  return <ReferenceLine className={`workspace-boundary-${kind}`} segment={boundary.points} ifOverflow="hidden" stroke={color} strokeWidth={width} strokeLinecap="round" style={{ pointerEvents: 'none' }} />;
};

const StudentGuides = ({ student, color, kind }) => (
  <>
    <ReferenceLine
      className={`workspace-guide-${kind}-sat`}
      segment={[{ x: ADMISSION_DOMAINS.gpa[0], y: student.sat }, { x: student.gpa, y: student.sat }]}
      ifOverflow="hidden"
      stroke={color}
      strokeDasharray="3 4"
      strokeWidth={1}
      strokeOpacity={0.5}
      style={{ pointerEvents: 'none' }}
    />
    <ReferenceLine
      className={`workspace-guide-${kind}-gpa`}
      segment={[{ x: student.gpa, y: ADMISSION_DOMAINS.sat[0] }, { x: student.gpa, y: student.sat }]}
      ifOverflow="hidden"
      stroke={color}
      strokeDasharray="3 4"
      strokeWidth={1}
      strokeOpacity={0.5}
      style={{ pointerEvents: 'none' }}
    />
  </>
);

const SimplifiedApp = () => {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const [showCredits, setShowCredits] = useState(false);
  const [isMining, setIsMining] = useState(false);
  const [policyId, setPolicyId] = useState('academic');
  const [thresholdOverride, setThresholdOverride] = useState(null);
  const [isBoundaryDragging, setIsBoundaryDragging] = useState(false);
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
  const referenceFeatures = classroomView.features.filter(feature => feature.role === 'outcome' && feature.type === 'boolean' && feature.allowedUses.includes('compare'));
  // Avoid guessing a target when a release contains multiple outcomes.
  const referenceFeature = referenceFeatures.length === 1 ? referenceFeatures[0] : null;
  const hasSyntheticReference = classroomView.dataset.sourceType === 'synthetic';
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
  const boundaryCaption = currentBoundary?.points.length === 0
    ? (currentBoundary.relation === 'all-admitted' ? t.boundaryAll : t.boundaryNone)
    : currentBoundary?.points.length === 1
      ? t.boundaryEdge
      : !boundaryBand.hasContext ? t.boundaryShared
        : !draftStudent ? (boundaryBand.polygon.length ? t.boundaryBand : t.boundaryEdge)
          : backgroundBoundaryChanged ? t.boundaryEdited : t.boundarySelected;

  const outcomes = useMemo(
    () => students.map((student) => ({ ...student, admitted: getDecision(student, policy) })),
    [policy, students],
  );
  const matrix = useMemo(
    () => confusionMatrix(students, policy, referenceFeature?.key),
    [students, policy, referenceFeature?.key],
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

  const applyDraft = (nextStudent, original = selectedStudent, previous = draftStudent) => {
    // Only count a counterfactual flip caused by editing the student, not by changing the policy/cutoff.
    if (original && previous && getDecision(previous, policy) === getDecision(original, policy)
      && getDecision(nextStudent, policy) !== getDecision(original, policy)) {
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

  const updateDraft = (field, value) => {
    if (draftStudent) applyDraft({ ...draftStudent, [field]: value });
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

  const { isStudentDragging, studentDragHandlers } = useStudentDrag({
    students, selectedStudent, draftStudent, onSelect: selectStudent, onEdit: applyDraft,
    setSelectedId, setDraftStudent, contextKey: `${datasetId}:${datasetVersion}:${policy.id}:${dataState}`, disabled: isBoundaryDragging,
  });

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
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[26px]">CounterLens</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                className={`simplified-inset simplified-scatter-plot w-full rounded-xl border border-slate-800/80 bg-slate-950/45 p-2 ${isBoundaryDragging ? 'is-boundary-dragging' : ''} ${isStudentDragging ? 'is-student-dragging' : ''}`}
                role="group"
                aria-label={t.chartLabel}
                {...studentDragHandlers}
                onMouseDown={(event) => { if (!event.target.closest?.('[data-boundary-ui]')) event.preventDefault(); }}
                onClick={(event) => {
                  if (!event.target.closest?.('.recharts-scatter-symbol, [data-boundary-ui], [data-draft-student]')) {
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
                  <span className="workspace-boundary-drag-hint" title={t.boundaryDragHelp}>
                    <MoveUpRight className="h-3 w-3" aria-hidden="true" />
                    {isBoundaryDragging ? t.boundaryDragging : (currentBoundary?.points.length || boundaryBand.polygon.length) ? t.boundaryDragHint : t.boundaryUseSlider}
                  </span>
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
                    <p className="mt-2">{t.boundaryDragHelp}</p>
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
                    <ReferenceArea x1={2.4} x2={4} y1={950} y2={1600} zIndex={-50} shape={
                      <ThresholdDragSurface band={boundaryBand} boundary={currentBoundary} policy={policy}
                        isLight={isLight} help={t.boundaryDragHelp}
                        onChange={setThresholdOverride} onDraggingChange={setIsBoundaryDragging} />
                    } />
                    {/* The band shows the range; one solid line shows the active background. */}
                    <BoundaryLine boundary={currentBoundary} color={backgroundBoundaryChanged ? 'var(--workspace-edit)' : 'var(--workspace-highlight)'} kind="current" />
                    {selectedStudent && (
                      <StudentGuides student={selectedStudent} color={isLight ? '#2563eb' : darkPalette.primary} kind="selected" />
                    )}
                    {draftProfileChanged && plotPositionChanged && (
                      <>
                        <StudentGuides student={draftStudent} color={isLight ? '#7c3aed' : darkPalette.accent} kind="draft" />
                        <ReferenceLine
                          className="workspace-profile-connector"
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
                      active={isBoundaryDragging || isStudentDragging ? false : undefined}
                      cursor={false}
                      content={<StudentTooltip policy={policy} t={t} />}
                      isAnimationActive={false}
                      animationDuration={0}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Scatter
                      data={outcomes}
                      isAnimationActive={false}
                      shape={(props) => <StudentDot {...props} dragHelp={t.studentDragHelp} highlightEdge={isMining && edgeCaseIds.has(props.payload?.id)} />}
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
                              cursor: 'grab',
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
                            dragHelp={t.studentDragHelp}
                          />
                        )}
                      />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="workspace-analysis-bar">
              <section className={`workspace-threshold ${isBoundaryDragging ? 'is-boundary-dragging' : ''}`} aria-labelledby="threshold-title" style={{ '--threshold-position': `${policy.threshold}%` }}>
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
                    <button type="button" className="workspace-threshold-reset" aria-label={t.thresholdReset} title={`${t.thresholdReset} · ${formatCopy(t.thresholdDefault, { value: presetPolicy.threshold })}`} disabled={policy.threshold === presetPolicy.threshold} onClick={() => setThresholdOverride(null)}>
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div id="threshold-rule" className="workspace-threshold-rule">{t.thresholdRule}</div>
                <input id="admission-threshold" type="range" min="0" max="100" step="1" value={policy.threshold} aria-describedby="threshold-rule" onInput={(event) => setThresholdOverride(Number(event.currentTarget.value))} />
                <div className="workspace-threshold-summary">
                  <div><strong>{impact.admitted}</strong><span> / {students.length} {t.studentsAdmitted}</span></div>
                  <div className="workspace-overall-rate" aria-label={`${t.overallRate}: ${impact.overallRate}%`} title={t.overallRate}><strong>{impact.overallRate}%</strong></div>
                </div>
                {explainedPolicyId === 'threshold' && (
                  <div id="threshold-help" data-policy-help role="region" aria-labelledby="threshold-help-title" className="workspace-threshold-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <h3 id="threshold-help-title" className="text-sm font-bold text-white">{t.thresholdHelpTitle}</h3>
                      <button type="button" aria-label={t.close} className="rounded-md p-1" onClick={() => { setExplainedPolicyId(null); policyHelpTrigger.current?.focus(); }}><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2">{t.thresholdHelp}</p>
                    <p className="mt-2">{t.thresholdPreset}</p>
                    <p className="mt-2">{t.boundaryDragHelp}</p>
                  </div>
                )}
              </section>

              <section className="workspace-confusion" aria-labelledby="confusion-title">
                <div className="workspace-confusion-heading">
                  <h3 id="confusion-title">{t.confusionTitle}</h3>
                  <button type="button" className="workspace-inline-help rounded-md" aria-label={t.confusionHelpTitle} aria-expanded={explainedPolicyId === 'confusion'} aria-controls="confusion-help" onClick={(event) => {
                    policyHelpTrigger.current = event.currentTarget;
                    setExplainedPolicyId(explainedPolicyId === 'confusion' ? null : 'confusion');
                  }}><Info className="h-4 w-4" /></button>
                </div>
                <table className="workspace-confusion-table">
                  <caption className="sr-only">{t.matrixHelp}</caption>
                  <thead><tr><th scope="col"><span className="sr-only">{t.matrixDecision}</span></th><th scope="col">{t.benchmarkMet}</th><th scope="col">{t.benchmarkNotMet}</th></tr></thead>
                  <tbody>
                    {[[t.admitted, ['tp', 'fp']], [t.notAdmitted, ['fn', 'tn']]].map(([label, cells]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        {cells.map(cell => {
                          const share = matrix.labeled ? matrix[cell] / matrix.labeled * 100 : 0;
                          const description = `${t.matrixCells[cell]}: ${matrix.labeled ? formatCopy(t.matrixCellShare, { count: matrix[cell], total: matrix.labeled, percent: Math.round(share) }) : t.matrixMissing}`;
                          return (
                            <td key={cell} data-cell={cell} className={cell === 'tp' || cell === 'tn' ? 'is-match' : ''} title={description}>
                              <span className="workspace-confusion-cell" aria-label={description}>
                                <span className="workspace-confusion-values"><span>{cell.toUpperCase()}</span><strong>{matrix.labeled ? matrix[cell] : '—'}</strong></span>
                                <span className="workspace-confusion-meter" aria-hidden="true" style={{ visibility: matrix.labeled ? 'visible' : 'hidden' }}><span style={{ width: `${share}%` }} /></span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="workspace-confusion-source" title={formatCopy(t.matrixCoverage, { labeled: matrix.labeled, total: students.length })}>
                  <span>{t.matrixSamples} <strong>{students.length}</strong></span>
                  {matrix.missing > 0 && <span>{matrix.labeled ? formatCopy(t.matrixIncluded, { labeled: matrix.labeled }) : t.matrixMissing}</span>}
                </div>
                {explainedPolicyId === 'confusion' && (
                  <div id="confusion-help" data-policy-help role="region" aria-labelledby="confusion-help-title" className="workspace-confusion-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <h3 id="confusion-help-title" className="text-sm font-bold text-white">{t.confusionHelpTitle}</h3>
                      <button type="button" aria-label={t.close} className="rounded-md p-1" onClick={() => { setExplainedPolicyId(null); policyHelpTrigger.current?.focus(); }}><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2">{t.matrixHelp}</p>
                    <p className="mt-2">{t.matrixBarHelp}</p>
                    <ul className="my-2 space-y-1">{Object.entries(t.matrixCells).map(([key, label]) => <li key={key}><strong>{key.toUpperCase()}</strong> · {label}</li>)}</ul>
                    {hasSyntheticReference && referenceFeature?.key === 'referenceOutcome' && <><p className="mt-2">{t.matrixDemoHelp}</p><p className="mt-2 font-mono text-[11px]">{t.matrixFormula}</p></>}
                    <p className="mt-2">{t.matrixScope}</p>
                    <p className="mt-2">{formatCopy(t.matrixCoverage, { labeled: matrix.labeled, total: students.length })}</p>
                    {referenceFeature && <p className="mt-2 text-[11px]">{formatCopy(t.matrixField, { field: referenceFeature.key })}</p>}
                  </div>
                )}
              </section>
              </div>

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
                      <span
                        className="workspace-policy-count text-slate-400"
                        aria-label={formatCopy(t.admittedCountLabel, { admitted: admittedCount, total: students.length })}
                      >
                        <strong className="workspace-policy-total font-bold">{admittedCount} / {students.length}</strong>
                        <span className="workspace-policy-count-label">{t.studentsAdmitted}</span>
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


              <section className={`workspace-counterfactual simplified-panel flex flex-col rounded-2xl border border-blue-400/20 bg-slate-900/65 ${isStudentDragging ? 'is-student-dragging' : ''}`}>
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
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.groupOutcomesDesc}</p>
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
