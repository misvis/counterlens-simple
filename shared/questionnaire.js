// Keep published question versions stable so answers remain interpretable.
export const DEMO_QUESTIONNAIRE = {
  id: 'ethics-exit-ticket',
  version: 'demo-v1',
  demo: true,
  title: { en: 'Classroom check-in', zh: '课堂反馈', es: 'Reflexión de clase' },
  questions: [
    {
      id: 'policy',
      type: 'choice',
      required: true,
      label: {
        en: 'Which policy would you discuss first?',
        zh: '你最想先讨论哪种政策？',
        es: '¿Qué política discutirías primero?',
      },
      options: [
        {
          value: 'academic',
          label: {
            en: 'Academic Focus',
            zh: '学术优先',
            es: 'Enfoque académico',
          },
        },
        {
          value: 'holistic',
          label: {
            en: 'Whole-Person Review',
            zh: '综合评估',
            es: 'Evaluación integral',
          },
        },
        {
          value: 'opportunity',
          label: {
            en: 'Opportunity-Aware',
            zh: '机会导向',
            es: 'Atención a oportunidades',
          },
        },
      ],
    },
    {
      id: 'confidence',
      type: 'scale',
      required: true,
      min: 1,
      max: 5,
      label: {
        en: 'How confident are you in explaining a trade-off between policies?',
        zh: '你有多大把握解释不同政策之间的取舍？',
        es: '¿Qué confianza tienes para explicar un compromiso entre políticas?',
      },
      hint: {
        en: '1 = not yet confident · 5 = very confident',
        zh: '1 = 还没有把握 · 5 = 非常有把握',
        es: '1 = poca confianza · 5 = mucha confianza',
      },
    },
    {
      id: 'reflection',
      type: 'text',
      required: false,
      maxLength: 600,
      label: {
        en: 'What would you question about this decision? (optional)',
        zh: '你会对这项决定提出什么疑问？（选填）',
        es: '¿Qué cuestionarías de esta decisión? (opcional)',
      },
    },
  ],
};

export const validateAnswers = (
  answers,
  questionnaire = DEMO_QUESTIONNAIRE,
) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers))
    return false;
  if (
    Object.keys(answers).some(
      (key) => !questionnaire.questions.some((q) => q.id === key),
    )
  )
    return false;
  return questionnaire.questions.every((q) => {
    const value = answers[q.id];
    if (value === undefined || value === '') return !q.required;
    if (q.type === 'choice')
      return q.options.some((option) => option.value === value);
    if (q.type === 'scale')
      return Number.isInteger(value) && value >= q.min && value <= q.max;
    return typeof value === 'string' && value.length <= q.maxLength;
  });
};
