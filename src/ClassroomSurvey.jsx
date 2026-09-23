import { useEffect, useRef, useState } from 'react';
import { ClipboardList, X, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL, CLASSROOM_ID, apiRequest } from './data/api.js';
import './classroom-survey.css';

const COPY = {
  en: {
    button: 'Check-in',
    demo: 'DEMO QUESTIONNAIRE',
    submit: 'Submit answers',
    close: 'Close',
    consent: 'I agree to submit these answers for this demo.',
    note: 'This example form saves your answers to the local classroom database. Interaction counts are also collected. Do not include names, emails, or student IDs. Your separate reflection draft is not saved.',
    saved: 'Answers saved. Thank you!',
    pending: 'Submitting…',
    load: 'Loading classroom…',
    closed: 'This classroom is not accepting responses.',
    retry: 'Try again',
    optional: 'Optional',
    error: 'Could not load the classroom.',
    session: 'Classroom',
  },
  zh: {
    button: '课堂反馈',
    demo: '演示问卷',
    submit: '提交答案',
    close: '关闭',
    consent: '我同意为本次演示提交这些答案。',
    note: '这个示例问卷会将答案保存到本地课堂数据库，也会记录交互次数。请不要填写姓名、邮箱或学号。页面上另一个反思草稿仍不保存。',
    saved: '答案已保存，谢谢！',
    pending: '正在提交…',
    load: '正在加载课堂…',
    closed: '这个课堂暂不接受答案。',
    retry: '重试',
    optional: '选填',
    error: '无法加载课堂。',
    session: '课堂',
  },
  es: {
    button: 'Reflexión',
    demo: 'CUESTIONARIO DEMO',
    submit: 'Enviar respuestas',
    close: 'Cerrar',
    consent: 'Acepto enviar estas respuestas para esta demo.',
    note: 'Este formulario guarda tus respuestas en la base de datos local. También se cuentan interacciones. No incluyas nombres, correos ni identificadores. Tu borrador separado no se guarda.',
    saved: 'Respuestas guardadas. ¡Gracias!',
    pending: 'Enviando…',
    load: 'Cargando clase…',
    closed: 'Esta clase no acepta respuestas.',
    retry: 'Reintentar',
    optional: 'Opcional',
    error: 'No se pudo cargar la clase.',
    session: 'Clase',
  },
};

export default function ClassroomSurvey({ lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  const [open, setOpen] = useState(false);
  const [classroom, setClassroom] = useState(null);
  const [answers, setAnswers] = useState({});
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const submission = useRef(null);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const label = (value) => value?.[lang] || value?.en;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const triggerButton = trigger.current;
    apiRequest(`/api/v1/classrooms/${encodeURIComponent(CLASSROOM_ID)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (active) {
          setClassroom(data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    dialog.current?.querySelector('button')?.focus();
    return () => {
      active = false;
      controller.abort();
      triggerButton?.focus();
    };
  }, [open]);

  if (!API_BASE_URL) return null;
  const close = () => setOpen(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!consent || status === 'pending' || status === 'saved') return;
    setStatus('pending');
    setError('');
    submission.current ||= crypto.randomUUID();
    try {
      await apiRequest('/api/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: CLASSROOM_ID,
          submissionId: submission.current,
          questionnaireId: classroom.questionnaire.id,
          questionnaireVersion: classroom.questionnaire.version,
          locale: lang,
          consent: true,
          answers,
        }),
      });
      setStatus('saved');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="classroom-checkin-trigger"
        onClick={() => setOpen(true)}
        title={`${t.session}: ${CLASSROOM_ID}`}
      >
        <ClipboardList size={15} />
        {t.button}
      </button>
      {open && (
        <div
          className="classroom-survey-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <section
            ref={dialog}
            className="classroom-survey"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-title"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'Tab') {
                const items = [
                  ...dialog.current.querySelectorAll(
                    'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',
                  ),
                ];
                const first = items[0];
                const last = items.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                }
                if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="survey-heading">
              <div>
                <span>{t.demo}</span>
                <h2 id="survey-title">
                  {classroom ? label(classroom.questionnaire.title) : t.load}
                </h2>
              </div>
              <button type="button" aria-label={t.close} onClick={close}>
                <X size={22} />
              </button>
            </div>
            <p className="survey-context">
              {t.session}: <strong>{classroom?.title || CLASSROOM_ID}</strong>
            </p>
            <p className="survey-notice">{t.note}</p>
            {error && (
              <p role="alert" className="survey-error">
                {error}
              </p>
            )}
            {status === 'saved' ? (
              <div className="survey-saved" role="status">
                <CheckCircle2 size={40} />
                <h3>{t.saved}</h3>
                <button onClick={close}>{t.close}</button>
              </div>
            ) : (
              classroom &&
              (classroom.status !== 'open' || classroom.synthetic ? (
                <p>{t.closed}</p>
              ) : (
                <form onSubmit={submit}>
                  <fieldset disabled={status === 'pending'}>
                    {classroom.questionnaire.questions.map((q) => (
                      <div className="survey-question" key={q.id}>
                        <label htmlFor={`question-${q.id}`}>
                          {label(q.label)}
                          {q.required && ' *'}
                        </label>
                        {q.hint && <p>{label(q.hint)}</p>}
                        {q.type === 'text' ? (
                          <textarea
                            id={`question-${q.id}`}
                            rows={3}
                            maxLength={q.maxLength}
                            required={q.required}
                            value={answers[q.id] || ''}
                            onChange={(e) =>
                              setAnswers({ ...answers, [q.id]: e.target.value })
                            }
                          />
                        ) : (
                          <select
                            id={`question-${q.id}`}
                            required={q.required}
                            value={answers[q.id] ?? ''}
                            onChange={(e) =>
                              setAnswers({
                                ...answers,
                                [q.id]:
                                  q.type === 'scale' && e.target.value !== ''
                                    ? Number(e.target.value)
                                    : e.target.value,
                              })
                            }
                          >
                            <option value="">—</option>
                            {(q.type === 'scale'
                              ? Array.from(
                                  { length: q.max - q.min + 1 },
                                  (_, i) => ({
                                    value: q.min + i,
                                    label: { en: String(q.min + i) },
                                  }),
                                )
                              : q.options
                            ).map((o) => (
                              <option key={o.value} value={o.value}>
                                {label(o.label)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                    <label className="survey-consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        required
                      />
                      {t.consent}
                    </label>
                    <button
                      className="survey-submit"
                      type="submit"
                      disabled={!consent || status === 'pending'}
                    >
                      {status === 'pending' ? t.pending : t.submit}
                    </button>
                  </fieldset>
                </form>
              ))
            )}
          </section>
        </div>
      )}
    </>
  );
}
