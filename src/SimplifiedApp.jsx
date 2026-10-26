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
  ChevronDown,
  Database,
  ExternalLink,
  GraduationCap,
  Info,
  Moon,
  MoveUpRight,
  RotateCcw,
  School,
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
import ScoreBoundaryView from './ScoreBoundaryView.jsx';
import ScoreBreakdownView from './ScoreBreakdownView.jsx';
import BackgroundScenariosView from './BackgroundScenariosView.jsx';
import FeatureExplorer from './FeatureExplorer.jsx';
import ExplorerPolicyDetails from './ExplorerPolicyDetails.jsx';
import { EXPLORER_POLICY_COPY } from './explorerPolicyCopy.js';
import { EXPLORER_SIMULATION_POLICIES, isExplorerPolicy } from '../shared/explorerPolicies.js';
import { buildExplorerDemoView, samePublishedValue } from '../shared/explorerDemoDataset.js';
import { ExplorerBackgroundEditor, ExplorerGroupOutcomes } from './ExplorerBackgroundControls.jsx';
import { EXPLORER_FEATURES, buildIncomeBins, enrichExplorerRecords, getExplorerOptions, summarizeExplorerOutcomes } from '../shared/featureExplorer.js';
import { BOUNDARY_VIEWS } from './boundaryViews.js';
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
    graphiteAccent: '#ffd05a',
    summerAccent: '#f4c95d',
  },
  holistic: {
    accent: '#6d28d9',
    graphiteAccent: '#d2a5ff',
    summerAccent: '#afa6f5',
  },
  opportunity: {
    accent: '#047857',
    graphiteAccent: '#8ea7ff',
    summerAccent: '#43d3c1',
  },
};
const policyDisplayName = (item, copy, lang) => copy[item.id]?.name
  || (typeof item.name === 'string' ? item.name : item.name?.[lang] || item.name?.en)
  || item.id;

const THEME_SEQUENCE = ['light', 'graphite'];
const RESEARCH_CONTRIBUTORS = ['Changjia (Eric) Yang', 'Soham Khisa'];

const DARK_THEME_PALETTES = {
  graphite: {
    surface: '#1b1f27',
    markerFill: 'rgba(27, 31, 39, 0.92)',
    grid: '#3d485b',
    axis: '#96a4bc',
    muted: '#d5dce8',
    primary: '#8ea7ff',
    accent: '#d2a5ff',
    connector: '#d2a5ff',
    admitted: '#60d8a4',
    rejected: '#ff8690',
    admittedStroke: '#a4eccd',
    rejectedStroke: '#ffb9be',
    selectedGlow: 'rgba(142, 167, 255, 0.85)',
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
    matrixDecision: 'AI prediction',
    matrixSimulatedLabel: 'Simulated label',
    matrixDataLabel: 'Dataset label',
    matrixDemoIntro: 'Each simulated student has a preset label: “admitted” or “not admitted.” This table compares the AI’s decision with that label.',
    matrixDemoExample: 'For example, FP counts students the AI admits whose preset label says “not admitted.”',
    matrixDemoAxes: 'Rows show the AI prediction. Columns show the simulated label.',
    matrixDemoCell: 'AI prediction: {prediction}; simulated label: {label}',
    confusionHelpTitle: 'How to read the confusion matrix',
    groundTruthPositive: 'Label: positive',
    groundTruthNegative: 'Label: negative',
    matrixSamples: 'Labeled students',
    matrixPartial: 'Samples without a label are left out.',
    matrixCellShare: '{count} students ({percent}% of all labeled students)',
    matrixBarHelp: 'Longer bars mean more students in that cell.',
    matrixMissing: 'No ground truth labels',
    matrixHelp: 'Rows show the AI-predicted result using the selected policy. Columns show the ground truth label saved in the data: positive or negative.',
    matrixDemoHelp: 'These labels are generated for the demo, not taken from real admission records.',
    matrixScope: 'Changing the policy or threshold updates the predictions. The labels stay fixed. Edits in the Counterfactual Editor leave the original students and these counts unchanged.',
    matrixCells: { tp: 'True positive: predicted admitted; label positive', fp: 'False positive: predicted admitted; label negative', fn: 'False negative: predicted not admitted; label positive', tn: 'True negative: predicted not admitted; label negative' },
    credits: 'Credits',
    themeGraphite: 'Dark',
    themeSummer: 'Summer',
    themeLight: 'Light',
    switchTheme: 'Switch theme',
    languageLabel: 'Language',
    mineEdgeCases: 'Mine Edge Cases',
    edgeCasesFound: 'closest to cutoff',
    fromCutoff: 'from cutoff',
    visualizer: 'Counterfactual Visualizer',
    visualizerSubtitle: 'Drag a student or the cutoff to explore outcomes.',
    studentDragHelp: 'Drag to change GPA and SAT Percentile. Press Esc to undo this drag.',
    boundaryHelpTitle: 'How to read the admission boundary',
    boundaryShared: 'Shared admission boundary',
    boundaryBand: 'Background-dependent band',
    boundarySelected: 'Cutoff for this student’s background',
    boundaryEdited: 'Cutoff for the edited background',
    boundaryAll: 'All plotted scores qualify for this background',
    boundaryNone: 'No plotted scores qualify for this background',
    boundaryEdge: 'Cutoff at chart edge',
    boundaryAcademicHelp: 'The line marks the admission cutoff for GPA and SAT Percentile. Students on the line qualify. Academic Focus uses the same line for everyone.',
    boundaryContextHelp: 'These policies also award points for first-generation, athlete, and in-state status. The shaded band shows where background points can change a decision for the same GPA and SAT Percentile.',
    boundarySelectedHelp: 'Select a student to see their admission line. Changing their background can move the line. The band shows the range for all backgrounds. Other students keep their own results.',
    boundaryFormula: 'GPA points + SAT Percentile points + background points = threshold',
    boundaryDragHint: 'Drag to adjust',
    boundaryDragging: 'Adjusting cutoff',
    boundaryUseSlider: 'Use slider below',
    boundaryDragHelp: 'Drag the line or band up or right to raise the cutoff; down or left to lower it. Press Esc to undo the drag.',
    whatIfStudent: 'What-if student',
    originalProfile: 'Original profile · no changes yet',
    controlsLabel: 'Exploration controls',
    aboutPolicy: 'About this policy',
    choosePolicy: 'Policy Studio',
    choosePolicyDesc: 'Choose how GPA, SAT Percentile, and background count.',
    remember: 'Remember',
    simulationNote: 'This is a simplified simulation, not a real admission system. The policy reflects human choices about what counts.',
    seeAffected: 'See who is affected',
    seeAffectedDesc: 'Each dot is one simulated student. Click a dot to investigate a decision.',
    seeAffectedDescApproved: 'Each dot is one record from the approved classroom release. Click a dot to investigate a decision.',
    chartLabel: 'Admission outcomes chart. GPA is on the horizontal axis and SAT Percentile is on the vertical axis. Select a student point to investigate the decision.',
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
    backgroundField: 'Background field',
    backgroundValue: 'Value',
    backgroundOriginal: 'Original: {value}',
    backgroundChanges: 'Edited fields: {count}',
    backgroundUnchanged: 'No background changes',
    nonAthlete: 'Non-athlete',
    whatIfTitle: 'Counterfactual Editor',
    whatIfDesc: 'Adjust a profile to compare outcomes.',
    thresholdTitle: 'Admission Threshold',
    thresholdRule: 'Score ≥ cutoff → admitted',
    thresholdHelpTitle: 'About the admission threshold',
    thresholdHelp: 'Students are admitted when their score reaches the threshold. A higher threshold makes admission harder; a lower one makes it easier.',
    thresholdPreset: 'Each policy starts with its own cutoff. Reset returns to that value. Changing the cutoff keeps the scoring rules the same.',
    thresholdDefault: 'Default: {value}',
    thresholdReset: 'Reset cutoff',
    outcomeFlipped: 'Outcome flipped',
    outcomeComparison: 'Original: {original} → Edited: {edited}. Compared at the same policy and threshold.',
    adjustedPosition: 'Adjusted position',
    adjustedSamePosition: 'Adjusted profile · same GPA/SAT Percentile position',
    chartAxisNote: 'Only GPA and SAT Percentile set a dot’s position. Background points can change its result at the same position.',
    reset: 'Reset',
    selectStudent: 'Select a student from the chart',
    selectStudentDesc: 'Drag a dot to try different scores, or use the controls here. The original profile stays unchanged.',
    decisionScore: 'Decision score',
    scoreHelpTitle: 'How the decision score is calculated',
    scoreHelpDescription: 'The policy adds up points for GPA, SAT Percentile, and the background factors it includes.',
    scoreHelpRule: 'A score of {cutoff} or more means admitted. Below {cutoff} means not admitted.',
    scoreHelpCaution: 'A score of 70 does not mean a 70% chance of admission.',
    cutoff: 'Cutoff',
    datasetSynthetic: 'Synthetic classroom dataset · {count} simulated applicants · No real student data',
    datasetApproved: 'Approved de-identified dataset · {count} records · Public classroom view',
    datasetLoading: 'Loading the classroom dataset…',
    datasetFallback: 'Data API unavailable · Bundled synthetic demo in use',
    footerTitle: 'CounterLens simplified AI Ethics learning prototype',
    creditsTitle: 'Project Team & Institution',
    principalInvestigator: 'Principal Investigator',
    researcherDeveloper: 'Researcher & Developer',
    projectLead: 'Prof. Rebecca Williams',
    contributorRole: 'Ph.D. Student',
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
        description: 'GPA and SAT Percentile only, with a strict admission cutoff.',
      },
      holistic: {
        name: 'Whole-Person Review',
        shortName: 'Academic scores + background points',
        description: 'Uses GPA and SAT Percentile, with extra points for first-generation students, athletes, and in-state residents.',
      },
      opportunity: {
        name: 'Opportunity-Aware',
        shortName: 'More points for first-generation students',
        description: 'Gives more points for first-generation status and less weight to GPA and SAT Percentile than Whole-Person Review. Also adds points for athletes and in-state residents.',
        details: [
          'First-generation students receive {firstGen} extra points here and {comparisonFirstGen} under Whole-Person Review.',
          'The default cutoff is {cutoff}; Whole-Person Review starts at {comparisonCutoff}. Use the slider to try another cutoff.',
        ],
        caution: 'Family income and school resources are not included in this simulation.',
      },
    },
  },
  zh: {
    confusionTitle: '混淆矩阵',
    matrixDecision: 'AI 预测结果',
    matrixSimulatedLabel: '模拟标签',
    matrixDataLabel: '数据标签',
    matrixDemoIntro: '每名模拟学生都有一个预设标签：“录取”或“不录取”。这张表把 AI 的决定和这个标签放在一起比较。',
    matrixDemoExample: '例如，FP 统计的是 AI 决定录取、但预设标签为“不录取”的学生人数。',
    matrixDemoAxes: '行表示 AI 预测结果，列表示模拟标签。',
    matrixDemoCell: 'AI 预测结果：{prediction}；模拟标签：{label}',
    confusionHelpTitle: '如何阅读混淆矩阵',
    groundTruthPositive: '标签：正类',
    groundTruthNegative: '标签：负类',
    matrixSamples: '有标签的学生',
    matrixPartial: '缺少标签的样本不计入矩阵。',
    matrixCellShare: '{count} 名学生（占全部有标签学生的 {percent}%）',
    matrixBarHelp: '色条越长，这一格的学生越多。',
    matrixMissing: '暂无真实标签',
    matrixHelp: '行表示 AI 按所选政策给出的预测结果，列表示数据中保存的真实标签（Ground truth label）：正类或负类。',
    matrixDemoHelp: '这些标签为演示生成，并非真实录取记录。',
    matrixScope: '切换政策或调整阈值会改变预测结果，标签保持固定。反事实编辑器中的修改不会改变原始学生和这里的统计。',
    matrixCells: { tp: '真正类：预测录取，标签为正类', fp: '假正类：预测录取，标签为负类', fn: '假负类：预测不录取，标签为正类', tn: '真负类：预测不录取，标签为负类' },
    credits: '项目团队',
    themeGraphite: '深色',
    themeSummer: '夏日',
    themeLight: '亮色',
    switchTheme: '切换主题',
    languageLabel: '语言',
    mineEdgeCases: '挖掘临界案例',
    edgeCasesFound: '名最接近录取线',
    fromCutoff: '距录取线',
    visualizer: '反事实可视化',
    visualizerSubtitle: '拖动学生点或录取线，观察结果如何变化。',
    studentDragHelp: '拖动调整 GPA 和 SAT Percentile；按 Esc 撤销本次拖动。',
    boundaryHelpTitle: '如何理解录取边界',
    boundaryShared: '所有学生共用的录取线',
    boundaryBand: '背景可能影响结果的区域',
    boundarySelected: '当前学生背景对应的录取线',
    boundaryEdited: '修改后背景对应的录取线',
    boundaryAll: '这一背景下，图内所有分数均符合条件',
    boundaryNone: '这一背景下，图内没有符合条件的分数',
    boundaryEdge: '录取线位于图表边缘',
    boundaryAcademicHelp: '这条线是 GPA 和 SAT Percentile 对应的录取线，恰好在线上的学生也会被录取。“学业优先”政策对所有学生使用同一条线。',
    boundaryContextHelp: '这两项政策还为第一代大学生、运动员和州内居民加分。阴影带表示：在 GPA 和 SAT Percentile 相同的情况下，背景加分可能改变录取结果的区域。',
    boundarySelectedHelp: '选中学生可查看其录取线。修改背景可能移动这条线，阴影带则显示所有背景对应的范围。其他学生的结果保持不变。',
    boundaryFormula: 'GPA 得分 + SAT Percentile 得分 + 背景得分 = 阈值',
    boundaryDragHint: '拖动调整阈值',
    boundaryDragging: '正在调整阈值',
    boundaryUseSlider: '使用下方滑块',
    boundaryDragHelp: '向上或向右拖动实线或阴影带可提高阈值，向下或向左可降低阈值。按 Esc 撤销本次拖动。',
    whatIfStudent: '假设调整后的学生',
    originalProfile: '原始档案 · 尚未调整',
    controlsLabel: '探索与调整',
    aboutPolicy: '了解这项政策',
    choosePolicy: '政策工作台',
    choosePolicyDesc: '选择 GPA、SAT Percentile 和背景的计分方式。',
    remember: '请记住',
    simulationNote: '这是一个简化的模拟实验，并非真实录取系统。政策反映的是人类对于“什么重要”的选择。',
    seeAffected: '观察谁受到影响',
    seeAffectedDesc: '每个点代表一名模拟学生。点击任意点，进一步审查这项决定。',
    seeAffectedDescApproved: '每个点代表获准公开的课堂数据中的一条记录。点击任意点，进一步审查这项决定。',
    chartLabel: '录取结果图。横轴为 GPA，纵轴为 SAT Percentile。请选择一个学生样本点来审查这项决定。',
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
    backgroundField: '背景字段',
    backgroundValue: '取值',
    backgroundOriginal: '原始值：{value}',
    backgroundChanges: '已修改 {count} 项',
    backgroundUnchanged: '背景尚未修改',
    nonAthlete: '非运动员',
    whatIfTitle: '反事实编辑器',
    whatIfDesc: '修改学生档案，对比录取结果。',
    thresholdTitle: '录取阈值',
    thresholdRule: '分数 ≥ 阈值 → 录取',
    thresholdHelpTitle: '录取阈值说明',
    thresholdHelp: '分数达到阈值就会被录取。阈值越高，录取越严格；阈值越低，录取越容易。',
    thresholdPreset: '每项政策都有默认录取线，点击重置即可恢复。调整录取线时，计分规则保持不变。',
    thresholdDefault: '默认值：{value}',
    thresholdReset: '重置阈值',
    outcomeFlipped: '结果已反转',
    outcomeComparison: '原始：{original} → 修改后：{edited}。两者使用相同的政策与阈值。',
    adjustedPosition: '调整后位置',
    adjustedSamePosition: '背景已调整 · GPA/SAT Percentile 坐标不变',
    chartAxisNote: '点的位置只由 GPA 和 SAT Percentile 决定。背景加分可以让点留在原处，但录取结果发生变化。',
    reset: '重置',
    selectStudent: '请从图中选择一名学生',
    selectStudentDesc: '拖动学生点尝试不同分数，也可以使用这里的控件。原始档案保持不变。',
    decisionScore: '决策分数',
    scoreHelpTitle: '决策分数的计算方式',
    scoreHelpDescription: '将政策中的 GPA 得分、SAT Percentile 得分和背景加分相加，就是决策分数。',
    scoreHelpRule: '分数达到 {cutoff} 就会被录取，低于 {cutoff} 则不被录取。',
    scoreHelpCaution: '70 分不表示有 70% 的录取概率。',
    cutoff: '录取线',
    datasetSynthetic: '合成课堂数据 · {count} 名模拟申请者 · 不含真实学生数据',
    datasetApproved: '已授权的去标识化数据 · {count} 条记录 · 公开课堂视图',
    datasetLoading: '正在载入课堂数据…',
    datasetFallback: '数据 API 暂不可用 · 当前使用内置合成演示数据',
    footerTitle: 'CounterLens 简化版 AI Ethics 教学原型',
    creditsTitle: '项目团队与机构',
    principalInvestigator: '首席研究员',
    researcherDeveloper: '研究与开发',
    projectLead: 'Prof. Rebecca Williams',
    contributorRole: '博士生',
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
        description: '只看 GPA 与 SAT Percentile，并采用严格录取线。',
      },
      holistic: {
        name: '综合评估',
        shortName: '学业成绩 + 背景加分',
        description: '使用 GPA 和 SAT Percentile，并为第一代大学生、运动员和州内居民加分。',
      },
      opportunity: {
        name: '机会补偿',
        shortName: '给第一代大学生更多加分',
        description: '相比“综合评估”，这项政策给第一代大学生更多加分，GPA 和 SAT Percentile 的权重更低。运动员和州内居民也有加分。',
        details: [
          '第一代大学生在这里加 {firstGen} 分，在“综合评估”中加 {comparisonFirstGen} 分。',
          '默认录取线是 {cutoff}，“综合评估”是 {comparisonCutoff}。可以用滑块尝试其他录取线。',
        ],
        caution: '这个模拟尚未纳入家庭收入和学校资源等因素。',
      },
    },
  },
  es: {
    confusionTitle: 'Matriz de confusión',
    matrixDecision: 'Predicción de IA',
    matrixSimulatedLabel: 'Etiqueta simulada',
    matrixDataLabel: 'Etiqueta de datos',
    matrixDemoIntro: 'Cada estudiante simulado tiene una etiqueta fija: “admitido” o “no admitido”. La tabla compara la decisión de la IA con esa etiqueta.',
    matrixDemoExample: 'Por ejemplo, FP cuenta a los estudiantes que la IA admite cuya etiqueta indica “no admitido”.',
    matrixDemoAxes: 'Las filas muestran la predicción de IA. Las columnas muestran la etiqueta simulada.',
    matrixDemoCell: 'Predicción de IA: {prediction}; etiqueta simulada: {label}',
    confusionHelpTitle: 'Cómo leer la matriz de confusión',
    groundTruthPositive: 'Etiqueta positiva',
    groundTruthNegative: 'Etiqueta negativa',
    matrixSamples: 'Estudiantes con etiqueta',
    matrixPartial: 'Las muestras sin etiqueta quedan fuera de la matriz.',
    matrixCellShare: '{count} estudiantes ({percent}% de todos los estudiantes con etiqueta)',
    matrixBarHelp: 'Una barra más larga significa más estudiantes en esa celda.',
    matrixMissing: 'Sin etiquetas reales',
    matrixHelp: 'Las filas muestran el resultado predicho por la IA según la política elegida. Las columnas muestran la etiqueta real guardada en los datos: positiva o negativa.',
    matrixDemoHelp: 'Estas etiquetas se generan para la demo y no proceden de registros reales de admisión.',
    matrixScope: 'Cambiar la política o el umbral actualiza las predicciones. Las etiquetas quedan fijas. Los cambios del Editor contrafactual conservan los perfiles originales y estos conteos.',
    matrixCells: { tp: 'Verdadero positivo: predice admisión; etiqueta positiva', fp: 'Falso positivo: predice admisión; etiqueta negativa', fn: 'Falso negativo: predice no admisión; etiqueta positiva', tn: 'Verdadero negativo: predice no admisión; etiqueta negativa' },
    credits: 'Créditos',
    themeGraphite: 'Oscuro',
    themeSummer: 'Verano',
    themeLight: 'Claro',
    switchTheme: 'Cambiar tema',
    languageLabel: 'Idioma',
    mineEdgeCases: 'Buscar casos límite',
    edgeCasesFound: 'más cerca del corte',
    fromCutoff: 'del corte',
    visualizer: 'Visualizador contrafactual',
    visualizerSubtitle: 'Arrastra un estudiante o el umbral para explorar los resultados.',
    studentDragHelp: 'Arrastra para cambiar GPA y SAT Percentile. Pulsa Esc para deshacer este movimiento.',
    boundaryHelpTitle: 'Cómo leer el límite de admisión',
    boundaryShared: 'Límite de admisión común',
    boundaryBand: 'Zona dependiente del contexto',
    boundarySelected: 'Corte para el contexto de este estudiante',
    boundaryEdited: 'Corte para el contexto editado',
    boundaryAll: 'Todos los puntajes del gráfico califican con este contexto',
    boundaryNone: 'Ningún puntaje del gráfico califica con este contexto',
    boundaryEdge: 'Corte en el borde del gráfico',
    boundaryAcademicHelp: 'La línea marca el corte de admisión para GPA y SAT Percentile. Los estudiantes sobre la línea se admiten. Enfoque académico usa la misma línea para todos.',
    boundaryContextHelp: 'Estas políticas también dan puntos por primera generación, deporte y residencia en el estado. La banda muestra dónde esos puntos pueden cambiar la decisión con el mismo GPA y SAT Percentile.',
    boundarySelectedHelp: 'Selecciona un estudiante para ver su línea de admisión. Cambiar su contexto puede moverla. La banda muestra el rango para todos los contextos. Los demás estudiantes conservan sus resultados.',
    boundaryFormula: 'Puntos GPA + puntos SAT Percentile + puntos de contexto = umbral',
    boundaryDragHint: 'Arrastra para ajustar',
    boundaryDragging: 'Ajustando el umbral',
    boundaryUseSlider: 'Usa el control inferior',
    boundaryDragHelp: 'Arrastra la línea o la banda hacia arriba o a la derecha para subir el corte; hacia abajo o a la izquierda para bajarlo. Pulsa Esc para deshacer el movimiento.',
    whatIfStudent: 'Estudiante hipotético',
    originalProfile: 'Perfil original · sin cambios',
    controlsLabel: 'Controles de exploración',
    aboutPolicy: 'Acerca de esta política',
    choosePolicy: 'Estudio de políticas',
    choosePolicyDesc: 'Elige cómo cuentan el GPA, el SAT Percentile y el contexto.',
    remember: 'Recuerda',
    simulationNote: 'Esta es una simulación simplificada, no un sistema real de admisión. La política refleja decisiones humanas sobre lo que importa.',
    seeAffected: 'Observa a quién afecta',
    seeAffectedDesc: 'Cada punto representa a un estudiante simulado. Haz clic para investigar una decisión.',
    seeAffectedDescApproved: 'Cada punto es un registro de la versión autorizada para clase. Haz clic para investigar una decisión.',
    chartLabel: 'Gráfico de resultados de admisión. GPA está en el eje horizontal y SAT Percentile en el vertical. Selecciona un punto para investigar la decisión.',
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
    backgroundField: 'Campo de contexto',
    backgroundValue: 'Valor',
    backgroundOriginal: 'Original: {value}',
    backgroundChanges: 'Campos editados: {count}',
    backgroundUnchanged: 'Sin cambios de contexto',
    nonAthlete: 'No deportista',
    whatIfTitle: 'Editor contrafactual',
    whatIfDesc: 'Modifica un perfil y compara los resultados.',
    thresholdTitle: 'Umbral de admisión',
    thresholdRule: 'Puntuación ≥ umbral → admisión',
    thresholdHelpTitle: 'Acerca del umbral de admisión',
    thresholdHelp: 'Un estudiante se admite cuando su puntuación alcanza el umbral. Un umbral más alto hace la admisión más difícil; uno más bajo la hace más fácil.',
    thresholdPreset: 'Cada política tiene un corte inicial. Restablecer recupera ese valor. Cambiar el corte conserva las reglas de puntuación.',
    thresholdDefault: 'Inicial: {value}',
    thresholdReset: 'Restablecer umbral',
    outcomeFlipped: 'Resultado cambiado',
    outcomeComparison: 'Original: {original} → Editado: {edited}. Comparados con la misma política y el mismo umbral.',
    adjustedPosition: 'Posición ajustada',
    adjustedSamePosition: 'Perfil ajustado · misma posición GPA/SAT Percentile',
    chartAxisNote: 'Solo GPA y SAT Percentile determinan la posición del punto. Los puntos de contexto pueden cambiar el resultado sin moverlo.',
    reset: 'Restablecer',
    selectStudent: 'Selecciona un estudiante en el gráfico',
    selectStudentDesc: 'Arrastra un punto para probar otras notas o usa estos controles. El perfil original se conserva.',
    decisionScore: 'Puntuación de decisión',
    scoreHelpTitle: 'Cómo se calcula la puntuación',
    scoreHelpDescription: 'La política suma los puntos de GPA, SAT Percentile y los factores de contexto que incluye.',
    scoreHelpRule: 'Una puntuación de {cutoff} o más significa admisión. Por debajo de {cutoff} significa no admisión.',
    scoreHelpCaution: 'Una puntuación de 70 no significa un 70% de probabilidad de admisión.',
    cutoff: 'Corte',
    datasetSynthetic: 'Datos sintéticos para clase · {count} solicitantes simulados · Sin datos reales',
    datasetApproved: 'Datos desidentificados autorizados · {count} registros · Vista pública',
    datasetLoading: 'Cargando los datos para clase…',
    datasetFallback: 'API de datos no disponible · Se usa la demostración sintética incluida',
    footerTitle: 'Prototipo simplificado de aprendizaje de Ética de IA de CounterLens',
    creditsTitle: 'Equipo del proyecto e institución',
    principalInvestigator: 'Investigadora principal',
    researcherDeveloper: 'Investigación y desarrollo',
    projectLead: 'Prof. Rebecca Williams',
    contributorRole: 'Estudiante de doctorado',
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
        description: 'Solo GPA y SAT Percentile, con un corte de admisión estricto.',
      },
      holistic: {
        name: 'Evaluación integral',
        shortName: 'Notas académicas + puntos de contexto',
        description: 'Usa GPA y SAT Percentile, con puntos adicionales por primera generación, deporte y residencia en el estado.',
      },
      opportunity: {
        name: 'Atención a oportunidades',
        shortName: 'Más puntos para estudiantes de primera generación',
        description: 'Da más puntos por primera generación y menos peso al GPA y al SAT Percentile que Evaluación integral. También añade puntos por deporte y residencia en el estado.',
        details: [
          'Los estudiantes de primera generación reciben {firstGen} puntos extra aquí y {comparisonFirstGen} en Evaluación integral.',
          'El corte inicial es {cutoff}; Evaluación integral empieza en {comparisonCutoff}. Usa el control para probar otro corte.',
        ],
        caution: 'Los ingresos familiares y los recursos escolares no se incluyen en esta simulación.',
      },
    },
  },
};

const formatCopy = (template, values) => Object.entries(values).reduce(
  (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
  template,
);

const percentage = (part, total) => (total ? Math.round((part / total) * 100) : 0);

// Keep editor choices explicit: only expose fields supported by the current
// scoring model and approved for counterfactual use in the dataset contract.
const BACKGROUND_FIELDS = [
  { key: 'firstGen', label: 'firstGeneration', positive: 'yes', negative: 'no' },
  { key: 'athlete', label: 'athleticStatus', positive: 'athlete', negative: 'nonAthlete' },
  { key: 'resident', label: 'residency', positive: 'inState', negative: 'outOfState' },
];

const BackgroundEditor = ({ features, student, original, onChange, t, lang, explorer = false }) => {
  const fields = BACKGROUND_FIELDS.filter(field => features.some(feature =>
    feature.key === field.key && feature.role === 'input' && feature.type === 'boolean'
      && feature.allowedUses.includes('counterfactual')));
  if (!fields.length) return null;

  return (
    <div className="workspace-background-selects">
      {fields.map(field => {
        const categoricalResidency = explorer && field.key === 'resident';
        const residencyOptions = categoricalResidency ? getExplorerOptions('residency', [student, original], []) : [];
        const residencyOption = value => {
          const missing = value === null || value === undefined
            || (typeof value === 'string' && !value.trim())
            || (typeof value === 'number' && !Number.isFinite(value))
            || !['string', 'number', 'boolean'].includes(typeof value);
          return residencyOptions.find(option => option.missing ? missing
            : value === (Object.hasOwn(option, 'rawValue') ? option.rawValue : option.value));
        };
        const residencyLabel = value => {
          const names = residencyOption(value)?.label;
          return names?.[lang] || names?.en || value;
        };
        const changed = categoricalResidency ? student.residency !== original.residency : student[field.key] !== original[field.key];
        const originalLabel = formatCopy(t.backgroundOriginal, {
          value: categoricalResidency ? residencyLabel(original.residency) : t[original[field.key] ? field.positive : field.negative],
        });
        return (
          <div key={field.key} className="workspace-background-field">
            <label htmlFor={`background-${field.key}`}>{field.key === 'firstGen' ? t.firstGenerationShort : t[field.label]}</label>
            <div className="workspace-select-wrap" data-edited={changed}>
              <select id={`background-${field.key}`} value={categoricalResidency ? residencyOption(student.residency)?.value ?? '' : String(student[field.key])}
                aria-describedby={`background-original-${field.key}`}
                onChange={event => {
                  if (!categoricalResidency) return onChange(field.key, event.target.value === 'true');
                  const option = residencyOptions.find(item => item.value === event.target.value);
                  if (!option) return;
                  const value = option.missing
                    ? (residencyOption(student.residency)?.missing ? student.residency : original.residency)
                    : Object.hasOwn(option, 'rawValue') ? option.rawValue : option.value;
                  onChange('residency', value);
                }}>
                {categoricalResidency ? residencyOptions.map(option => <option key={option.value} value={option.value}>{option.label[lang] || option.label.en}</option>) : <>
                  <option value="true">{t[field.positive]}</option>
                  <option value="false">{t[field.negative]}</option>
                </>}
              </select>
              <ChevronDown aria-hidden="true" />
            </div>
            <div id={`background-original-${field.key}`} className="workspace-background-original"
              data-edited={changed} aria-live="polite">{originalLabel}</div>
          </div>
        );
      })}
    </div>
  );
};

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
      <div className="text-slate-300">GPA {student.gpa.toFixed(2)} · SAT Percentile {student.sat}</div>
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

const rankStudentsByCutoff = (students, policy) => students
  .filter(student => Number.isFinite(student.gpa) && Number.isFinite(student.sat))
  .map(student => ({ ...student, distance: Math.abs(scoreStudent(student, policy) - policy.threshold) }))
  .filter(student => Number.isFinite(student.distance))
  .sort((left, right) => left.distance - right.distance);

const createInitialWorkspace = (view, preferredPolicyId = 'academic') => {
  const preview = buildExplorerDemoView(view);
  const synthetic = view.dataset.sourceType === 'synthetic';
  const students = synthetic ? enrichExplorerRecords(preview.records) : preview.records;
  const policies = synthetic ? EXPLORER_SIMULATION_POLICIES : view.policies;
  const policy = policies.find(item => item.id === preferredPolicyId) || policies[0];
  const nearestId = rankStudentsByCutoff(students, policy)[0]?.id;
  return { view, policyId: policy.id, student: students.find(student => student.id === nearestId) || null };
};

// Preview eligibility is part of cohort identity: changed release/privacy
// metadata can disable the 200-record expansion even if source records match.
const sameClassroomData = (left, right) => left.schemaVersion === right.schemaVersion
  && ['id', 'version', 'sourceType', 'releaseStatus', 'recordCount'].every(key => left.dataset[key] === right.dataset[key])
  && Object.hasOwn(left, 'preview') === Object.hasOwn(right, 'preview')
  && ['records', 'features', 'policies', 'privacy', 'preview'].every(key => samePublishedValue(left[key], right[key]));

const SimplifiedApp = () => {
  const [initialWorkspace] = useState(() => createInitialWorkspace(createBundledClassroomView()));
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const [showCredits, setShowCredits] = useState(false);
  const [isMining, setIsMining] = useState(false);
  // Keep the other visualizers dormant while the workspace focuses on Feature Explorer.
  const boundaryView = 'features';
  const [policyId, setPolicyId] = useState(initialWorkspace.policyId);
  const [thresholdOverride, setThresholdOverride] = useState(null);
  const [isBoundaryDragging, setIsBoundaryDragging] = useState(false);
  const [selectedId, setSelectedId] = useState(initialWorkspace.student?.id ?? null);
  const [draftStudent, setDraftStudent] = useState(() => initialWorkspace.student ? { ...initialWorkspace.student } : null);
  const [explorerBinning, setExplorerBinning] = useState({ method: 'fixed', count: 3, thresholds: [50000, 75000, 100000] });
  const [explainedPolicyId, setExplainedPolicyId] = useState(null);
  const policyHelpTrigger = useRef(null);
  const [classroomView, setClassroomView] = useState(initialWorkspace.view);
  const [dataState, setDataState] = useState(isClassroomApiConfigured ? 'loading' : 'bundled');
  const [, setDataError] = useState('');
  const trackedPageView = useRef('');
  const decisionBadgeRef = useRef(null);
  const previousDecision = useRef(null);
  const latestPolicyId = useRef(policyId);

  useEffect(() => { latestPolicyId.current = policyId; }, [policyId]);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const viewCopy = BOUNDARY_VIEWS[lang] || BOUNDARY_VIEWS.en;
  const isFeatureView = boundaryView === 'features';
  const isScenarioView = boundaryView === 'scenarios' || isFeatureView;
  const boundaryHelpTitle = isScenarioView ? viewCopy[boundaryView] : boundaryView === 'breakdown' ? t.scoreHelpTitle : t.boundaryHelpTitle;
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
  const hasSyntheticReference = classroomView.dataset.sourceType === 'synthetic';
  const usesExplorerSimulation = hasSyntheticReference && isFeatureView;
  const policyCopy = usesExplorerSimulation ? (EXPLORER_POLICY_COPY[lang] || EXPLORER_POLICY_COPY.en) : t.policies;
  const explorerView = useMemo(() => isFeatureView ? buildExplorerDemoView(classroomView) : classroomView,
    [classroomView, isFeatureView]);
  const students = useMemo(() => hasSyntheticReference && isFeatureView
    ? enrichExplorerRecords(explorerView.records) : explorerView.records,
  [explorerView.records, hasSyntheticReference, isFeatureView]);
  const explorerIncomeBins = useMemo(() => buildIncomeBins(students, explorerBinning), [students, explorerBinning]);
  const referenceFeatures = classroomView.features.filter(feature => feature.role === 'outcome' && feature.type === 'boolean' && feature.allowedUses.includes('compare'));
  // Avoid guessing a target when a release contains multiple outcomes.
  const referenceFeature = referenceFeatures.length === 1 ? referenceFeatures[0] : null;
  // Admission wording describes this demo target only, not arbitrary real outcomes.
  const hasDemoAdmissionLabels = hasSyntheticReference && referenceFeature?.key === 'referenceOutcome';
  const matrixHelp = hasDemoAdmissionLabels ? t.matrixDemoAxes : t.matrixHelp;
  const matrixCells = hasDemoAdmissionLabels
    ? Object.fromEntries(['tp', 'fp', 'fn', 'tn'].map(cell => [cell, formatCopy(t.matrixDemoCell, {
      prediction: cell === 'tp' || cell === 'fp' ? t.admitted : t.notAdmitted,
      label: cell === 'tp' || cell === 'fn' ? t.admitted : t.notAdmitted,
    })])) : t.matrixCells;
  const policies = useMemo(
    () => (usesExplorerSimulation ? EXPLORER_SIMULATION_POLICIES : classroomView.policies).map((item) => ({
      ...item,
      ...(POLICY_PRESENTATION[item.id] ?? {
        accent: '#2563eb',
        graphiteAccent: '#8ea7ff',
        summerAccent: '#43d3c1',
      }),
    })),
    [classroomView.policies, usesExplorerSimulation],
  );
  const explainedPolicySettings = policies.find(item => item.id === explainedPolicyId);
  const explainedPolicy = explainedPolicySettings ? policyCopy[explainedPolicyId] ?? {
    name: policyDisplayName(explainedPolicySettings, policyCopy, lang), shortName: '', description: '',
  } : null;
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
  const hasDraggableBoundary = Boolean(currentBoundary?.points.length || boundaryBand.polygon.length);

  const outcomes = useMemo(
    () => students.map((student) => ({ ...student, admitted: getDecision(student, policy) })),
    [policy, students],
  );
  const explorerOutcomeGroups = useMemo(() => summarizeExplorerOutcomes({ records: students, policy, incomeBins: explorerIncomeBins }),
    [students, policy, explorerIncomeBins]);
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
    () => rankStudentsByCutoff(outcomes, policy).slice(0, 8),
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
  const decisionFlipped = selectedStudent && draftStudent && originalDecision !== draftDecision;
  const draftProfileChanged = Boolean(selectedStudent && draftStudent && (
    selectedStudent.gpa !== draftStudent.gpa ||
    selectedStudent.sat !== draftStudent.sat ||
    selectedStudent.firstGen !== draftStudent.firstGen ||
    selectedStudent.athlete !== draftStudent.athlete ||
    selectedStudent.resident !== draftStudent.resident ||
    EXPLORER_FEATURES.some(feature => selectedStudent[feature.key] !== draftStudent[feature.key])
  ));
  const plotPositionChanged = Boolean(selectedStudent && draftStudent && (
    selectedStudent.gpa !== draftStudent.gpa || selectedStudent.sat !== draftStudent.sat
  ));
  const datasetId = classroomView.dataset.id;
  const datasetVersion = classroomView.dataset.version;

  useEffect(() => {
    // The bundled view is already initialized, including its nearest student.
    if (!isClassroomApiConfigured) return undefined;
    let active = true;
    loadClassroomView()
      .then(({ view, source }) => {
        if (!active) return;
        setClassroomView(view);
        setDataState(source);
        setDataError('');
        // An API copy of the same release must not undo a selection, explicit
        // clear, counterfactual edit, or cutoff adjustment made while loading.
        if (!sameClassroomData(initialWorkspace.view, view)) {
          const incoming = createInitialWorkspace(view, latestPolicyId.current);
          setPolicyId(incoming.policyId);
          setSelectedId(incoming.student?.id ?? null);
          setDraftStudent(incoming.student ? { ...incoming.student } : null);
          setThresholdOverride(null);
          setIsMining(false);
        }
      })
      .catch((error) => {
        if (!active) return;
        setDataState('error');
        setDataError(error.message);
      });
    return () => {
      active = false;
    };
  }, [initialWorkspace]);

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
    if (draftStudent) applyDraft({ ...draftStudent, [field]: value,
      // Only the dormant legacy model uses a separate resident boolean.
      ...(!isExplorerPolicy(policy) && hasSyntheticReference && field === 'residency' && ['instate', 'outofstate'].includes(value) ? { resident: value === 'instate' } : {}),
    });
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

  const { isStudentDragging, studentDragHandlers } = useStudentDrag({
    students, selectedStudent, draftStudent, onSelect: selectStudent, onEdit: applyDraft,
    setSelectedId, setDraftStudent, contextKey: `${datasetId}:${datasetVersion}:${policy.id}:${dataState}:${boundaryView}`, disabled: isBoundaryDragging || boundaryView !== 'band',
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
                <ul className="space-y-3">
                  {RESEARCH_CONTRIBUTORS.map(name => (
                    <li key={name}>
                      <div className="font-semibold text-white">{name}</div>
                      <div className="mt-0.5 text-xs font-medium text-slate-400">{t.contributorRole}</div>
                    </li>
                  ))}
                </ul>
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

          <section className={`workspace-visualizer simplified-panel flex flex-col rounded-2xl border border-slate-800 bg-slate-900/65 shadow-xl shadow-black/10 ${isScenarioView ? 'has-background-scenarios' : ''} ${isFeatureView ? 'has-feature-explorer' : ''}`}
            onClick={event => {
              if (isFeatureView) {
                // Guard actual controls and marks, not their full-width rows:
                // the unused space beside the picker is still canvas background.
                if (!event.target.closest?.('button, select, input, textarea, label, a, summary, [role="button"], [data-explorer-student], [data-draft-student], [data-profile-pair], [data-explorer-lens], [data-policy-help], .workspace-analysis-bar, .fex-profile-item')) {
                  selectStudent(null);
                }
                return;
              }
              if (isScenarioView && !event.target.closest?.('.background-scenario-panel, .workspace-analysis-bar, [data-boundary-ui], button, select, input, label, a, [data-policy-help]')) {
                selectStudent(null);
              }
            }}>
              <div className="workspace-visualizer-heading">
                <div className="workspace-visualizer-intro">
                  <h2 className="workspace-visualizer-title font-bold text-white">{t.visualizer}</h2>
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
                  <span className="workspace-adjusted-legend flex items-center gap-1.5 font-medium" style={{ visibility: draftProfileChanged && !isScenarioView ? 'visible' : 'hidden' }} aria-hidden={!draftProfileChanged || isScenarioView}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed" />
                    {t.whatIfStudent}
                  </span>
                </div>
                </div>
              </div>


              <div
                className={`simplified-inset simplified-scatter-plot w-full rounded-xl border border-slate-800/80 bg-slate-950/45 p-2 ${isScenarioView ? 'is-background-scenarios' : ''} ${isBoundaryDragging ? 'is-boundary-dragging' : ''} ${isStudentDragging ? 'is-student-dragging' : ''}`}
                role="group"
                aria-label={boundaryView === 'band' ? t.chartLabel : viewCopy[boundaryView]}
                {...studentDragHandlers}
                onMouseDown={(event) => { if (!event.target.closest?.('[data-boundary-ui]')) event.preventDefault(); }}
                onClick={(event) => {
                  if (!event.target.closest?.('.recharts-scatter-symbol, [data-boundary-ui], [data-draft-student]')) {
                    setSelectedId(null);
                    setDraftStudent(null);
                  }
                }}
              >
                <span className="sr-only">{isScenarioView ? viewCopy[`${boundaryView}Help`] : boundaryView === 'score' ? viewCopy.scoreHelp : boundaryView === 'breakdown' ? viewCopy.breakdownHelp : t.chartLabel}</span>
                {boundaryView === 'band' && <div data-boundary-ui className="workspace-boundary-key">
                  {boundaryView === 'band' && <span className="workspace-boundary-drag-hint" title={t.boundaryDragHelp}>
                    <MoveUpRight className="h-3 w-3" aria-hidden="true" />
                    {isBoundaryDragging ? t.boundaryDragging : hasDraggableBoundary ? t.boundaryDragHint : t.boundaryUseSlider}
                  </span>}
                </div>}
                {explainedPolicyId === 'boundary' && (
                  <div id="boundary-help" data-boundary-ui data-policy-help role="region" aria-labelledby="boundary-help-title" className="workspace-boundary-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <h3 id="boundary-help-title" className="text-sm font-bold text-white">{boundaryHelpTitle}</h3>
                      <button type="button" className="rounded-md p-1" aria-label={t.close} onClick={() => { setExplainedPolicyId(null); policyHelpTrigger.current?.focus(); }}><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2">{isScenarioView ? viewCopy[`${boundaryView}Help`] : boundaryView === 'score' ? viewCopy.scoreHelp : boundaryView === 'breakdown' ? viewCopy.breakdownHelp : boundaryBand.hasContext ? t.boundaryContextHelp : t.boundaryAcademicHelp}</p>
                    {boundaryView === 'band' && <p className="mt-2">{viewCopy.bandDetail}</p>}
                    {boundaryView === 'band' && boundaryBand.hasContext && <p className="mt-2">{t.boundarySelectedHelp}</p>}
                    {boundaryView === 'score' && <p className="mt-2">{boundaryBand.hasContext ? viewCopy.scoreDetail : viewCopy.scoreNoBackground}</p>}
                    <p className="mt-2 font-semibold text-blue-300">{isScenarioView ? viewCopy[`${boundaryView}Formula`] : boundaryView === 'breakdown' ? viewCopy.breakdownFormula : t.boundaryFormula}</p>
                    <p className="mt-2">{isScenarioView ? viewCopy[`${boundaryView}Editing`] : boundaryView === 'score' ? viewCopy.scoreEditing : boundaryView === 'breakdown' ? viewCopy.breakdownEditing : t.boundaryDragHelp}</p>
                  </div>
                )}
                {boundaryView === 'score' ? <ScoreBoundaryView students={students} policy={policy}
                  selectedStudent={selectedStudent} draftStudent={draftStudent} isMining={isMining} edgeCaseIds={edgeCaseIds}
                  onSelect={selectStudent} onClear={() => selectStudent(null)} isLight={isLight} colors={outcomeColors} lang={lang} />
                  : isFeatureView ? <FeatureExplorer students={students} policy={policy}
                    selectedStudent={selectedStudent} draftStudent={draftStudent} onSelect={selectStudent}
                    isLight={isLight} colors={outcomeColors} lang={lang} isMining={isMining} edgeCaseIds={edgeCaseIds}
                    binning={explorerBinning} onBinningChange={setExplorerBinning} incomeBins={explorerIncomeBins} />
                  : isScenarioView ? <BackgroundScenariosView students={students} policy={policy}
                    selectedStudent={selectedStudent} draftStudent={draftStudent} onSelect={selectStudent}
                    isLight={isLight} colors={outcomeColors} lang={lang} isMining={isMining} edgeCaseIds={edgeCaseIds} />
                  : boundaryView === 'breakdown' ? <ScoreBreakdownView students={students} policy={policy}
                    selectedStudent={selectedStudent} draftStudent={draftStudent} onSelect={selectStudent}
                    isLight={isLight} colors={outcomeColors} lang={lang} isMining={isMining} edgeCaseIds={edgeCaseIds} /> : <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 32, right: 24, bottom: 22, left: 4 }}>
                    <CartesianGrid stroke={isLight ? '#dbe3ee' : darkPalette.grid} strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      type="number"
                      dataKey="gpa"
                      domain={ADMISSION_DOMAINS.gpa}
                      ticks={[2.6, 3, 3.4, 3.8, 4]}
                      stroke={isLight ? '#94a3b8' : darkPalette.axis}
                      tick={{ fill: isLight ? '#475569' : darkPalette.muted, fontSize: 11 }}
                      label={{ value: 'GPA', position: 'insideBottomRight', offset: -12, fill: isLight ? '#475569' : darkPalette.muted, fontSize: 12 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="sat"
                      domain={ADMISSION_DOMAINS.sat}
                      ticks={[60, 70, 80, 90, 100]}
                      stroke={isLight ? '#94a3b8' : darkPalette.axis}
                      tick={{ fill: isLight ? '#475569' : darkPalette.muted, fontSize: 11 }}
                      label={{ value: 'SAT Percentile', angle: -90, position: 'insideLeft', offset: 12, fill: isLight ? '#475569' : darkPalette.muted, fontSize: 12 }}
                    />
                    <ReferenceArea x1={ADMISSION_DOMAINS.gpa[0]} x2={4} y1={ADMISSION_DOMAINS.sat[0]} y2={ADMISSION_DOMAINS.sat[1]} zIndex={-50} shape={
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
                                : (isSelected ? `drop-shadow(0 0 4px ${isLight ? 'rgba(120, 183, 255, 0.85)' : darkPalette.selectedGlow})` : 'none'),
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
                </ResponsiveContainer>}
              </div>

              <div className="workspace-analysis-bar">
              <section className={`workspace-threshold ${isBoundaryDragging ? 'is-boundary-dragging' : ''}`} aria-labelledby="threshold-title" style={{ '--threshold-position': `${policy.threshold}%` }}>
                <div className="workspace-threshold-heading">
                  <div className="workspace-threshold-name">
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
                <span id="threshold-rule" className="sr-only">{t.thresholdRule}</span>
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
                    <p className="mt-2 font-semibold">{t.thresholdRule}</p>
                    <p className="mt-2">{t.thresholdHelp}</p>
                    <p className="mt-2">{t.thresholdPreset}</p>
                    <p className="mt-2">{t.boundaryDragHelp}</p>
                  </div>
                )}
              </section>

              <section className="workspace-confusion" aria-labelledby="confusion-title">
                <div className="workspace-confusion-heading">
                  <h3 id="confusion-title">{t.confusionTitle}</h3>
                  <span className="workspace-confusion-source" title={!matrix.labeled ? t.matrixMissing : undefined}>
                    <span>{t.matrixSamples} <strong>{matrix.labeled}</strong></span>
                  </span>
                  <button type="button" className="workspace-inline-help rounded-md" aria-label={t.confusionHelpTitle} aria-expanded={explainedPolicyId === 'confusion'} aria-controls="confusion-help" onClick={(event) => {
                    policyHelpTrigger.current = event.currentTarget;
                    setExplainedPolicyId(explainedPolicyId === 'confusion' ? null : 'confusion');
                  }}><Info className="h-4 w-4" /></button>
                </div>
                <table className="workspace-confusion-table">
                  <caption className="sr-only">{matrixHelp}</caption>
                  <thead>
                    <tr><th rowSpan={2} scope="col">{t.matrixDecision}</th><th colSpan={2} scope="colgroup">{hasDemoAdmissionLabels ? t.matrixSimulatedLabel : t.matrixDataLabel}</th></tr>
                    <tr><th scope="col">{hasDemoAdmissionLabels ? t.admitted : t.groundTruthPositive}</th><th scope="col">{hasDemoAdmissionLabels ? t.notAdmitted : t.groundTruthNegative}</th></tr>
                  </thead>
                  <tbody>
                    {[[t.admitted, ['tp', 'fp']], [t.notAdmitted, ['fn', 'tn']]].map(([label, cells]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        {cells.map(cell => {
                          const share = matrix.labeled ? matrix[cell] / matrix.labeled * 100 : 0;
                          const description = `${matrixCells[cell]}: ${matrix.labeled ? formatCopy(t.matrixCellShare, { count: matrix[cell], percent: Math.round(share) }) : t.matrixMissing}`;
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
                {explainedPolicyId === 'confusion' && (
                  <div id="confusion-help" data-policy-help role="region" aria-labelledby="confusion-help-title" className="workspace-confusion-explanation border border-slate-700 bg-slate-900 text-slate-300 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                      <h3 id="confusion-help-title" className="text-sm font-bold text-white">{t.confusionHelpTitle}</h3>
                      <button type="button" aria-label={t.close} className="rounded-md p-1" onClick={() => { setExplainedPolicyId(null); policyHelpTrigger.current?.focus(); }}><X className="h-4 w-4" /></button>
                    </div>
                    {hasDemoAdmissionLabels && <p className="mt-2">{t.matrixDemoIntro}</p>}
                    <p className="mt-2">{matrixHelp}</p>
                    {hasDemoAdmissionLabels && <p className="mt-2 font-semibold">{t.matrixDemoExample}</p>}
                    <p className="mt-2">{t.matrixBarHelp}</p>
                    <ul className="my-2 space-y-1">{Object.entries(matrixCells).map(([key, label]) => <li key={key}><strong>{key.toUpperCase()}</strong> · {label}</li>)}</ul>
                    {hasDemoAdmissionLabels && <p className="mt-2">{t.matrixDemoHelp}</p>}
                    <p className="mt-2">{t.matrixScope}</p>
                    {matrix.missing > 0 && <p className="mt-2">{matrix.labeled ? t.matrixPartial : t.matrixMissing}</p>}
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
                </div>
              </div>

              <div className="workspace-policy-picker">
                <div className="workspace-policy-select-wrap">
                  <select id="workspace-policy-select" aria-label={t.choosePolicy} value={policy.id}
                      onChange={event => {
                        const nextPolicyId = event.target.value;
                        setExplainedPolicyId(null);
                        setPolicyId(nextPolicyId);
                        setIsMining(false);
                        if (nextPolicyId !== policy.id) {
                          setThresholdOverride(null);
                          trackAnonymousEvent('policy_selected', {
                            datasetId,
                            datasetVersion,
                            policyId: nextPolicyId,
                            locale: lang,
                            theme,
                          });
                        }
                      }}>
                    {policies.map(item => <option key={item.id} value={item.id}>{policyDisplayName(item, policyCopy, lang)}</option>)}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </div>
                    <button
                      type="button"
                      className="workspace-policy-info rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                      aria-label={`${t.aboutPolicy}: ${policyDisplayName(policy, policyCopy, lang)}`}
                      aria-expanded={explainedPolicyId === policy.id}
                      aria-controls="policy-help"
                      onClick={(event) => {
                        policyHelpTrigger.current = event.currentTarget;
                        setExplainedPolicyId(explainedPolicyId === policy.id ? null : policy.id);
                      }}
                    >
                      <Info aria-hidden="true" />
                    </button>
              </div>
              <div className="workspace-policy-summary" role="status" aria-live="polite"
                aria-label={formatCopy(t.admittedCountLabel, { admitted: policyAdmissionCounts[policy.id], total: students.length })}>
                <strong>{policyAdmissionCounts[policy.id]} / {students.length}</strong>
                <span>{lang === 'en' ? 'admitted' : t.admitted}</span>
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
                  {isExplorerPolicy(explainedPolicySettings) ? <ExplorerPolicyDetails policy={explainedPolicySettings.id === policy.id ? policy : explainedPolicySettings} lang={lang} /> : <>
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
                  </>}
                </div>
              )}

            </section>


              <section className={`workspace-counterfactual simplified-panel flex flex-col rounded-2xl border border-blue-400/20 bg-slate-900/65 ${isFeatureView ? 'has-explorer-editor' : ''} ${isStudentDragging ? 'is-student-dragging' : ''}`}>
                <div className="mb-2.5 flex shrink-0 items-start justify-between gap-2 xl:mb-1.5">
                  <div className="flex items-start gap-2">
                    <div className="simplified-step flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">2</div>
                    <div>
                      <h2 className="text-[15px] font-bold leading-tight text-white">{t.whatIfTitle}</h2>
                    </div>
                  </div>
                </div>

                {!draftStudent && !isFeatureView ? (
                  <div className="workspace-empty simplified-inset flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/35 text-center">
                    <GraduationCap className="h-8 w-8 text-slate-700" />
                    <h3 className="mt-3 text-sm font-semibold text-slate-300">{t.selectStudent}</h3>
                    <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">{isScenarioView ? viewCopy[`${boundaryView}SelectHint`] : boundaryView === 'score' ? viewCopy.scoreSelectHint : boundaryView === 'breakdown' ? viewCopy.breakdownSelectHint : t.selectStudentDesc}</p>
                  </div>
                ) : (
                  <div className="workspace-draft-controls" data-empty={!draftStudent}>
                    <div className="workspace-profile-bar rounded-xl bg-slate-950/55 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="workspace-editor-student text-xs font-semibold text-white">
                          <span>{t.student}</span><span>{draftStudent?.id ?? '—'}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div ref={decisionBadgeRef} role="status" aria-live="polite" aria-atomic="true"
                          title={draftStudent ? formatCopy(t.outcomeComparison, { original: originalDecision ? t.admitted : t.notAdmitted, edited: draftDecision ? t.admitted : t.notAdmitted }) : undefined}
                          data-flipped={Boolean(decisionFlipped)} data-admitted={draftStudent ? draftDecision : undefined}
                          className={`workspace-outcome-badge ${decisionFlipped ? 'is-flipped' : ''} ${!draftStudent ? 'is-empty' : draftDecision ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                          <span className="workspace-outcome-main">{!draftStudent ? '—' : draftDecision ? t.admitted : t.notAdmitted}</span>
                          <span className="workspace-outcome-change" aria-hidden={!decisionFlipped}>
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />{t.outcomeFlipped}
                          </span>
                          {draftStudent && <span className="sr-only">{formatCopy(t.outcomeComparison, { original: originalDecision ? t.admitted : t.notAdmitted, edited: draftDecision ? t.admitted : t.notAdmitted })}</span>}
                        </div>
                        <button
                          type="button"
                          disabled={!draftStudent}
                          onClick={() => setDraftStudent({ ...selectedStudent })}
                          className="flex min-h-8 items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:border-slate-600 hover:text-white"
                        >
                          <RotateCcw className="h-3 w-3" /> {t.reset}
                        </button>
                      </div>
                    </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <label htmlFor="gpa-slider" className="font-medium text-slate-300">GPA</label>
                          <span className="workspace-academic-value font-mono text-blue-300">
                            {draftStudent && draftStudent.gpa !== selectedStudent.gpa && <span className="workspace-academic-delta" title={formatCopy(t.backgroundOriginal, { value: selectedStudent.gpa.toFixed(2) })}>Δ {draftStudent.gpa > selectedStudent.gpa ? '+' : ''}{(draftStudent.gpa - selectedStudent.gpa).toFixed(2)}</span>}
                            {draftStudent ? draftStudent.gpa.toFixed(2) : '—'}
                          </span>
                        </div>
                        <input
                          id="gpa-slider"
                          type="range"
                          min={ADMISSION_DOMAINS.gpa[0]}
                          max="4"
                          step="0.01"
                          value={draftStudent?.gpa ?? ADMISSION_DOMAINS.gpa[0]}
                          disabled={!draftStudent}
                          aria-valuetext={!draftStudent ? t.selectStudent : undefined}
                          onInput={(event) => updateDraft('gpa', Number(event.currentTarget.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <label htmlFor="sat-slider" className="font-medium text-slate-300" title="SAT User Group percentile · College Board table, accessed 2026-10-14. Each step is one percentile point.">SAT Percentile</label>
                          <span className="workspace-academic-value font-mono text-blue-300">
                            {draftStudent && draftStudent.sat !== selectedStudent.sat && <span className="workspace-academic-delta" title={formatCopy(t.backgroundOriginal, { value: selectedStudent.sat })}>Δ {draftStudent.sat > selectedStudent.sat ? '+' : ''}{draftStudent.sat - selectedStudent.sat}</span>}
                            {draftStudent?.sat ?? '—'}
                          </span>
                        </div>
                        <input
                          id="sat-slider"
                          type="range"
                          min={ADMISSION_DOMAINS.sat[0]}
                          max="100"
                          step="1"
                          value={draftStudent?.sat ?? ADMISSION_DOMAINS.sat[0]}
                          disabled={!draftStudent}
                          aria-valuetext={!draftStudent ? t.selectStudent : undefined}
                          onInput={(event) => updateDraft('sat', Number(event.currentTarget.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>

                    {isFeatureView ? <ExplorerBackgroundEditor key={selectedStudent?.id ?? 'unselected'} student={draftStudent}
                      original={selectedStudent} students={students} onChange={updateDraft} lang={lang} />
                      : <BackgroundEditor features={classroomView.features} student={draftStudent}
                        original={selectedStudent} onChange={updateDraft} t={t} lang={lang} />}


                  </div>
                )}
              </section>
              <section className="workspace-comparison simplified-panel rounded-2xl border border-slate-800 bg-slate-900/65">
                <div className="mb-1.5 flex items-start gap-2.5">
                  <div className="simplified-step flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">3</div>
                  <div>
                    <h2 className="text-base font-bold leading-tight text-white">{t.compareOutcomes}</h2>
                  </div>
                </div>

                {isFeatureView ? <ExplorerGroupOutcomes groups={explorerOutcomeGroups} lang={lang} /> : <div className="simplified-inset simplified-rate-table rounded-xl border border-slate-800 bg-slate-950/45 p-1">
                  <RateComparison
                    label={t.firstGenerationShort}
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
                </div>}

              </section>
          </aside>
        </main>


      </div>
    </div>
  );
};

export default SimplifiedApp;
