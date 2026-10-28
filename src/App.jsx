import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './index.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ReferenceLine, LabelList
} from 'recharts';
import {
  Sparkles, Palette, Info, ExternalLink, Telescope, RotateCcw, Trash2, HelpCircle, Activity, RefreshCw, Target,
  ChevronDown, ChevronUp, Square, CheckSquare, GripHorizontal, Sliders, Settings, Filter, Users, LayoutDashboard, Database, AlertCircle, CheckCircle2, XCircle, MoreVertical,
  Maximize2, Minimize2, ZoomIn, ZoomOut, Download, Share2, Save, FileText, Bookmark, BookOpen, GraduationCap, Github, Lightbulb,
  Layout, BarChart3, Fingerprint, User, ShieldAlert, School, Globe
} from 'lucide-react';

/**
 * AI/ML Ethics Lab - V2.5
 */

const DEFAULT_WEIGHTS = { gpa: 25, sat: 25, athlete: 20, firstGen: 10, gender: 10, resident: 10 };
const BASELINE_PROFILE = { gpa: 3.25, sat: 1400, isAthlete: false, isFirstGen: false, gender: 'Male', isResident: true };

const COLORS = {
  admit: '#10b981', reject: '#ef4444', accent: '#3b82f6', slate: '#475569',
  emerald: '#10b981', amber: '#f59e0b', rose: '#ef4444', indigo: '#6366f1',
  barDefault: '#6366f1'
};

const SCENARIOS = [
  { id: 'merit', weights: { gpa: 45, sat: 45, athlete: 5, firstGen: 0, gender: 0, resident: 5 }, threshold: 60, icon: 'Target' },
  { id: 'holistic', weights: { gpa: 25, sat: 25, athlete: 15, firstGen: 15, gender: 10, resident: 10 }, threshold: 45, icon: 'Users' },
  { id: 'diversity', weights: { gpa: 15, sat: 15, athlete: 10, firstGen: 30, gender: 20, resident: 10 }, threshold: 38, icon: 'Sparkles' },
  { id: 'athletic', weights: { gpa: 15, sat: 15, athlete: 60, firstGen: 5, gender: 0, resident: 5 }, threshold: 50, icon: 'Activity' }
];

const TRANSLATIONS = {
  en: {
    scenarios: "Demo Scenarios",
    scenarioMerit: "Academic Merit",
    scenarioHolistic: "Whole Person Review",
    scenarioDiversity: "Diversity/Equity",
    scenarioAthletic: "Sports Priority",
    title: "CounterLens",
    accuracy: "Model Accuracy",
    params: "Parameters",
    threshold: "Threshold",
    weights: "Weights (%)",
    gpa: "GPA", sat: "SAT", athlete: "ATHLETE", firstGen: "1ST-GEN", gender: "GENDER (FAVOR FEMALE)", resident: "RESIDENT",
    visualizer: "Counterfactual Visualizer",
    editor: "Counterfactual Editor",
    slices: "Dataset Slices",
    axesInfo: "X: GPA | Y: SAT",
    admit: "ADMIT", reject: "REJECT",
    original: "Original Profile", whatif: "CounterLens Editor",
    score: "Score", fate: "Result",
    metrics: "Fairness & Metrics", groupRate: "Admission Rate (%)",
    confusion: "Confusion Matrix", tp: "True Positive", fp: "False Positive", tn: "True Negative", fn: "False Negative",
    normalize: "Normalize", random: "Random", reset: "Zero", default: "Default",
    creditsTitle: "Project Team & Institution",
    leadTitle: "Principal Investigator",
    contributorTitle: "Researcher & Developer",
    projectLead: "Prof. Rebecca Williams",
    contributor: "Eric Yang, Ph.D. Student",
    datasetTribute: "Dataset Reference",
    datasetDesc: "Inspired by the UC Berkeley 1973 Admissions Dataset (Bickel et al., 1975). Used for exploring Simpson's Paradox and algorithmic bias.",
    department: "Dept. of Computer Science and Electrical Engineering (CSEE)",
    college: "College of Engineering and Information Technology",
    university: "University of Maryland, Baltimore County (UMBC)",
    visitLab: "Visit Lab Site", visitDept: "Department Website",
    aboutBtn: "Credits", decisionBoundary: "Decision Boundary",
    conditionalBoundary: "Boundary (Current Profile)",
    disparityMeter: "Disparity Meter",
    genderGap: "Gender Gap",
    yes: "YES", no: "NO", male: "MALE", female: "FEMALE", nonbinary: "NON-BINARY",
    fateDelta: "Fate Flip Detected",
    thresholdWiki: "https://en.wikipedia.org/wiki/Threshold",
    confusionWiki: "https://en.wikipedia.org/wiki/Confusion_matrix",
    thresholdExplainer: "HOW SCORING WORKS: Each student gets a score from 0 to 100. The score is calculated by adding up weighted contributions from each feature:\n\n\u2022 GPA is scaled from 2.5\u20134.0 to 0\u2013100, then multiplied by its weight. Example: If GPA = 3.5 and GPA weight = 25%, the GPA contribution = ((3.5\u22122.5)/1.5) \u00d7 25 \u2248 16.7 points.\n\u2022 SAT is scaled from 1200\u20131600 to 0\u2013100, then multiplied by its weight.\n\u2022 Boolean features (Athlete, 1st-Gen, Female, Resident) add their full weight if YES, or 0 if NO. Example: If Athlete weight = 20% and the student IS an athlete, it adds 20 points.\n\nThe THRESHOLD is the cutoff line: Score \u2265 Threshold \u2192 Admitted. Score < Threshold \u2192 Rejected. Raising the threshold makes admission harder.",
    confusionExplainer: "The confusion matrix compares what the model decided vs. what the 'hidden truth' says about each student:\n\n\u2022 TP (True Positive): Model says ADMIT, and the student truly has potential \u2192 Correct!\n\u2022 FP (False Positive): Model says ADMIT, but student lacks potential \u2192 Wrongly admitted.\n\u2022 FN (False Negative): Model says REJECT, but student has potential \u2192 Unfairly rejected! This is the most concerning case for fairness.\n\u2022 TN (True Negative): Model says REJECT, and student lacks potential \u2192 Correct.\n\nClick any cell to highlight those students in the scatter chart.",
    learnMore: "Wikipedia",
    axisSwap: "Swap Axes",
    margin: "Decision Margin (L2)",
    marginWiki: "https://en.wikipedia.org/wiki/Euclidean_distance",
    marginExplainer: "The Decision Margin (L2) represents the shortest distance from a student's profile to the admission boundary in a normalized feature space. A smaller margin indicates a 'fragile' decision where minor profile changes could flip the result.",
    weightsWiki: "https://en.wikipedia.org/wiki/Coefficient",
    weightsExplainer: "Weights control how much each feature matters in the final score. Think of it as grading a student on a 100-point scale:\n\n\u2022 If GPA weight = 25%, then GPA can contribute up to 25 points.\n\u2022 If Athlete weight = 20%, being an athlete adds a flat 20 points.\n\u2022 All weights should add up to 100% for scores to make intuitive sense (check the \u03a3 indicator).\n\nTry it: Set GPA to 100% and everything else to 0% \u2014 now only GPA determines admission!",
    inspectorWiki: "https://en.wikipedia.org/wiki/Feature_selection",
    inspectorExplainer: "The Inspector allows you to examine a specific data point's attributes and see how they contribute to the final decision. It provides granular detail for individual audit.",
    editorWiki: "https://en.wikipedia.org/wiki/Counterfactual_conditional",
    slicesExplainer: "This panel shows how each demographic group is distributed across the admission scoring scale (0-100).\n\nHOW TO READ:\n\u2022 Each row = one group (e.g., Athletes, Female, 1st-Gen). A student can belong to multiple groups.\n\u2022 The mini histogram shows how many students in that group fall at each score level.\n\u2022 Green bars = students above the threshold (Admitted). Red bars = below threshold (Rejected).\n\u2022 The red dotted line (\u25bc) marks the current threshold.\n\u2022 Click a row to filter the scatter chart to only show that group.\n\nThis helps you quickly spot fairness issues: if one group has mostly red bars while another has mostly green, the model may be biased.",
    marginExplainerNew: "Decision Margin measures how \u2018safe\u2019 a student's admission decision is.\n\nThink of it as: How far is this student from the pass/fail line?\n\u2022 Large margin = the decision is solid and won't easily change.\n\u2022 Small margin = the student is right on the edge. A tiny change in GPA or SAT could flip the result.\n\nThe number shown is the L2 (Euclidean) distance to the decision boundary. The arrow (\u2191/\u2193) shows whether your counterfactual edit moved the student further from or closer to the boundary.",
    visualizerWiki: "https://en.wikipedia.org/wiki/Scatter_plot",
    visualizerExplainer: "The Visualizer shows all 100 students mapped on a scatter chart.\n\n\u2022 Each dot = one student.\n\u2022 Green dots = Admitted. Red dots = Rejected.\n\u2022 X and Y axis show the student's GPA and SAT.\n\u2022 Blue dashed line = The current Decision Boundary (admission cutoff).\n\nTry dragging the sliders on the left to see how the boundary changes and how students cross the line from red to green (or vice versa)!",
    scenariosExplainer: "Demo Scenarios are preset rules (policies) for admission.\n\nInstead of adjusting sliders manually, just click one of these buttons to instantly apply a specific philosophy:\n\u2022 Academic Merit: Focuses heavily on high GPA and SAT scores.\n\u2022 Diversity/Equity: Gives more weight to 1st-Generation students and underrepresented groups.\n\u2022 Athletic Priority: Massively rewards athletes regardless of strict academics.\n\nWatch how the main scatter chart immediately shifts who gets in based on the chosen scenario!",
    tutorialBtn: "GUIDE",
    tutorialWelcomeTitle: "Welcome to CounterLens",
    tutorialWelcomeDesc: "A guided tour will walk you through every module step by step. Ready to explore?",
    tutorialStart: "Start Tour",
    tutorialSkip: "Skip",
    tutorialNext: "Next",
    tutorialPrev: "Back",
    tutorialDone: "Finish",
    tutorialStep: "Step",
    tutorialOf: "of",
    tutorialStepParams: "Parameters Panel",
    tutorialDescParams: "This is your control center. Adjust the admission threshold and feature weights here to see how policy changes reshape decisions in real time.",
    tutorialStepScenarios: "Demo Scenarios",
    tutorialDescScenarios: "One-click presets that load curated policy configurations — from pure academic merit to diversity-focused — so you can instantly explore different strategic philosophies.",
    tutorialStepThreshold: "Threshold Gateway",
    tutorialDescThreshold: "The threshold is the admission cutline. Slide it to raise or lower the bar. Watch the scatter chart update live as students cross the boundary.",
    tutorialStepViz: "Counterfactual Visualizer",
    tutorialDescViz: "Each dot is a student. Green = admitted, red = rejected. Click any dot to select it and see its profile. The blue dashed line marks the decision boundary.",
    tutorialStepEditor: "Counterfactual Editor",
    tutorialDescEditor: "After selecting a student, use this panel to ask 'what if?' — tweak GPA, SAT, or identity attributes to see if and how the admission result flips.",
    tutorialStepConfusion: "Confusion Matrix",
    tutorialDescConfusion: "Compares the model's decisions against hidden ground truth. Click any cell (TP, FP, FN, TN) to filter the scatter chart and spotlight those specific cases.",
    tutorialStepData: "Data Explorer",
    tutorialDescData: "Explore dataset distributions and statistics. Toggle between Dataset Slices to see demographic scoring distributions and Data Statistics to view global feature distributions.",
    editorExplainer: "The Editor enables you to manipulate features to see 'what if' the inputs were different. This helps in understanding the model's decision boundaries and sensitivity.",
    dataStats: "Data Statistics",
    numericFeatures: "Numeric Features",
    categoricalFeatures: "Categorical Features",
    statCount: "count", statMean: "mean", statStd: "std", statMin: "min", statMax: "max",
    statUnique: "unique", statTop: "top", statFreq: "freq",
    admitRate: "Admit Rate"
  },
  zh: {
    scenarios: "演示预设方案",
    scenarioMerit: "学术优先",
    scenarioHolistic: "综合评估",
    scenarioDiversity: "多样化/公平",
    scenarioAthletic: "体育专长",
    title: "CounterLens",
    accuracy: "模型准确度",
    params: "模型参数调节",
    threshold: "录取门槛",
    weights: "特征权重 (%)",
    gpa: "GPA", sat: "SAT", athlete: "运动员", firstGen: "一代生", gender: "性别权重 (偏向女性)", resident: "本州居民",
    visualizer: "反事实可视化 (Visualizer)",
    editor: "反事实编辑器 (Editor)",
    slices: "数据集切片 (Slices)",
    axesInfo: "横轴: GPA | 纵轴: SAT",
    admit: "录取", reject: "拒绝",
    original: "原始档案", whatif: "反事实编辑器",
    score: "得分", fate: "判定结果",
    metrics: "评估指标", groupRate: "群体录取率 (%)",
    confusion: "混淆矩阵", tp: "正确通过 (TP)", fp: "误判录取 (FP)", tn: "正确拒绝 (TN)", fn: "误判拒绝 (FN)",
    normalize: "归一化", random: "随机", reset: "清零", default: "恢复默认",
    creditsTitle: "项目团队与机构",
    leadTitle: "首席研究员 (PI)",
    contributorTitle: "研究员与开发员",
    projectLead: "Prof. Rebecca Williams",
    contributor: "Eric Yang (博士生)",
    datasetTribute: "数据集引用",
    datasetDesc: "受 1973 年加州大学伯克利分校录取数据集启发，用于探讨辛普森悖论与算法偏见。",
    department: "计算机科学与电气工程系 (CSEE)",
    college: "工程与信息技术学院",
    university: "马里兰大学巴尔的摩郡分校 (UMBC)",
    visitLab: "访问实验室主页", visitDept: "访问系部官网",
    aboutBtn: "关于项目", decisionBoundary: "录取分界线",
    conditionalBoundary: "当前档案判定基准线",
    disparityMeter: "公平性仪表盘",
    genderGap: "性别录取差距",
    yes: "是", no: "否", male: "男性", female: "女性", nonbinary: "非二元",
    fateDelta: "检测到命运反转",
    thresholdWiki: "https://zh.wikipedia.org/wiki/%E9%98%88%E5%80%BC",
    confusionWiki: "https://zh.wikipedia.org/wiki/%E6%B7%B7%E6%B7%86%E7%9F%A9%E9%98%B5",
    thresholdExplainer: "评分机制：系统会根据权重，为每位学生计算一个 0–100 的综合分数。\n\n• GPA：将 GPA（2.5~4.0）换算成百分制，再乘以权重。举例：GPA=3.5，权重=25%，贡献 = ((3.5-2.5)/1.5) × 25 ≈ 16.7 分。\n• SAT：同理，将 SAT（1200~1600）换算后乘以权重。\n• 布尔特征（运动员、一代生等）：是则加对应权重值，否则加 0。\n\n录取门槛就是分数线：分数 ≥ 门槛 → 录取，分数 < 门槛 → 拒绝。提高门槛 = 更严格的录取标准。",
    confusionExplainer: "混淆矩阵将模型的录取决定与'隐藏的真实潜力'进行对比：\n\n• TP（正确录取）：模型说录取，学生确实有潜力 → 正确！\n• FP（误判录取）：模型说录取，但学生没潜力 → 错误录取。\n• FN（误判拒绝）：模型说拒绝，但学生有潜力 → 不公平的拒绝！\n• TN（正确拒绝）：模型说拒绝，学生没潜力 → 正确。\n\n点击任意一格可以在散点图中高亮对应的学生。",
    learnMore: "维基百科",
    axisSwap: "轴向切换",
    margin: "决策余量 (L2 距离)",
    marginWiki: "https://zh.wikipedia.org/wiki/%E6%AC%A7%E5%87%A0%E9%87%8C%E5%BE%97%E8%B7%9D%E7%A6%BB",
    marginExplainer: "决策余量（L2 距离）代表了学生在标准化特征空间中距离录取边界线的最短距离。余量越小，说明该判定越'脆弱'，微小的档案改动（如 SAT 波动）就可能逆转录取结果。",
    weightsWiki: "https://zh.wikipedia.org/wiki/%E7%B3%BB%E6%95%B0",
    weightsExplainer: "权重控制每个特征在最终分数中占多大比重。可以这样理解——把满分 100 分分配给各项特征：\n\n• 如果 GPA 权重 = 25%，那么 GPA 最多能贡献 25 分。\n• 如果运动员权重 = 20%，是运动员就直接加 20 分。\n• 所有权重加起来应该等于 100%（看 Σ 指示器）。\n\n试试看：把 GPA 设为 100%，其他全部设为 0% — 现在只有 GPA 决定录取！",
    inspectorWiki: "https://zh.wikipedia.org/wiki/%E7%89%B9%E5%BE%81%E9%80%89%E6%8B%A9",
    inspectorExplainer: "特征审查面板允许你深入检查特定数据点的各项属性，并观察它们如何共同决定最终的录取逻辑。这是对个体判定的精确审计。",
    editorWiki: "https://zh.wikipedia.org/wiki/%E5%8F%8D%E4%BA%8B%E5%AE%9E%E6%9D%A1%E4%BB%B6",
    slicesExplainer: "这个面板展示了每个人口统计分组在录取评分轴（0-100）上的分布情况。\n\n怎么看：\n• 每行 = 一个分组（如运动员、女性、一代生）。一个学生可以同时属于多个分组。\n• 迷你柱状图展示该组学生在各分数段的人数。\n• 绿色 = 超过门槛（录取），红色 = 低于门槛（拒绝）。\n• 红色虚线（▼）标记当前门槛位置。\n• 点击某行可以在散点图中筛选只显示该组。\n\n它能帮你快速发现公平性问题：如果某组大部分是红色，而另一组大部分是绿色，说明模型可能存在偏见。",
    marginExplainerNew: "决策余量衡量的是一个学生的录取决定有多「稳固」。\n\n可以这样理解：这个学生离及格线有多远？\n• 余量大 = 决定很稳固，不容易被改变。\n• 余量小 = 学生处于边缘位置，GPA 或 SAT 的微小变化就可能翻转结果。\n\n显示的数字是 L2（欧氏）距离。箭头（↑/↓）表示你的反事实修改是让学生离边界更远还是更近。",
    visualizerWiki: "https://zh.wikipedia.org/wiki/%E6%95%A3%E7%82%B9%E5%9B%BE",
    visualizerExplainer: "可视化面板将所有 100 名学生显示在散点图上。\n\n• 每个点 = 一名学生。\n• 绿色点 = 已录取。红色点 = 被拒绝。\n• X轴和Y轴代表学生的 GPA 和 SAT 成绩。\n• 蓝色虚线 = 当前的录取分界线（Decision Boundary）。\n\n试着拖动左侧的滑块，看看分界线如何移动，以及学生们是如何跨越边界从红变绿（或从绿变红）的！",
    scenariosExplainer: "演示预设方案是预先设定好的录取规则（政策）。\n\n不需要手动调节滑块，只需点击这些按钮之一，就能立即应用特定的录取理念：\n• 学术优先：高度看重 GPA 和 SAT 成绩。\n• 多样性/公平：给予一代大学生和弱势群体更大的权重。\n• 体育优先：大幅宽容学术成绩，重奖运动员。\n\n观察选择不同方案后，主散点图上的录取人群会发生怎样的巨变！",
    editorExplainer: "反事实编辑器让你做「如果……会怎样」的假设实验。选中一个学生后，你可以修改 TA 的 GPA、SAT 或身份属性，观察录取结果是否反转。\n\n举例：一个被拒绝的学生，如果把性别改为女性（且女性有权重加分），TA 会被录取吗？这就是「反事实分析」——帮你发现模型对不同特征的敏感度。",
    tutorialBtn: "引导",
    tutorialWelcomeTitle: "欢迎使用 CounterLens",
    tutorialWelcomeDesc: "引导教程将一步步带你了解每个模块的功能。准备好开始探索了吗？",
    tutorialStart: "开始引导",
    tutorialSkip: "跳过",
    tutorialNext: "下一步",
    tutorialPrev: "上一步",
    tutorialDone: "完成",
    tutorialStep: "第",
    tutorialOf: "步，共",
    tutorialStepParams: "参数控制面板",
    tutorialDescParams: "这是你的控制中心。在这里可以调节录取门槛和各项特征权重，实时观察政策变化如何影响判定结果。",
    tutorialStepScenarios: "演示预设方案",
    tutorialDescScenarios: "一键加载预设的策略配置 — 从纯学术优先到多样化与公平 — 让你立刻体验不同的政策理念。",
    tutorialStepThreshold: "录取门槛",
    tutorialDescThreshold: "门槛就是录取分数线。拖动滑动条来调高或降低标准，同时观察散点图中学生是否跨越分界线。",
    tutorialStepViz: "反事实可视化",
    tutorialDescViz: "每个点代表一名学生。绿色 = 录取，红色 = 拒绝。点击任一样本点可选中它并查看档案。蓝色虚线标记录取分界线。",
    tutorialStepEditor: "反事实编辑器",
    tutorialDescEditor: "选中一名学生后，用这个面板来做'如果…会怎样？'的实验 — 调整 GPA、SAT 或身份属性，看录取结果是否反转。",
    tutorialStepConfusion: "混淆矩阵",
    tutorialDescConfusion: "将模型判定与隐藏的真实潜质对比。点击任一单元格（TP、FP、FN、TN）可在散点图中筛选出对应的样本。",
    tutorialStepData: "数据探索面板",
    tutorialDescData: "探索数据集的各项统计特征。你可以切换'数据集切片'来观察各群体的分数分布，或切换'数据统计'来查看全局的特征分布情况。",
    dataStats: "数据统计",
    numericFeatures: "数值特征",
    categoricalFeatures: "分类特征",
    statCount: "总数", statMean: "均值", statStd: "标准差", statMin: "最小", statMax: "最大",
    statUnique: "类别数", statTop: "众数", statFreq: "频率",
    admitRate: "录取率"
  },
  es: {
    scenarios: "Escenarios de Demostración",
    scenarioMerit: "Mérito Académico",
    scenarioHolistic: "Revisión Integral",
    scenarioDiversity: "Diversidad/Equidad",
    scenarioAthletic: "Prioridad Deportiva",
    title: "CounterLens",
    accuracy: "Precisión",
    params: "Parámetros",
    threshold: "Umbral",
    weights: "Pesos (%)",
    gpa: "GPA", sat: "SAT", athlete: "ATLETA", firstGen: "1RA-GEN", gender: "GÉNERO (FAVOR FEM)", resident: "RESIDENTE",
    visualizer: "CounterLens Visualizer",
    editor: "CounterLens Editor",
    slices: "Dataset Slices",
    axesInfo: "X: GPA | Y: SAT",
    admit: "ADMITIR", reject: "RECHAZAR",
    original: "Original", whatif: "CounterLens Editor",
    score: "Puntaje", fate: "Resultado",
    metrics: "Métricas", groupRate: "Tasa por Grupo (%)",
    confusion: "Matriz", tp: "Real Pos", fp: "Falso Pos", tn: "Real Neg", fn: "Falso Neg",
    normalize: "Normalizar", random: "Azar", reset: "Cero", default: "Defecto",
    creditsTitle: "Equipo e Institución",
    leadTitle: "Investigador Principal",
    contributorTitle: "Investigador y Desarrollador",
    projectLead: "Prof. Rebecca Williams",
    contributor: "Eric Yang, Estudiante de Doctorado",
    datasetTribute: "Referencia de Datos",
    datasetDesc: "Inspirado en el conjunto de datos de admisiones de UC Berkeley 1973.",
    department: "Depto. de Ciencias (CSEE)",
    college: "Facultad de Ingeniería",
    university: "UMBC",
    visitLab: "Visitar Lab", visitDept: "Visitar Depto.",
    aboutBtn: "Créditos", decisionBoundary: "Límite",
    conditionalBoundary: "Límite (Perfil Actual)",
    disparityMeter: "Medidor de Disparidad",
    genderGap: "Brecha de Género",
    yes: "SÍ", no: "NO", male: "MASC", female: "FEM", nonbinary: "NO-BIN",
    fateDelta: "Giro de Destino",
    thresholdWiki: "https://es.wikipedia.org/wiki/Umbral",
    confusionWiki: "https://es.wikipedia.org/wiki/Matriz_de_confusi%C3%B3n",
    thresholdExplainer: "CÓMO FUNCIONA: Cada estudiante recibe un puntaje de 0 a 100 sumando contribuciones ponderadas:\n\n• GPA se escala de 2.5–4.0 a 0–100, multiplicado por su peso.\n• SAT se escala de 1200–1600 a 0–100, multiplicado por su peso.\n• Características booleanas (Atleta, 1ra-Gen, etc.) suman su peso si SÍ, o 0 si NO.\n\nEl UMBRAL es la línea de corte: Puntaje ≥ Umbral → Admitido. Menor → Rechazado.",
    confusionExplainer: "La matriz compara las decisiones del modelo con la verdad oculta:\n\n• TP: Admitido correctamente.\n• FP: Admitido por error.\n• FN: Rechazado injustamente — el caso más preocupante para la equidad.\n• TN: Rechazado correctamente.\n\nHaz clic en cualquier celda para resaltar esos estudiantes.",
    learnMore: "Wikipedia",
    axisSwap: "Cambiar Ejes",
    visualizerWiki: "https://es.wikipedia.org/wiki/Diagrama_de_dispersi%C3%B3n",
    visualizerExplainer: "El Visualizador muestra a los 100 estudiantes en un gráfico de dispersión.\n\n• Cado punto = un estudiante.\n• Verde = Admitido. Rojo = Rechazado.\n• La línea azul punteada marca el límite de admisión.\n\n¡Mueva los controles para ver cómo cambian los resultados!",
    scenariosExplainer: "Los Escenarios son reglas preestablecidas.\n\nAplicar un escenario cambia instantáneamente la filosofía de admisión (ej. mérito académico vs diversidad). ¡Observe cómo cambia el gráfico!",
    tutorialBtn: "GUÍA",
    tutorialWelcomeTitle: "Bienvenido a CounterLens",
    tutorialWelcomeDesc: "Una visita guiada le mostrará cada módulo paso a paso. ¿Listo para explorar?",
    tutorialStart: "Iniciar",
    tutorialSkip: "Saltar",
    tutorialNext: "Siguiente",
    tutorialPrev: "Anterior",
    tutorialDone: "Finalizar",
    tutorialStep: "Paso",
    tutorialOf: "de",
    tutorialStepParams: "Panel de Parámetros",
    tutorialDescParams: "Este es tu centro de control. Ajusta el umbral de admisión y los pesos de las características.",
    tutorialStepScenarios: "Escenarios Demo",
    tutorialDescScenarios: "Presets que cargan configuraciones de políticas curadas para explorar filosofías estratégicas.",
    tutorialStepThreshold: "Umbral de Decisión",
    tutorialDescThreshold: "El umbral es la línea de corte. Desliza para subir o bajar el estándar.",
    tutorialStepViz: "Visualizador",
    tutorialDescViz: "Cada punto es un estudiante. Verde = admitido, rojo = rechazado. Haz clic para seleccionar.",
    tutorialStepEditor: "Editor Contrafactual",
    tutorialDescEditor: "Después de seleccionar un estudiante, modifica atributos para ver si cambia el resultado.",
    tutorialStepConfusion: "Matriz de Confusión",
    tutorialDescConfusion: "Compara las decisiones del modelo con la verdad real. Haz clic en celdas para filtrar.",
    tutorialStepData: "Explorador de Datos",
    tutorialDescData: "Explore distribuciones y estadísticas. Alterne entre Dataset Slices para ver distribuciones demográficas y Data Statistics para distribuciones globales.",
    dataStats: "Estadísticas",
    numericFeatures: "Características Numéricas",
    categoricalFeatures: "Características Categóricas",
    statCount: "total", statMean: "media", statStd: "desv", statMin: "mín", statMax: "máx",
    statUnique: "únicos", statTop: "moda", statFreq: "frec",
    admitRate: "Tasa Adm."
  }
};


const generateData = () => {
  const data = [];
  for (let i = 0; i < 100; i++) {
    const gpa = parseFloat((Math.random() * 1.5 + 2.5).toFixed(2));
    const sat = Math.floor(Math.random() * 400 + 1200);
    const isAthlete = Math.random() > 0.88;
    const isFirstGen = Math.random() > 0.75;
    const isResident = Math.random() > 0.4;
    // Allow natural data imbalance for educational exploration
    const gender = Math.random() > 0.45 ? 'Female' : 'Male';
    const latentPotential = (gpa * 18) + (sat / 1600 * 20) + (Math.random() * 15);
    const actualLabel = latentPotential > 72;
    data.push({ id: i, gpa, sat, isAthlete, isFirstGen, isResident, gender, label: actualLabel, x: gpa, y: sat });
  }
  return data;
};

const INITIAL_POOL = generateData();

const App = () => {
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const [showCredits, setShowCredits] = useState(false);
  const [explainer, setExplainer] = useState(null);

  const [data] = useState(INITIAL_POOL);
  const [threshold, setThreshold] = useState(40);
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [selectedId, setSelectedId] = useState(null);
  const [cfProfile, setCfProfile] = useState(null);
  const [swapAxes, setSwapAxes] = useState(false);
  const [filterMode, setFilterMode] = useState(null); // { type: 'confusion'|'slice', value: string }
  const [isMining, setIsMining] = useState(false);
  const [statsTab, setStatsTab] = useState('slices'); // 'slices' | 'stats'

  // Tutorial system
  const [tutorialStep, setTutorialStep] = useState(-1); // -1 = off, 0 = welcome, 1..N = steps
  const [tutorialRect, setTutorialRect] = useState(null);
  const refParams = useRef(null);
  const refScenarios = useRef(null);
  const refThreshold = useRef(null);
  const refViz = useRef(null);
  const refEditor = useRef(null);
  const refConfusion = useRef(null);
  const refData = useRef(null);

  const TUTORIAL_STEPS = useMemo(() => [
    { ref: refParams,    title: t.tutorialStepParams,    desc: t.tutorialDescParams,    arrow: 'right', offsetX: 16, offsetY: 0 },
    { ref: refScenarios,  title: t.tutorialStepScenarios,  desc: t.tutorialDescScenarios,  arrow: 'right', offsetX: 16, offsetY: 0 },
    { ref: refThreshold,  title: t.tutorialStepThreshold,  desc: t.tutorialDescThreshold,  arrow: 'right', offsetX: 16, offsetY: 0 },
    { ref: refViz,        title: t.tutorialStepViz,        desc: t.tutorialDescViz,        arrow: 'bottom', offsetX: 0, offsetY: 16 },
    { ref: refEditor,     title: t.tutorialStepEditor,     desc: t.tutorialDescEditor,     arrow: 'left', offsetX: -16, offsetY: 0 },
    { ref: refConfusion,  title: t.tutorialStepConfusion,  desc: t.tutorialDescConfusion,  arrow: 'left', offsetX: -16, offsetY: 0 },
    { ref: refData,       title: t.tutorialStepData,       desc: t.tutorialDescData,       arrow: 'top',  offsetX: 0, offsetY: -16 },
  ], [t]);

  // Measure target element position for spotlight
  useEffect(() => {
    if (tutorialStep < 1 || tutorialStep > TUTORIAL_STEPS.length) {
      setTutorialRect(null);
      return;
    }
    const step = TUTORIAL_STEPS[tutorialStep - 1];
    const el = step.ref.current;
    if (!el) { setTutorialRect(null); return; }
    const pad = 8;
    const r = el.getBoundingClientRect();
    setTutorialRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [tutorialStep, TUTORIAL_STEPS]);

  const tutorialTooltipStyle = useMemo(() => {
    if (!tutorialRect || tutorialStep < 1 || tutorialStep > TUTORIAL_STEPS.length) return {};
    const step = TUTORIAL_STEPS[tutorialStep - 1];
    const style = {};
    if (step.arrow === 'right') {
      style.left = tutorialRect.left + tutorialRect.width + step.offsetX;
      style.top = tutorialRect.top + 12;
    } else if (step.arrow === 'left') {
      style.right = window.innerWidth - tutorialRect.left + Math.abs(step.offsetX);
      style.top = tutorialRect.top + 12;
    } else if (step.arrow === 'bottom') {
      style.left = tutorialRect.left + 12;
      style.top = tutorialRect.top + tutorialRect.height + step.offsetY;
    } else if (step.arrow === 'top') {
      style.left = tutorialRect.left + 12;
      style.bottom = window.innerHeight - tutorialRect.top + Math.abs(step.offsetY);
    }
    return style;
  }, [tutorialRect, tutorialStep, TUTORIAL_STEPS]);

  const arrowClass = useMemo(() => {
    if (tutorialStep < 1 || tutorialStep > TUTORIAL_STEPS.length) return '';
    const dir = TUTORIAL_STEPS[tutorialStep - 1].arrow;
    // Arrow on tooltip points TOWARD the target, so opposite side
    if (dir === 'right') return 'arrow-left';
    if (dir === 'left') return 'arrow-right';
    if (dir === 'bottom') return 'arrow-top';
    if (dir === 'top') return 'arrow-bottom';
    return '';
  }, [tutorialStep, TUTORIAL_STEPS]);
  const [theme, setTheme] = useState('eclipse'); // 'nebula' | 'eclipse' | 'daylight'
  const isNebula = theme === 'nebula';
  const isEclipse = theme === 'eclipse';
  const isDaylight = theme === 'daylight';
  const isDark = !isDaylight;
  const cycleTheme = () => setTheme(t => t === 'eclipse' ? 'daylight' : 'eclipse');

  const originalStudent = useMemo(() => data.find(s => s.id === selectedId) || null, [data, selectedId]);

  useEffect(() => { if (originalStudent) setCfProfile({ ...originalStudent }); }, [originalStudent]);

  const formatVal = (val, type) => {
    if (type === 'gender') return t[val.toLowerCase()] || val;
    if (type === 'boolean') return val ? t.yes : t.no;
    return val;
  };

  const calcScore = (p, w) => {
    if (!p) return 0;
    // Normalize GPA (2.5-4.0) and SAT (1200-1600) to 0-100 range for proper weighting
    const normalizedGpa = (p.gpa - 2.5) / 1.5 * 100;
    const normalizedSat = (p.sat - 1200) / 400 * 100;

    const sGpa = (normalizedGpa * w.gpa) / 100;
    const sSat = (normalizedSat * w.sat) / 100;
    const sAth = p.isAthlete ? w.athlete : 0;
    const sFst = p.isFirstGen ? w.firstGen : 0;
    const sGen = p.gender === 'Female' ? w.gender : 0;
    const sRes = p.isResident ? w.resident : 0;
    return Math.min(100, Math.max(0, sGpa + sSat + sAth + sFst + sGen + sRes));
  };

  const isAdmitted = (p) => calcScore(p, weights) >= threshold;

  const boundaryVal = useMemo(() => {
    // If no student selected, use baseline to show a global boundary
    const p = cfProfile || BASELINE_PROFILE;
    if (!swapAxes) {
      if (weights.sat === 0) return null;
      const normalizedGpa = (p.gpa - 2.5) / 1.5 * 100;
      const otherScores = (normalizedGpa * weights.gpa) / 100 + (p.isAthlete ? weights.athlete : 0) + (p.isFirstGen ? weights.firstGen : 0) + (p.gender === 'Female' ? weights.gender : 0) + (p.isResident ? weights.resident : 0);
      const neededSatNorm = (threshold - otherScores) / weights.sat * 100;
      const val = (neededSatNorm / 100 * 400) + 1200;
      // Allow it to be slightly out of chart area but not into extreme negatives
      return val >= 600 && val <= 2000 ? val : null;
    } else {
      if (weights.gpa === 0) return null;
      const normalizedSat = (p.sat - 1200) / 400 * 100;
      const otherScores = (normalizedSat * weights.sat) / 100 + (p.isAthlete ? weights.athlete : 0) + (p.isFirstGen ? weights.firstGen : 0) + (p.gender === 'Female' ? weights.gender : 0) + (p.isResident ? weights.resident : 0);
      const neededGpaNorm = (threshold - otherScores) / weights.gpa * 100;
      const val = (neededGpaNorm / 100 * 1.5) + 2.5;
      return val >= 1.0 && val <= 5.0 ? val : null;
    }
  }, [cfProfile, threshold, weights, swapAxes]);

  const stats = useMemo(() => {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    const groups = { athlete: { c: 0, a: 0 }, firstGen: { c: 0, a: 0 }, female: { c: 0, a: 0 }, male: { c: 0, a: 0 }, resident: { c: 0, a: 0 } };
    data.forEach(s => {
      const pred = isAdmitted(s);
      if (pred && s.label) tp++; else if (pred && !s.label) fp++; else if (!pred && !s.label) tn++; else if (!pred && s.label) fn++;
      if (s.isAthlete) { groups.athlete.c++; if (pred) groups.athlete.a++; }
      if (s.isFirstGen) { groups.firstGen.c++; if (pred) groups.firstGen.a++; }
      if (s.gender === 'Female') { groups.female.c++; if (pred) groups.female.a++; }
      if (s.gender === 'Male') { groups.male.c++; if (pred) groups.male.a++; }
      if (s.isResident) { groups.resident.c++; if (pred) groups.resident.a++; }
    });
    const total = data.length || 1;
    const femaleRate = Math.round(groups.female.a / groups.female.c * 100) || 0;
    const maleRate = Math.round(groups.male.a / groups.male.c * 100) || 0;
    const genderGap = Math.abs(femaleRate - maleRate);

    const allRates = [
      Math.round(groups.athlete.a / groups.athlete.c * 100) || 0,
      Math.round(groups.firstGen.a / groups.firstGen.c * 100) || 0,
      femaleRate,
      maleRate,
      Math.round(groups.resident.a / groups.resident.c * 100) || 0
    ];
    const maxGap = Math.max(...allRates) - Math.min(...allRates);

    return {
      tp, fp, tn, fn,
      accuracy: (((tp + tn) / total) * 100).toFixed(1),
      tpRate: Math.round((tp / total) * 100),
      fpRate: Math.round((fp / total) * 100),
      fnRate: Math.round((fn / total) * 100),
      tnRate: Math.round((tn / total) * 100),
      genderGap,
      maxGap,
      groupStats: [
        { name: t.athlete, rate: Math.round(groups.athlete.a / groups.athlete.c * 100) || 0, count: groups.athlete.c, admitted: groups.athlete.a },
        { name: t.firstGen, rate: Math.round(groups.firstGen.a / groups.firstGen.c * 100) || 0, count: groups.firstGen.c, admitted: groups.firstGen.a },
        { name: t.female, rate: femaleRate, count: groups.female.c, admitted: groups.female.a },
        { name: t.male, rate: maleRate, count: groups.male.c, admitted: groups.male.a },
        { name: t.resident, rate: Math.round(groups.resident.a / groups.resident.c * 100) || 0, count: groups.resident.c, admitted: groups.resident.a }
      ]
    };
  }, [data, weights, threshold, t, lang]);

  // Feature statistics for WIT-style Data Statistics panel
  const featureStats = useMemo(() => {
    const gpas = data.map(d => d.gpa);
    const sats = data.map(d => d.sat);
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };

    // Build histogram bins WITH admit/reject coloring
    const buildHist = (arr, entries, binCount, minV, maxV) => {
      const step = (maxV - minV) / binCount;
      const bins = Array.from({ length: binCount }, () => ({ admit: 0, reject: 0 }));
      entries.forEach((d, idx) => {
        const v = arr[idx];
        const i = Math.min(binCount - 1, Math.floor((v - minV) / step));
        if (isAdmitted(d)) bins[i].admit++; else bins[i].reject++;
      });
      const maxBin = Math.max(...bins.map(b => b.admit + b.reject), 1);
      return bins.map((b, i) => ({ x: (minV + step * i).toFixed(2), admit: b.admit, reject: b.reject, total: b.admit + b.reject, pct: (b.admit + b.reject) / maxBin }));
    };

    const genderCounts = { Male: { total: 0, admit: 0 }, Female: { total: 0, admit: 0 } };
    let athTotal = 0, athAdmit = 0, fgTotal = 0, fgAdmit = 0, resTotal = 0, resAdmit = 0;
    let nAthTotal = 0, nAthAdmit = 0, nFgTotal = 0, nFgAdmit = 0, nResTotal = 0, nResAdmit = 0;
    data.forEach(d => {
      const adm = isAdmitted(d);
      genderCounts[d.gender].total++; if (adm) genderCounts[d.gender].admit++;
      if (d.isAthlete) { athTotal++; if (adm) athAdmit++; } else { nAthTotal++; if (adm) nAthAdmit++; }
      if (d.isFirstGen) { fgTotal++; if (adm) fgAdmit++; } else { nFgTotal++; if (adm) nFgAdmit++; }
      if (d.isResident) { resTotal++; if (adm) resAdmit++; } else { nResTotal++; if (adm) nResAdmit++; }
    });

    return {
      numeric: [
        { key: 'gpa', label: 'GPA', count: data.length, mean: mean(gpas).toFixed(2), std: std(gpas).toFixed(2), min: Math.min(...gpas).toFixed(2), max: Math.max(...gpas).toFixed(2), hist: buildHist(gpas, data, 10, 2.5, 4.0) },
        { key: 'sat', label: 'SAT', count: data.length, mean: mean(sats).toFixed(0), std: std(sats).toFixed(0), min: Math.min(...sats), max: Math.max(...sats), hist: buildHist(sats, data, 10, 1200, 1600) },
      ],
      categorical: [
        { key: 'gender', label: t.gender?.replace(/\s*\(.*\)/, '') || 'Gender', count: data.length, unique: 2, bars: [
          { label: t.male, count: genderCounts.Male.total, admit: genderCounts.Male.admit, rate: genderCounts.Male.total ? Math.round(genderCounts.Male.admit / genderCounts.Male.total * 100) : 0 },
          { label: t.female, count: genderCounts.Female.total, admit: genderCounts.Female.admit, rate: genderCounts.Female.total ? Math.round(genderCounts.Female.admit / genderCounts.Female.total * 100) : 0 },
        ]},
        { key: 'athlete', label: t.athlete, count: data.length, unique: 2, bars: [
          { label: t.yes, count: athTotal, admit: athAdmit, rate: athTotal ? Math.round(athAdmit / athTotal * 100) : 0 },
          { label: t.no, count: nAthTotal, admit: nAthAdmit, rate: nAthTotal ? Math.round(nAthAdmit / nAthTotal * 100) : 0 },
        ]},
        { key: 'firstGen', label: t.firstGen, count: data.length, unique: 2, bars: [
          { label: t.yes, count: fgTotal, admit: fgAdmit, rate: fgTotal ? Math.round(fgAdmit / fgTotal * 100) : 0 },
          { label: t.no, count: nFgTotal, admit: nFgAdmit, rate: nFgTotal ? Math.round(nFgAdmit / nFgTotal * 100) : 0 },
        ]},
        { key: 'resident', label: t.resident, count: data.length, unique: 2, bars: [
          { label: t.yes, count: resTotal, admit: resAdmit, rate: resTotal ? Math.round(resAdmit / resTotal * 100) : 0 },
          { label: t.no, count: nResTotal, admit: nResAdmit, rate: nResTotal ? Math.round(nResAdmit / nResTotal * 100) : 0 },
        ]},
      ]
    };
  }, [data, weights, threshold, t]);

  // Per-group score distribution histograms for scented widgets
  const sliceDistributions = useMemo(() => {
    const BINS = 10;
    const filters = {
      [t.athlete]: s => s.isAthlete,
      [t.firstGen]: s => s.isFirstGen,
      [t.female]: s => s.gender === 'Female',
      [t.male]: s => s.gender === 'Male',
      [t.resident]: s => s.isResident,
    };
    const result = {};
    Object.entries(filters).forEach(([name, fn]) => {
      const members = data.filter(fn);
      const bins = Array.from({ length: BINS }, () => ({ admit: 0, reject: 0 }));
      members.forEach(s => {
        const score = calcScore(s, weights);
        const i = Math.min(BINS - 1, Math.floor((score / 100) * BINS));
        if (score >= threshold) bins[i].admit++;
        else bins[i].reject++;
      });
      const maxBin = Math.max(...bins.map(b => b.admit + b.reject), 1);
      result[name] = bins.map(b => ({ ...b, total: b.admit + b.reject, pct: (b.admit + b.reject) / maxBin }));
    });
    return result;
  }, [data, weights, threshold, t]);

  const trajectoryData = useMemo(() => {
    if (!originalStudent || !cfProfile) return [];
    // Ensure we provide keys matching the chart's dataKey logic
    return [
      { id: 'orig', gpa: originalStudent.gpa, sat: originalStudent.sat, isOrig: true },
      { id: 'cf', gpa: cfProfile.gpa, sat: cfProfile.sat, isOrig: false }
    ];
  }, [originalStudent, cfProfile]);

  const isCrossed = useMemo(() => {
    return isAdmitted(originalStudent) !== isAdmitted(cfProfile);
  }, [originalStudent, cfProfile, weights, threshold]);

  const checkMatch = useCallback((entry) => {
    if (!filterMode) return true;
    const pred = isAdmitted(entry);
    if (filterMode.type === 'confusion') {
      const status = (pred && entry.label) ? 'TP' : (pred && !entry.label) ? 'FP' : (!pred && entry.label) ? 'FN' : 'TN';
      return status === filterMode.value;
    } else if (filterMode.type === 'slice') {
      if (filterMode.value === t.athlete) return entry.isAthlete;
      if (filterMode.value === t.firstGen) return entry.isFirstGen;
      if (filterMode.value === t.resident) return entry.isResident;
      if (filterMode.value === (lang === 'zh' ? '女性' : (lang === 'es' ? 'FEM' : 'Female'))) return entry.gender === 'Female';
      if (filterMode.value === (lang === 'zh' ? '男性' : (lang === 'es' ? 'MASC' : 'Male'))) return entry.gender === 'Male';
    }
    return true;
  }, [filterMode, weights, threshold, t, lang]);

  const getMargin = useCallback((p) => {
    if (!p) return null;
    const s = calcScore(p, weights);
    const diff = s - threshold;
    const g1 = weights.gpa / 100;
    const g2 = weights.sat / 100;
    const denomNorm = g1 * g1 + g2 * g2;
    if (denomNorm === 0) return { margin: "0.00", projection: { gpa: p.gpa, sat: p.sat } };
    const dist = Math.abs(diff) / Math.sqrt(denomNorm);
    const A = weights.gpa / 1.5;
    const B = weights.sat / 400;
    const dRaw = A * A + B * B;
    const xp = p.gpa - (A * diff) / dRaw;
    const yp = p.sat - (B * diff) / dRaw;
    return { margin: dist.toFixed(2), rawMargin: dist, projection: { gpa: xp, sat: yp } };
  }, [weights, threshold]);

  const marginStats = useMemo(() => getMargin(originalStudent), [originalStudent, getMargin]);
  const cfMarginStats = useMemo(() => getMargin(cfProfile), [cfProfile, getMargin]);

  const hardSamples = useMemo(() => {
    if (!isMining) return [];
    return data
      .map(s => ({ ...s, dist: Math.abs(calcScore(s, weights) - threshold) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);
  }, [data, weights, threshold, isMining]);

  const handleCfChange = (f, v) => setCfProfile(p => ({ ...p, [f]: v }));


  const handleWeights = (action) => {
    let newWeights = { ...weights };
    const keys = Object.keys(weights);
    if (action === 'normalize' || action === 'random') {
      const vals = action === 'normalize' ? Object.values(weights) : keys.map(() => Math.random());
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum === 0) return;
      let runningSum = 0;
      keys.forEach((k, i) => {
        if (i === keys.length - 1) newWeights[k] = 100 - runningSum;
        else { newWeights[k] = Math.round((vals[i] / sum) * 100); runningSum += newWeights[k]; }
      });
    } else if (action === 'reset') {
      keys.forEach(k => newWeights[k] = 0);
    } else if (action === 'default') {
      newWeights = { ...DEFAULT_WEIGHTS };
    }
    setWeights(newWeights);
  };

  const applyScenario = (s) => {
    setWeights({ ...s.weights });
    setThreshold(s.threshold);
    setIsMining(false);
  };

  return (
    <div className={`h-screen ${isNebula ? 'glass-active' : isEclipse ? 'bg-[#080b11]' : 'theme-daylight'} ${isDark ? 'text-slate-200' : 'text-slate-700'} font-sans p-3 overflow-hidden flex flex-col relative selection:bg-blue-500/30 transition-colors duration-700`}>
      {isNebula && (
        <div className="mesh-bg">
          <div className="mesh-circle w-[600px] h-[600px] bg-blue-600/10 -top-[20%] -left-[10%]"></div>
          <div className="mesh-circle w-[500px] h-[500px] bg-purple-600/10 top-[40%] -right-[5%]"></div>
          <div className="mesh-circle w-[400px] h-[400px] bg-pink-600/10 -bottom-[10%] left-[20%]"></div>
        </div>
      )}

      {/* Overlay Modals */}
      {(showCredits || explainer) && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center p-6 ${isDaylight ? 'bg-slate-900/30' : 'bg-black/80'} backdrop-blur-md animate-in fade-in duration-300`}>
          <div className={`${isDaylight ? 'bg-white border-slate-200' : 'bg-[#0f131a] border-slate-700/80'} border w-full max-w-xl rounded-3xl pt-6 px-8 pb-8 shadow-2xl relative ${isNebula ? 'glass-card' : ''}`}>

            {showCredits && (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20"><GraduationCap className="w-10 h-10 text-white" /></div>
                <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-tight`}>{t.creditsTitle}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                  <div className={`p-4 ${isDaylight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700/50'} rounded-2xl border flex items-center gap-3`}>
                    <User className="w-5 h-5 text-blue-400" />
                    <div className="text-left">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">{t.leadTitle}</p>
                      <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.projectLead}</p>
                    </div>
                  </div>
                  <div className={`p-4 ${isDaylight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700/50'} rounded-2xl border flex items-center gap-3`}>
                    <ShieldAlert className="w-5 h-5 text-purple-400" />
                    <div className="text-left">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">{t.contributorTitle}</p>
                      <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.contributor}</p>
                    </div>
                  </div>
                </div>
                <div className={`w-full p-5 ${isDaylight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/50 border-slate-800'} rounded-2xl border space-y-4 text-left`}>
                  <div className="flex items-center gap-3">
                    <School className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-400 font-bold uppercase leading-tight mb-1">{t.department}</p>
                      <p className="text-[11px] text-slate-400 font-bold uppercase leading-tight mb-1">{t.college}</p>
                      <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} truncate`}>{t.university}</p>
                    </div>
                  </div>
                  <div className={`border-t ${isDaylight ? 'border-slate-200' : 'border-slate-800'} pt-3`}>
                    <div className="flex items-center gap-2 mb-1"><Database className="w-3.5 h-3.5 text-blue-400" /><p className="text-xs text-slate-400 font-black uppercase tracking-widest">{t.datasetTribute}</p></div>
                    <p className="text-[13px] text-slate-500 leading-snug">{t.datasetDesc}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <a href="https://sites.google.com/umbc.edu/prof-rebecca-williams/" target="_blank" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[13px] font-bold transition-all"><ExternalLink className="w-3 h-3" /> {t.visitLab}</a>
                    <a href="https://www.csee.umbc.edu/" target="_blank" className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 ${isDaylight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-700 hover:bg-slate-600 text-white'} rounded-xl text-[13px] font-bold transition-all`}><Globe className="w-3 h-3" /> {t.visitDept}</a>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button onClick={() => setShowCredits(false)} className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase transition-all btn-tactile btn-primary-tactile">OK</button>
                  </div>
                </div>
              </div>
            )}

            {explainer && (
              <div className="flex flex-col space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><BookOpen className="w-6 h-6" /></div>
                  <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-tight`}>
                    {explainer === 'threshold' ? t.threshold :
                      explainer === 'confusion' ? t.confusion :
                        explainer === 'margin' ? t.margin :
                          explainer === 'weights' ? t.weights :
                            explainer === 'slices' ? t.slices :
                              explainer === 'visualizer' ? t.visualizer :
                                explainer === 'scenarios' ? t.scenarios :
                                  t.editor}
                  </h3>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 max-h-[50vh] overflow-y-auto no-scrollbar">
                  <p className="text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-line">
                    {explainer === 'threshold' ? t.thresholdExplainer :
                      explainer === 'confusion' ? t.confusionExplainer :
                        explainer === 'margin' ? t.marginExplainerNew :
                          explainer === 'weights' ? t.weightsExplainer :
                            explainer === 'slices' ? t.slicesExplainer :
                              explainer === 'visualizer' ? t.visualizerExplainer :
                                explainer === 'scenarios' ? t.scenariosExplainer :
                                  t.editorExplainer}
                  </p>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <a href={explainer === 'threshold' ? t.thresholdWiki :
                    explainer === 'confusion' ? t.confusionWiki :
                      explainer === 'margin' ? t.marginWiki :
                        explainer === 'weights' ? t.weightsWiki :
                          explainer === 'slices' || explainer === 'scenarios' ? '#' :
                            explainer === 'visualizer' ? t.visualizerWiki :
                              t.editorWiki} target="_blank" className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:underline"><ExternalLink className="w-4 h-4" /> {t.learnMore}</a>
                  <button onClick={() => setExplainer(null)} className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase transition-all btn-tactile btn-primary-tactile">OK</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`flex items-center justify-between mb-3 border-b ${isNebula ? 'border-white/5' : isEclipse ? 'border-slate-800/80' : 'border-slate-200'} pb-2 flex-shrink-0 z-10 transition-colors ${isNebula ? 'glass-header' : isDaylight ? 'glass-header' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-amber-500/20 blur-lg rounded-full"></div>
            <Telescope className="w-7 h-7 text-amber-500 relative z-10 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          </div>
          <div className="flex flex-col w-fit">
            <h1 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-[0.15em] leading-none`}>{t.title}</h1>
            <div className="flex items-center justify-between mt-1 w-full">
              <span className="text-[9px] text-amber-500/70 font-black uppercase tracking-[0.2em] leading-none">Powered by UMBC</span>
              <span className="text-[9px] text-slate-400 font-bold border-l border-white/10 pl-2 uppercase tracking-widest leading-none">V2.5</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTutorialStep(0)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all duration-300 btn-tactile tutorial-btn-pulse ${isNebula ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40 backdrop-blur-md shadow-lg hover:bg-blue-500/30' : isDaylight ? 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100' : 'bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {t.tutorialBtn}
          </button>
          <button
            onClick={cycleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all duration-300 btn-tactile ${isNebula ? 'bg-white/10 text-white border border-white/20 backdrop-blur-md shadow-lg' : isDaylight ? 'bg-slate-100 border border-slate-300 text-slate-600 shadow-sm' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-indigo-400'}`}
          >
            <Palette className={`w-3.5 h-3.5 ${isNebula ? 'animate-pulse text-blue-400' : isDaylight ? 'text-indigo-500' : 'text-slate-400'}`} />
            {lang === 'zh' ? '主题' : lang === 'es' ? 'TEMA' : 'THEME'}
          </button>

          <div className={`flex rounded-lg p-0.5 border transition-all ${isNebula ? 'bg-white/5 border-white/10 backdrop-blur-md' : isDaylight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
            {['en', 'zh', 'es'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-2.5 py-1 rounded text-xs font-black uppercase transition-all btn-tactile ${lang === l ? (isNebula ? 'bg-white/10 text-white border border-white/20 shadow-sm' : isDaylight ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-600/40 text-white') : isDaylight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={() => setShowCredits(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase border transition-all btn-tactile ${isNebula ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white backdrop-blur-sm' : isDaylight ? 'bg-white border-slate-200 text-slate-500 hover:text-blue-600' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-blue-400'}`}><Info className="w-3.5 h-3.5" /> {t.aboutBtn}</button>

          <div className={`${isNebula ? 'bg-white/5 border-white/10 backdrop-blur-sm' : isDaylight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-slate-800/80'} px-4 py-1 rounded-xl border flex items-center gap-3 transition-colors`}>
            <p className="text-xs text-slate-400 font-black uppercase">{t.accuracy}</p>
            <p className="text-lg font-black text-blue-400 transition-all">{stats.accuracy}%</p>
          </div>
        </div>
      </header>

      {/* Main Grid: Precision balanced to 20% : 60% : 20% ratio */}
      <div className="flex-1 grid grid-cols-[20%_1fr_20%] gap-3 min-h-0">

        {/* LEFT Column (20%) */}
        <section className="flex flex-col gap-3 min-h-0">
          <div ref={refParams} className="bg-[#0f131a] border border-slate-800/80 rounded-2xl glass-card p-4 flex-1 flex flex-col gap-4 shadow-xl aurora-border overflow-hidden">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4 flex-shrink-0">
              <h2 className={`text-sm font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'} tracking-[0.15em] flex items-center gap-3`}>
                <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  <Settings className="w-4 h-4 text-blue-400" />
                </div>
                {t.params}
              </h2>
              <div className={`text-[11px] font-mono font-black px-2 py-0.5 rounded border-2 ${Object.values(weights).reduce((a, b) => a + b, 0) === 100 ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/50 text-amber-400 bg-amber-500/10'}`}>Σ={Object.values(weights).reduce((a, b) => a + b, 0)}%</div>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Scenarios: Demo Presets */}
              <div ref={refScenarios} className="bg-blue-500/[0.03] border border-blue-500/10 rounded-xl p-3 relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/40 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-blue-400 uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5" /> {t.scenarios}
                    </div>
                    <button onClick={() => setExplainer('scenarios')} className="w-4 h-4 rounded-full bg-blue-500/10 border border-blue-400/30 flex items-center justify-center hover:bg-blue-400/20 transition-all cursor-pointer btn-tactile">
                      <span className="text-[9px] font-black text-blue-400">?</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SCENARIOS.map(s => {
                      const Icon = s.icon === 'Target' ? Target : s.icon === 'Users' ? Users : s.icon === 'Sparkles' ? Sparkles : Activity;
                      const isActive = Object.keys(s.weights).every(k => weights[k] === s.weights[k]) && threshold === s.threshold;
                      return (
                        <button
                          key={s.id}
                          onClick={() => applyScenario(s)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all btn-tactile ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/40 text-slate-300 border border-slate-700/50 hover:text-white hover:bg-slate-700'}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="truncate">{t[`scenario${s.id.charAt(0).toUpperCase() + s.id.slice(1)}`]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Threshold: The Decision Gateway (Emphasized) */}
              <div ref={refThreshold} className="bg-rose-500/[0.03] border border-rose-500/10 rounded-xl p-3 relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/40"></div>
                <div className="space-y-2 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-xs font-black text-rose-400 uppercase tracking-widest mb-0.5">
                        <GraduationCap className="w-3.5 h-3.5" /> {t.threshold}
                        <button onClick={() => setExplainer('threshold')} className="text-slate-600 hover:text-blue-400 transition-colors btn-tactile p-0.5"><HelpCircle className="w-3 h-3" /></button>
                      </div>
                      <span className="text-[10px] font-black text-rose-500/60 uppercase tracking-tighter">Master Policy Gateway</span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-rose-400 font-mono text-xl font-black leading-none drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">{threshold}</span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase">Percentile</span>
                    </div>
                  </div>
                  <input type="range" min="0" max="100" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} className="w-full accent-rose-500 h-1" />
                </div>
              </div>

              <div className="flex flex-col gap-2 min-h-0 flex-1">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                    {t.weights}
                    <button onClick={() => setExplainer('weights')} className="text-slate-600 hover:text-blue-400 transition-colors btn-tactile p-0.5"><HelpCircle className="w-4 h-4" /></button>
                  </h3>
                  <div className="grid grid-cols-2 gap-1 px-0.5">
                    <button onClick={() => handleWeights('normalize')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-0.5 rounded uppercase font-bold transition-all active:scale-95 btn-tactile">{t.normalize}</button>
                    <button onClick={() => handleWeights('default')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-0.5 rounded uppercase font-bold transition-all active:scale-95 btn-tactile">{t.default}</button>
                    <button onClick={() => handleWeights('random')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-0.5 rounded uppercase font-bold transition-all active:scale-95 btn-tactile">{t.random}</button>
                    <button onClick={() => handleWeights('reset')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-0.5 rounded uppercase font-bold transition-all active:scale-95 btn-tactile">{t.reset}</button>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 pr-0.5 overflow-hidden">
                  {Object.keys(weights).map(k => (
                    <div key={k} className="space-y-0 relative group">
                      <div className="flex justify-between text-xs font-bold leading-none mb-0.5">
                        <span className="text-slate-300 capitalize truncate">{t[k] || k}</span>
                        <span className="text-blue-400 font-mono">{weights[k]}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={weights[k]} onChange={(e) => setWeights(p => ({ ...p, [k]: parseInt(e.target.value) }))} className="w-full h-1" />
                      <div className="absolute -left-1.5 top-0 bottom-0 w-0.5 bg-blue-500/40 rounded opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MIDDLE Column (60%) */}
        <section className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <div ref={refViz} className="bg-[#0f131a] border border-slate-800/80 rounded-2xl glass-card p-4 h-[69%] relative shadow-inner aurora-border">
            <div className="flex flex-col mb-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-[0.15em] flex items-center gap-3`}>
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                      <Activity className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      {t.visualizer}
                      <button onClick={() => setExplainer('visualizer')} className="w-5 h-5 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center hover:bg-slate-600/80 transition-all cursor-pointer btn-tactile">
                        <span className="text-[11px] font-black text-slate-300">?</span>
                      </button>
                    </div>
                  </h3>
                  <button onClick={() => setSwapAxes(!swapAxes)} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-black uppercase hover:bg-slate-700 transition-all active:scale-95 btn-tactile">
                    <RefreshCw className={`w-3 h-3 ${swapAxes ? 'rotate-180' : ''} transition-transform`} /> {t.axisSwap}
                  </button>
                  <button onClick={() => setIsMining(!isMining)} className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-black uppercase transition-all active:scale-95 btn-tactile ${isMining ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/20' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                    <Target className={`w-3 h-3 ${isMining ? 'animate-spin-slow' : ''}`} /> {lang === 'zh' ? '挖掘疑难样本' : (lang === 'es' ? 'Minería' : 'Mine Edge Cases')}
                  </button>
                </div>
                <div className="flex gap-3 text-[11px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t.admit}</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {t.reject}</span>
                </div>
              </div>
            </div>
            <div className="h-[calc(100%-20px)] w-full relative group">
              {/* Physical Truncation Marks (Standard Scientific Notation) */}
              <div className="absolute bottom-[28px] left-[34px] flex flex-col gap-0.5 rotate-[-20deg] pointer-events-none select-none opacity-50 z-10">
                <div className="w-3.5 h-[1.5px] bg-slate-500 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)]"></div>
                <div className="w-3.5 h-[1.5px] bg-slate-500 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)]"></div>
              </div>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 30 }}>

                  <CartesianGrid strokeDasharray="3 3" stroke={isDaylight ? "#e2e8f0" : isNebula ? "rgba(255,255,255,0.03)" : "#21262d"} vertical={false} />
                  <XAxis type="number" dataKey={!swapAxes ? "gpa" : "sat"} domain={!swapAxes ? [2.5, 4.0] : [1200, 1600]} stroke={isDaylight ? '#94a3b8' : '#484f58'} fontSize={11} tick={{ fontFamily: 'JetBrains Mono' }} allowDataOverflow={true} label={{ value: !swapAxes ? 'GPA' : 'SAT', position: 'insideBottomRight', offset: -10, fill: isDaylight ? '#475569' : '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: '900' }} />
                  <YAxis type="number" dataKey={!swapAxes ? "sat" : "gpa"} domain={!swapAxes ? [1200, 1600] : [2.5, 4.0]} stroke={isDaylight ? '#94a3b8' : '#484f58'} fontSize={11} tick={{ fontFamily: 'JetBrains Mono' }} allowDataOverflow={true} label={{ value: !swapAxes ? 'SAT' : 'GPA', angle: -90, position: 'insideLeft', offset: 10, fill: isDaylight ? '#475569' : '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: '900' }} />
                  {boundaryVal !== null && (
                    <ReferenceLine y={boundaryVal} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={2}
                      label={(props) => (
                        <text x={props.viewBox.x + props.viewBox.width} y={props.viewBox.y} dy={-12} textAnchor="end" fill={isDaylight ? '#2563eb' : '#60a5fa'} fontSize={11} fontWeight="900" style={{ letterSpacing: '0.05em', paintOrder: 'stroke', stroke: isDaylight ? '#ffffff' : '#070a0f', strokeWidth: '3px', strokeLinejoin: 'round' }}>
                          {selectedId ? t.conditionalBoundary : t.decisionBoundary}
                        </text>
                      )}
                    />
                  )}

                  {/* Scientific Projections */}
                  {selectedId !== null && originalStudent && (
                    <>
                      <ReferenceLine
                        x={!swapAxes ? originalStudent.gpa : originalStudent.sat}
                        stroke="#3b82f6"
                        strokeDasharray="3 3"
                        opacity={0.3}
                        label={{
                          position: 'top',
                          value: !swapAxes ? originalStudent.gpa.toFixed(2) : Math.round(originalStudent.sat),
                          fill: '#3b82f6',
                          fontSize: 10,
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 'bold'
                        }}
                      />
                      <ReferenceLine
                        y={!swapAxes ? originalStudent.sat : originalStudent.gpa}
                        stroke="#3b82f6"
                        strokeDasharray="3 3"
                        opacity={0.3}
                        label={(props) => (
                          <text x={props.viewBox.x + props.viewBox.width} y={props.viewBox.y} dy={-12} textAnchor="end" fill="#60a5fa" fontSize={10} fontWeight="bold" fontFamily="JetBrains Mono" style={{ paintOrder: 'stroke', stroke: '#070a0f', strokeWidth: '3px', strokeLinejoin: 'round' }}>
                            {!swapAxes ? Math.round(originalStudent.sat) : originalStudent.gpa.toFixed(2)}
                          </text>
                        )}
                      />
                    </>
                  )}

                  <Scatter
                    data={data}
                    onClick={(e) => {
                      if (e && e.id !== undefined) {
                        setSelectedId(prev => (prev === e.id ? null : e.id));
                      }
                    }}
                  >
                    {data.map((entry, index) => {
                      const pred = isAdmitted(entry);
                      const isMatch = checkMatch(entry);
                      const isHard = isMatch && hardSamples.some(h => h.id === entry.id);
                      const isSelected = isMatch && selectedId === entry.id;

                      return (
                        <Cell
                          key={index}
                          fill={pred ? COLORS.admit : COLORS.reject}
                          stroke={isSelected ? 'white' : (isHard ? '#fbbf24' : 'transparent')}
                          strokeWidth={isHard || isSelected ? 2 : 1}
                          opacity={isMatch ? 1 : 0.15}
                          className={isHard ? 'animate-pulse' : ''}
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            filter: isHard ? 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.8))' : 'none'
                          }}
                        />
                      );
                    })}
                  </Scatter>

                  {/* Trajectory Line */}
                  {selectedId !== null && (
                    <Scatter
                      data={trajectoryData}
                      line={{
                        stroke: isCrossed ? '#fbbf24' : '#3b82f6',
                        strokeWidth: 2,
                        strokeDasharray: '5 5',
                        filter: isCrossed ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))' : 'none'
                      }}
                      shape={() => null}
                      opacity={checkMatch(originalStudent) ? 1 : 0.15}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* Current CounterLens Point (Larger/Glowing) */}
                  {selectedId !== null && cfProfile && (
                    <Scatter data={[trajectoryData[1]]}>
                      <Cell
                        fill={isAdmitted(cfProfile) ? COLORS.admit : COLORS.reject}
                        stroke="white"
                        strokeWidth={3}
                        className={checkMatch(originalStudent) && isCrossed ? 'animate-pulse' : ''}
                        opacity={checkMatch(originalStudent) ? 1 : 0.15}
                        style={{
                          filter: checkMatch(originalStudent) ? 'drop-shadow(0 0 10px rgba(255,255,255,0.4))' : 'none',
                          pointerEvents: 'none'
                        }}
                      />
                    </Scatter>
                  )}


                  {/* Margin Shortest Path Line (Original) */}
                  {selectedId !== null && originalStudent && marginStats && (
                    <Scatter
                      data={[
                        { gpa: originalStudent.gpa, sat: originalStudent.sat },
                        marginStats.projection
                      ]}
                      line={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.4 }}
                      shape={() => null}
                      opacity={checkMatch(originalStudent) ? 1 : 0.15}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* Margin Shortest Path Line (Counterfactual) */}
                  {selectedId !== null && cfProfile && cfMarginStats && (
                    <Scatter
                      data={[
                        { gpa: cfProfile.gpa, sat: cfProfile.sat },
                        cfMarginStats.projection
                      ]}
                      line={{ stroke: '#fbbf24', strokeWidth: 1, strokeDasharray: '2 2', opacity: 0.6 }}
                      shape={() => null}
                      opacity={checkMatch(originalStudent) ? 1 : 0.15}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div ref={refData} className="bg-[#0f131a] border border-slate-800/80 rounded-2xl glass-card p-4 h-[31%] relative shadow-inner aurora-border flex flex-col gap-2 overflow-hidden">
            {/* Header with tabs */}
            <div className="flex justify-between items-center border-b border-white/10 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg p-0.5 bg-slate-800/60 border border-white/5">
                  <button onClick={() => setStatsTab('slices')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all ${statsTab === 'slices' ? 'bg-purple-500/30 text-purple-300 border border-purple-400/40' : 'text-slate-500 hover:text-white'}`}>
                    <BarChart3 className="w-3 h-3" /> {t.slices}
                  </button>
                  <button onClick={() => setStatsTab('stats')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all ${statsTab === 'stats' ? 'bg-blue-500/30 text-blue-300 border border-blue-400/40' : 'text-slate-500 hover:text-white'}`}>
                    <Database className="w-3 h-3" /> {t.dataStats}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setExplainer('slices')} className="w-5 h-5 rounded-full bg-slate-700/50 border border-white/10 flex items-center justify-center hover:bg-slate-600/80 transition-all cursor-pointer btn-tactile"><span className="text-[11px] font-black text-slate-300">?</span></button>
                <div className="px-2 py-0.5 rounded bg-slate-800/60 text-[10px] text-slate-400 font-mono font-black border border-white/5 uppercase">N={INITIAL_POOL.length}</div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
              {statsTab === 'slices' ? (
                /* === SCENTED WIDGETS === */
                <div className="space-y-0">
                  {/* Legend + Axis header row */}
                  <div className="px-2 pb-1.5 mb-0.5 border-b border-white/5 space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500/70" /><span className="text-[8px] font-bold text-slate-500 uppercase">{t.admit}</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-rose-500/60" /><span className="text-[8px] font-bold text-slate-500 uppercase">{t.reject}</span></div>
                      <div className="flex items-center gap-1 ml-auto"><div className="w-[1px] h-2.5 bg-rose-400/60" /><span className="text-[8px] font-bold text-slate-500 uppercase">{t.threshold}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-[24px] flex-shrink-0" />
                      <span className="w-3 flex-shrink-0" />
                      <span className="w-[60px] flex-shrink-0 text-[8px] font-bold text-slate-600 uppercase">{lang === 'zh' ? '分组' : 'Slice'}</span>
                      <div className="flex-1 flex items-center text-[8px] font-mono text-slate-600 relative">
                        <span>0</span>
                        <span className="flex-1 text-center text-[7px] text-slate-600/60 uppercase tracking-widest">{lang === 'zh' ? '← 录取分数 →' : '← Score →'}</span>
                        <span>100</span>
                        <span className="text-rose-400/70 absolute text-[7px]" style={{ left: `${threshold}%`, transform: 'translateX(-50%)', top: '-10px' }}>▼{threshold}</span>
                      </div>
                    </div>
                  </div>
                  {stats.groupStats.map((g) => {
                    const isActive = filterMode?.type === 'slice' && filterMode?.value === g.name;
                    const dist = sliceDistributions[g.name] || [];
                    const maxBinVal = Math.max(...dist.map(b => b.admit + b.reject), 1);
                    // Calculate threshold bin position (0-9 for 10 bins)
                    const thresholdPos = (threshold / 100) * 100; // percentage position
                    return (
                      <button key={g.name} onClick={() => setFilterMode(prev => (prev?.type === 'slice' && prev?.value === g.name) ? null : { type: 'slice', value: g.name })}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-all cursor-pointer ${isActive ? 'bg-blue-500/10 border border-blue-400/25' : 'hover:bg-white/[0.03] border border-transparent'}`}>
                        <span className="text-[9px] font-mono text-slate-600 w-[24px] text-right flex-shrink-0">({g.count})</span>
                        <div className={`w-3 h-3 rounded-[3px] border-2 flex-shrink-0 flex items-center justify-center transition-all ${isActive ? 'border-blue-400 bg-blue-500/30' : 'border-slate-600 bg-transparent'}`}>
                          {isActive && <div className="w-1.5 h-1.5 rounded-[1px] bg-blue-400" />}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider w-[60px] text-left truncate flex-shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-400'}`}>{g.name}</span>
                        {/* Visual Scent: mini histogram with threshold marker */}
                        <div className="flex-1 flex items-end gap-[1px] h-[22px] relative">
                          {/* Threshold marker line */}
                          <div className="absolute top-0 bottom-0 w-[1px] bg-rose-400/50 z-10" style={{ left: `${thresholdPos}%` }} />
                          {dist.map((bin, i) => (
                            <div key={i} className="flex-1 flex flex-col justify-end h-full">
                              {bin.admit > 0 && (
                                <div style={{ height: `${(bin.admit / maxBinVal) * 100}%`, minHeight: '1px' }}
                                  className="bg-emerald-500/70 rounded-t-[1px]" />
                              )}
                              {bin.reject > 0 && (
                                <div style={{ height: `${(bin.reject / maxBinVal) * 100}%`, minHeight: '1px' }}
                                  className="bg-rose-500/60" />
                              )}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* === DATA STATISTICS (WIT-style) === */
                <div className="space-y-3">
                  {/* Numeric Features */}
                  <div>
                    <div className="text-[9px] font-black text-blue-400/70 uppercase tracking-widest mb-1.5 px-1">{t.numericFeatures} ({featureStats.numeric.length})</div>
                    <div className="space-y-1.5">
                      {featureStats.numeric.map(f => (
                        <div key={f.key} className="bg-slate-800/30 rounded-lg px-2.5 py-2 border border-white/[0.03]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-black text-slate-200 uppercase tracking-wide">{f.label}</span>
                            <div className="flex gap-2 text-[9px] font-mono text-slate-500">
                              <span>{t.statMean}:<span className="text-slate-300 ml-0.5">{f.mean}</span></span>
                              <span>{t.statStd}:<span className="text-slate-300 ml-0.5">{f.std}</span></span>
                            </div>
                          </div>
                          {/* Inline histogram with admit/reject coloring */}
                          <div className="flex items-end gap-px h-5">
                            {f.hist.map((bin, i) => {
                              const maxBinVal = Math.max(...f.hist.map(b => b.total), 1);
                              return (
                                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                                  {bin.admit > 0 && (
                                    <div className="rounded-t-sm" style={{ height: `${(bin.admit / maxBinVal) * 100}%`, minHeight: '1px', background: 'rgba(16,185,129,0.6)' }} />
                                  )}
                                  {bin.reject > 0 && (
                                    <div style={{ height: `${(bin.reject / maxBinVal) * 100}%`, minHeight: '1px', background: 'rgba(239,68,68,0.45)' }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-0.5">
                            <span>{f.min}</span><span>{f.max}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Categorical Features */}
                  <div>
                    <div className="text-[9px] font-black text-purple-400/70 uppercase tracking-widest mb-1.5 px-1">{t.categoricalFeatures} ({featureStats.categorical.length})</div>
                    <div className="space-y-1.5">
                      {featureStats.categorical.map(f => {
                        const maxCount = Math.max(...f.bars.map(b => b.count), 1);
                        return (
                          <div key={f.key} className="bg-slate-800/30 rounded-lg px-2.5 py-2 border border-white/[0.03]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-black text-slate-200 uppercase tracking-wide">{f.label}</span>
                              <span className="text-[9px] font-mono text-slate-500">{t.statUnique}:<span className="text-slate-300 ml-0.5">{f.unique}</span></span>
                            </div>
                            <div className="space-y-1">
                              {f.bars.map((bar, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-black text-slate-500 uppercase w-[28px] truncate flex-shrink-0">{bar.label}</span>
                                  <div className="flex-1 h-3.5 bg-slate-800/40 rounded-sm relative overflow-hidden">
                                    {/* Admitted portion */}
                                    <div className="absolute left-0 top-0 bottom-0 rounded-sm" style={{ width: `${(bar.admit / maxCount) * 100}%`, background: 'rgba(16,185,129,0.5)' }} />
                                    {/* Rejected portion (stacked after admit) */}
                                    <div className="absolute top-0 bottom-0 rounded-sm" style={{ left: `${(bar.admit / maxCount) * 100}%`, width: `${((bar.count - bar.admit) / maxCount) * 100}%`, background: 'rgba(239,68,68,0.3)' }} />
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-500 w-[44px] text-right flex-shrink-0">{bar.rate}% <span className="text-slate-600">({bar.count})</span></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* COUNTERFACTUAL EDITOR (Now in Right Column) */}
          <div ref={refEditor} className={`${isDaylight ? 'bg-white border-2 border-blue-300/50' : 'bg-[#0f131a] border-2 border-blue-500/30'} rounded-2xl overflow-hidden flex flex-col h-[69%] shadow-xl aurora-border min-h-0 ${isNebula ? 'glass-card border-none' : ''}`}>
            <div className="p-4 flex flex-col min-h-0 h-full overflow-hidden bg-blue-500/[0.03]">
              <div className="flex items-center justify-between border-b border-blue-500/30 pb-3 mb-1 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Target className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-[0.15em]`}>{t.editor}</div>
                </div>
                <button onClick={() => setExplainer('editor')} className="text-slate-500 hover:text-white transition-colors btn-tactile p-0.5"><HelpCircle className="w-4 h-4" /></button>
              </div>

              {selectedId !== null && cfProfile && originalStudent ? (
                <div className="flex-1 flex flex-col gap-4 pt-4 overflow-y-auto overflow-x-hidden no-scrollbar animate-in fade-in slide-in-from-right-4 duration-500">
                  {/* Sliders Area (Vertical Stack for narrow column) */}
                  <div className="space-y-4">
                    <div className="space-y-1 relative">
                      <div className="flex justify-between text-[11px] font-black text-blue-400 uppercase tracking-widest">
                        <span>GPA</span>
                        <div className="flex items-center gap-1.5">
                          {cfProfile.gpa !== originalStudent.gpa && (
                            <span className={`text-[10px] ${cfProfile.gpa > originalStudent.gpa ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {cfProfile.gpa > originalStudent.gpa ? '+' : ''}{(cfProfile.gpa - originalStudent.gpa).toFixed(2)}
                            </span>
                          )}
                          <span className="font-mono bg-blue-500/10 px-1 rounded">{cfProfile.gpa.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="relative h-5 flex items-center">
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-slate-800 rounded-full"></div>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-slate-500/40 rounded-full z-0 transition-all duration-500 -translate-x-1/2"
                          style={{ left: `${((originalStudent.gpa - 2) / 2) * 100}%` }}
                        ></div>
                        <input type="range" min="2.0" max="4.0" step="0.01" value={cfProfile.gpa} onChange={(e) => handleCfChange('gpa', parseFloat(e.target.value))} className="absolute inset-0 w-full bg-transparent appearance-none cursor-pointer z-10" />
                      </div>
                    </div>

                    <div className="space-y-1 relative">
                      <div className="flex justify-between text-[11px] font-black text-blue-400 uppercase tracking-widest">
                        <span>SAT</span>
                        <div className="flex items-center gap-1.5">
                          {cfProfile.sat !== originalStudent.sat && (
                            <span className={`text-[10px] ${cfProfile.sat > originalStudent.sat ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {cfProfile.sat > originalStudent.sat ? '+' : ''}{cfProfile.sat - originalStudent.sat}
                            </span>
                          )}
                          <span className="font-mono bg-blue-500/10 px-1 rounded">{cfProfile.sat}</span>
                        </div>
                      </div>
                      <div className="relative h-5 flex items-center">
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-slate-800 rounded-full"></div>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-slate-500/40 rounded-full z-0 transition-all duration-500 -translate-x-1/2"
                          style={{ left: `${((originalStudent.sat - 800) / 800) * 100}%` }}
                        ></div>
                        <input type="range" min="800" max="1600" step="10" value={cfProfile.sat} onChange={(e) => handleCfChange('sat', parseInt(e.target.value))} className="absolute inset-0 w-full bg-transparent appearance-none cursor-pointer z-10" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'isAthlete', label: t.athlete, isBool: true },
                        { key: 'isFirstGen', label: t.firstGen, isBool: true },
                        { key: 'gender', label: formatVal(cfProfile.gender, 'gender'), isGender: true },
                        { key: 'isResident', label: t.resident, isBool: true }
                      ].map((btn) => {
                        const isDirty = cfProfile[btn.key] !== originalStudent[btn.key];
                        let colorClass = 'bg-slate-800/40 border-slate-700/30 text-slate-300';
                        if (isDirty) {
                          const isGain = cfProfile[btn.key] === true || (btn.isGender && cfProfile.gender === 'Female');
                          colorClass = isGain ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/10' : 'bg-rose-600/20 border-rose-500/50 text-white shadow-lg shadow-rose-500/10';
                        }
                        return (
                          <button key={btn.key} onClick={() => btn.isGender ? handleCfChange('gender', cfProfile.gender === 'Male' ? 'Female' : 'Male') : handleCfChange(btn.key, !cfProfile[btn.key])}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-black border transition-all active:scale-92 uppercase tracking-tight btn-tactile ${colorClass}`}>
                            {btn.isBool ? `${btn.label}: ${cfProfile[btn.key] ? t.yes : t.no}` : btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-500/5 border border-indigo-500/15 rounded-xl group relative overflow-hidden">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-0.5">{t.margin}</span>
                          <button onClick={() => setExplainer('margin')} className="w-3.5 h-3.5 rounded-full bg-indigo-400/20 border border-indigo-400/30 flex items-center justify-center hover:bg-indigo-400/30 transition-all cursor-pointer z-10 btn-tactile"><span className="text-[9px] font-black text-indigo-400">?</span></button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">ORIG: {marginStats?.margin || "0.00"}</span>
                          {cfMarginStats && (
                            <span className={`text-[10px] font-black ${Number(cfMarginStats.margin) >= Number(marginStats?.margin || 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(cfMarginStats.margin) >= Number(marginStats?.margin || 0) ? '↑' : '↓'} {(Math.abs(Number(cfMarginStats.margin) - Number(marginStats?.margin || 0))).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-mono font-black text-indigo-400">{cfMarginStats?.margin || "0.00"}</span>
                      </div>
                    </div>

                    <div className={`flex-1 flex flex-col justify-center items-center py-4 rounded-xl border-2 transition-all duration-700 relative overflow-hidden animate-soft-breath ${isAdmitted(cfProfile) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]'} ${isAdmitted(originalStudent) !== isAdmitted(cfProfile) ? 'animate-fate-flip' : ''}`}>
                      {isAdmitted(originalStudent) !== isAdmitted(cfProfile) && (
                        <div className="absolute top-1 right-1 flex items-center gap-1 bg-amber-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter animate-pulse">
                          <Sparkles className="w-2 h-2" /> {t.fateDelta}
                        </div>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">SIMULATED {t.fate}</span>
                      <div className="text-2xl font-black italic uppercase tracking-tighter mb-1">{isAdmitted(cfProfile) ? t.admit : t.reject}</div>
                      <div className="text-[11px] font-mono font-black opacity-80 border-t border-current/20 pt-1 mt-1 w-[80%] text-center">
                        SCORE: {calcScore(cfProfile, weights).toFixed(1)} / {threshold}.0
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 animate-in fade-in zoom-in-95 duration-1000">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                    <Fingerprint className="w-8 h-8 text-blue-400/50" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">{lang === 'zh' ? '准备就绪' : 'STANDBY'}</h4>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed uppercase max-w-[140px]">
                      {lang === 'zh' ? '请在左侧可视化面板中点击一个样本进行反事实分析' : 'Select a sample data point to begin counterfactual simulation'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-blue-500/30 rounded-full"></div>
                    <div className="w-1 h-1 bg-blue-500/30 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-blue-500/30 rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={refConfusion} className="bg-[#0f131a] border border-slate-800/80 rounded-2xl glass-card p-4 h-[31%] flex flex-col gap-4 shadow-xl aurora-border overflow-hidden">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-2">
              <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-[0.15em] leading-none flex items-center gap-3`}>
                <div className="p-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <Target className="w-4 h-4 text-emerald-400" />
                </div>
                {t.confusion}
              </p>
              <button onClick={() => setExplainer('confusion')} className="text-slate-500 hover:text-white transition-colors btn-tactile p-0.5"><HelpCircle className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center font-mono flex-1 min-h-0 pt-1">
              {[
                { l: 'TP', v: stats.tp, r: stats.tpRate, c: 'emerald', rgb: '16, 185, 129' },
                { l: 'FP', v: stats.fp, r: stats.fpRate, c: 'amber', rgb: '245, 158, 11' },
                { l: 'FN', v: stats.fn, r: stats.fnRate, c: 'rose', rgb: '239, 68, 68' },
                { l: 'TN', v: stats.tn, r: stats.tnRate, c: 'slate', rgb: '71, 85, 105' }
              ].map(m => {
                const isActive = filterMode?.type === 'confusion' && filterMode?.value === m.l;
                return (
                  <button
                    key={m.l}
                    onClick={() => setFilterMode(prev => (prev?.type === 'confusion' && prev?.value === m.l) ? null : { type: 'confusion', value: m.l })}
                    className={`p-1.5 rounded border shadow-sm transition-all duration-300 cursor-pointer flex flex-col justify-center btn-tactile ${isActive ? `border-${m.c}-400 ring-4 ring-${m.c}-500/20 scale-[1.03]` : `border-${m.c}-500/10 hover:border-${m.c}-500/30`}`}
                    style={{ backgroundColor: isActive ? `rgba(${m.rgb}, 0.5)` : `rgba(${m.rgb}, ${Math.max(0.05, m.r / 150)})`, color: isActive ? 'white' : `rgba(${m.rgb}, 1)` }}
                  >
                    <p className={`text-[11px] uppercase font-black leading-none mb-1 tracking-tighter`}>{m.l}</p>
                    <div className="flex flex-col gap-0.5">
                      <p className={`text-base font-black ${isActive ? 'text-white' : 'text-slate-200'} leading-none`}>{m.v}</p>
                      <p className={`text-xs font-bold ${isActive ? 'text-white/80' : `text-slate-200/60`} leading-none`}>{m.r}%</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {/* ===== TUTORIAL OVERLAY ===== */}
      {tutorialStep === 0 && (
        <div className="tutorial-welcome" onClick={() => setTutorialStep(-1)}>
          <div className="tutorial-welcome-card" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-500/30">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-wider mb-2`}>{t.tutorialWelcomeTitle}</h2>
            <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">{t.tutorialWelcomeDesc}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setTutorialStep(-1)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-all border border-slate-700">{t.tutorialSkip}</button>
              <button onClick={() => setTutorialStep(1)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-blue-500/25">{t.tutorialStart}</button>
            </div>
          </div>
        </div>
      )}

      {tutorialStep >= 1 && tutorialStep <= TUTORIAL_STEPS.length && tutorialRect && (
        <>
          {/* Spotlight cutout */}
          <div
            className="tutorial-spotlight"
            style={{
              top: tutorialRect.top,
              left: tutorialRect.left,
              width: tutorialRect.width,
              height: tutorialRect.height,
            }}
            onClick={() => setTutorialStep(-1)}
          />

          {/* Tooltip */}
          <div
            className={`tutorial-tooltip ${arrowClass}`}
            style={tutorialTooltipStyle}
            key={tutorialStep}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {lang === 'zh' ? `${t.tutorialStep} ${tutorialStep} ${t.tutorialOf} ${TUTORIAL_STEPS.length} 步` : `${t.tutorialStep} ${tutorialStep} ${t.tutorialOf} ${TUTORIAL_STEPS.length}`}
              </span>
            </div>
            <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-wider mb-1.5`}>
              {TUTORIAL_STEPS[tutorialStep - 1].title}
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
              {TUTORIAL_STEPS[tutorialStep - 1].desc}
            </p>

            {/* Bottom bar: dots + nav */}
            <div className="flex items-center justify-between">
              <div className="tutorial-dots">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`tutorial-dot ${i + 1 === tutorialStep ? 'active' : ''} ${i + 1 < tutorialStep ? 'done' : ''}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {tutorialStep > 1 && (
                  <button
                    onClick={() => setTutorialStep(s => s - 1)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase transition-all border border-slate-700"
                  >{t.tutorialPrev}</button>
                )}
                {tutorialStep < TUTORIAL_STEPS.length ? (
                  <button
                    onClick={() => setTutorialStep(s => s + 1)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-500/25"
                  >{t.tutorialNext}</button>
                ) : (
                  <button
                    onClick={() => setTutorialStep(-1)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-500/25"
                  >{t.tutorialDone}</button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;