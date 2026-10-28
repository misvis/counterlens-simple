export const EXPLORER_POLICY_COPY = {
  en: {
    academic: { name: 'Academic Focus', shortName: 'GPA and SAT', description: 'Uses GPA and SAT only; backgrounds do not change the score.' },
    holistic: { name: 'Whole Person Review', shortName: 'Academic scores and six backgrounds', description: 'GPA and SAT plus contributions from all six background features.' },
    opportunity: { name: 'Income Support', shortName: 'More support for lower-income ZIP areas', description: 'Uses the Whole Person Review rules with a larger bonus for lower ZIP-area median household income.' },
  },
  zh: {
    academic: { name: '学业优先', shortName: 'GPA 与 SAT', description: '仅使用 GPA 和 SAT，背景不影响得分。' },
    holistic: { name: '综合评估', shortName: '学业与六项背景', description: 'GPA、SAT 与六项背景得分相加。' },
    opportunity: { name: '低收入支持', shortName: '提高低收入地区的支持力度', description: '沿用综合评估规则，为 ZIP 地区家庭收入中位数较低的学生提供更多加分。' },
  },
  es: {
    academic: { name: 'Enfoque académico', shortName: 'GPA y SAT', description: 'Solo usa GPA y SAT; el contexto no cambia la puntuación.' },
    holistic: { name: 'Evaluación integral', shortName: 'Notas y seis factores de contexto', description: 'GPA y SAT más contribuciones de los seis factores de contexto.' },
    opportunity: { name: 'Apoyo por ingresos', shortName: 'Más apoyo a zonas de menores ingresos', description: 'Usa la evaluación integral con una mayor bonificación para zonas ZIP con menores ingresos familiares medianos.' },
  },
};

export const EXPLORER_RULE_LABEL = { en: 'Simulated rules', zh: '模拟规则', es: 'Reglas simuladas' };
