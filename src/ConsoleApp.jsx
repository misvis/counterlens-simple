import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Telescope,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE_URL, apiRequest } from './data/api.js';
import './console.css';

const BASE =
  API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');
const LOCAL_DEMO = import.meta.env.DEV &&
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname);
const SECTIONS = {
  overview: { label: 'Overview', heading: 'A window into the classroom.', description: 'Follow the learning activity. Keep the system in view.' },
  classroom: { label: 'Classroom & surveys', heading: 'Classroom & surveys', description: 'Explore classroom events, submitted answers, and student reflections.' },
  system: { label: 'System health', heading: 'System health', description: 'Check the API, MongoDB connection, response times, and errors.' },
  data: { label: 'Dataset release', heading: 'Dataset release', description: 'Inspect the current dataset version, feature counts, and quality checks.' },
};
const names = {
  page_view: 'Page opened',
  policy_selected: 'Policy compared',
  student_selected: 'Student explored',
  borderline_cases_opened: 'Borderline cases',
  counterfactual_flipped: 'Decision flipped',
  language_changed: 'Language changed',
  theme_changed: 'Theme changed',
  academic: 'Academic Focus',
  holistic: 'Whole-Person Review',
  opportunity: 'Opportunity-Aware',
};
const title = (name) => names[name] || name;
const time = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const number = (n) => new Intl.NumberFormat().format(n || 0);
function Panel({ title: heading, note, children, className = '' }) {
  return (
    <section className={`console-panel ${className}`}>
      <div className="console-panel-heading">
        <h2>{heading}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  );
}
function Empty({ children = 'No activity in this window yet.' }) {
  return <div className="console-empty">{children}</div>;
}
function Distribution({ rows, color = '#4262d5' }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return rows.length ? (
    <div className="console-distribution">
      {rows.map((row) => (
        <div key={row.name}>
          <div>
            <span>{title(row.name)}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="console-track">
            <i
              style={{
                width: `${(row.count / max) * 100}%`,
                background: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty />
  );
}

export default function ConsoleApp() {
  const [token, setToken] = useState(LOCAL_DEMO ? 'counterlens-local-demo' : '');
  const [draftToken, setDraftToken] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [classroomId, setClassroomId] = useState(
    () => new URLSearchParams(window.location.search).get('class') || 'local-demo',
  );
  const [hours, setHours] = useState('24');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    return Object.hasOwn(SECTIONS, requested) ? requested : 'overview';
  });
  const [newTitle, setNewTitle] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const generation = useRef(0);
  const request = useCallback(
    (path, options = {}) =>
      apiRequest(
        path,
        {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
          },
        },
        BASE,
      ),
    [token],
  );
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const [data, sessions] = await Promise.all([
        request(
          `/api/v1/monitoring/summary?windowHours=${hours}&classroomId=${encodeURIComponent(classroomId)}`,
        ),
        request('/api/v1/monitoring/classrooms'),
      ]);
      if (current !== generation.current) return;
      setSummary(data);
      setClassrooms(sessions);
      setError('');
    } catch (err) {
      if (current === generation.current) {
        setError(err.message);
        if (err.status === 401) {
          setToken('');
          setSummary(null);
        }
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, [request, classroomId, hours]);
  useEffect(() => {
    if (!token) return;
    // Refresh updates state only after asynchronous network results arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = auto ? setInterval(refresh, 15000) : null;
    return () => {
      clearInterval(timer);
      generation.current += 1;
    };
  }, [token, refresh, auto]);

  const act = async (action) => {
    setActionBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };
  const create = (event) => {
    event.preventDefault();
    void act(async () => {
      const room = await request('/api/v1/monitoring/classrooms', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle }),
      });
      setSummary(null);
      setClassroomId(room.id);
      setShowCreate(false);
      setNewTitle('');
    });
  };
  const showcase = () =>
    act(async () => {
      const room = await request('/api/v1/monitoring/showcase', {
        method: 'POST',
      });
      setSummary(null);
      setClassroomId(room.id);
    });
  const exportReport = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { report: 'CounterLens classroom demo', ...summary },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `counterlens-${classroomId}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const classroomLink = new URL(
    import.meta.env.BASE_URL,
    window.location.origin,
  );
  classroomLink.searchParams.set('class', classroomId);
  const visible = (section) => tab === 'overview' || tab === section;
  const events = summary?.events.counts || [];
  const pageViews = events.find((row) => row.name === 'page_view')?.count || 0;
  const flips =
    events.find((row) => row.name === 'counterfactual_flipped')?.count || 0;
  const fresh =
    summary &&
    !error &&
    summary.classroom.id === classroomId &&
    summary.windowHours === Number(hours);
  const quality = summary?.dataset;
  const metrics = summary?.service;
  const section = SECTIONS[tab];
  const selectSection = (id) => {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set('section', id);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <a className="console-brand" href={import.meta.env.BASE_URL}>
          <span>
            <Telescope size={25} />
          </span>
          <div>
            CounterLens<small>CLASSROOM CONSOLE</small>
          </div>
        </a>
        <div className="console-nav-label">WORKSPACE</div>
        <nav aria-label="Console sections">
          {[
            ['overview', LayoutDashboard, 'Overview'],
            ['classroom', ClipboardList, 'Classroom & surveys'],
            ['system', Activity, 'System health'],
            ['data', Database, 'Dataset release'],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => selectSection(id)}
            >
              {createElement(icon, { size: 18 })}
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="console-sidebar-note">
          <FlaskConical size={23} />
          <strong>Built for exploration</strong>
          <p>
            A local demo workspace for teaching signals, questionnaire feedback,
            and service health.
          </p>
          <span>MongoDB · Fastify · React</span>
        </div>
        <a className="console-return" href={classroomLink.href}>
          Open classroom <ArrowUpRight size={16} />
        </a>
      </aside>
      <main className="console-main">
        <header className="console-topbar">
          <div className="console-breadcrumb">
            Workspace <span>/</span>{' '}
            {section.label}
          </div>
          <div className="console-top-actions">
            <span className="console-local-tag">LOCAL DEMO</span>
            {token && (
              <button
                aria-label="Lock console"
                title="Lock console"
                onClick={() => {
                  generation.current += 1;
                  setToken('');
                  setDraftToken('');
                  setSummary(null);
                  setError('');
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>
        <div className="console-content">
          <div className="console-page-heading">
            <div>
              <div className="console-eyebrow">
                OBSERVE · UNDERSTAND · REFINE
              </div>
              <h1>{section.heading}</h1>
              <p>{section.description}</p>
            </div>
            <span className={`console-live ${fresh ? 'healthy' : ''}`}>
              <i />
              {fresh
                ? 'Connected to MongoDB'
                : token
                  ? 'Waiting for fresh data'
                  : 'Console locked'}
            </span>
          </div>
          {!token && (
            <section className="console-login console-panel">
              <div>
                <Radio size={32} />
                <h2>Connect to view {section.label.toLowerCase()}</h2>
                <p>
                  Connect once to open all four sections. The console token protects classroom answers and operational data.
                </p>
              </div>
              {error && <p className="console-alert" role="alert">{error} Enter your configured console token below.</p>}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setToken(draftToken);
                }}
              >
                <label>
                  Console token
                  <input
                    autoComplete="off"
                    type="password"
                    required
                    value={draftToken}
                    onChange={(event) => setDraftToken(event.target.value)}
                  />
                </label>
                <button className="console-primary">Open console</button>
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    className="console-secondary"
                    onClick={() => {
                      setDraftToken('counterlens-local-demo');
                      setToken('counterlens-local-demo');
                    }}
                  >
                    Use local demo access
                  </button>
                )}
              </form>
              <small>
                Local demo access works with the default development
                configuration. Custom tokens are set in .env.
              </small>
            </section>
          )}
          {token && (
            <>
              <div className="console-toolbar">
                <label>
                  CLASSROOM
                  <select
                    value={classroomId}
                    onChange={(e) => {
                      setSummary(null);
                      setClassroomId(e.target.value);
                    }}
                  >
                    {!classrooms.some((c) => c._id === classroomId) && (
                      <option value={classroomId}>{classroomId}</option>
                    )}
                    {classrooms.map((room) => (
                      <option key={room._id} value={room._id}>
                        {room.synthetic ? '[SIMULATED] ' : ''}
                        {room.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  TIME WINDOW
                  <select
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  >
                    <option value="1">Last hour</option>
                    <option value="24">Last 24 hours</option>
                    <option value="72">Last 3 days</option>
                    <option value="168">Last 7 days</option>
                  </select>
                </label>
                <div className="console-toolbar-buttons">
                  <button
                    className="console-secondary"
                    onClick={() => setShowCreate(!showCreate)}
                  >
                    <Plus size={16} />
                    New classroom
                  </button>
                  <button
                    className="console-secondary"
                    disabled={actionBusy}
                    onClick={showcase}
                  >
                    <FlaskConical size={16} />
                    Generate showcase
                  </button>
                  <button
                    className="console-icon"
                    aria-label="Refresh dashboard"
                    disabled={busy}
                    onClick={refresh}
                  >
                    <RefreshCw size={18} className={busy ? 'spinning' : ''} />
                  </button>
                </div>
              </div>
              {showCreate && (
                <form className="console-create" onSubmit={create}>
                  <label>
                    Classroom title
                    <input
                      required
                      maxLength={100}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Friday ethics discussion"
                    />
                  </label>
                  <button className="console-primary" disabled={actionBusy}>
                    Create classroom
                  </button>
                </form>
              )}
              {error && (
                <div className="console-alert" role="alert">
                  {error}{' '}
                  {summary &&
                    'Displayed values are from the last successful refresh.'}
                  <button onClick={refresh}>Retry</button>
                </div>
              )}
              {!summary && !error && (
                <Empty>Loading the classroom workspace…</Empty>
              )}
              {summary && (
                <>
                  <div
                    className={`console-session-banner ${summary.classroom.synthetic ? 'simulated' : ''}`}
                  >
                    <div>
                      <strong>
                        {summary.classroom.synthetic
                          ? 'Simulated activity for presentation'
                          : summary.classroom.title}
                      </strong>
                      <span>
                        {summary.classroom.synthetic
                          ? 'All classroom events and answers in this session are generated examples. System metrics remain actual measurements.'
                          : `${classroomId} · ${summary.classroom.status === 'open' ? 'Collection open' : 'Collection closed'} · Sample questionnaire ${summary.classroom.questionnaire.version}`}
                      </span>
                    </div>
                    {!summary.classroom.synthetic && (
                      <div className="console-session-actions">
                        <a
                          href={classroomLink.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open student view <ArrowUpRight size={15} />
                        </a>
                        <button
                          disabled={actionBusy}
                          onClick={() =>
                            act(async () => {
                              await request(
                                `/api/v1/monitoring/classrooms/${classroomId}`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    status:
                                      summary.classroom.status === 'open'
                                        ? 'closed'
                                        : 'open',
                                  }),
                                },
                              );
                              await refresh();
                            })
                          }
                        >
                          {summary.classroom.status === 'open'
                            ? 'Close collection'
                            : 'Reopen collection'}
                        </button>
                      </div>
                    )}
                  </div>
                  {visible('classroom') && (
                    <>
                      <div className="console-kpis">
                        {[
                          [
                            'Page views',
                            number(pageViews),
                            'Reloads count; not unique people',
                            Radio,
                            'blue',
                          ],
                          [
                            'Learning events',
                            number(summary.events.total),
                            'Across this classroom session',
                            Activity,
                            'purple',
                          ],
                          [
                            'Questionnaires',
                            number(summary.surveys.count),
                            'Submitted answer sets',
                            ClipboardList,
                            'green',
                          ],
                          [
                            'Decision flips',
                            number(flips),
                            'Counterfactual explorations',
                            FlaskConical,
                            'amber',
                          ],
                        ].map(([label, value, note, icon, color]) => (
                          <article className="console-kpi" key={label}>
                            <div>
                              <span>{label}</span>
                              <i className={color}>
                                {createElement(icon, { size: 19 })}
                              </i>
                            </div>
                            <strong>{value}</strong>
                            <p>{note}</p>
                          </article>
                        ))}
                      </div>
                      <div className="console-grid">
                        <Panel
                          title="Classroom activity"
                          note="Event volume by hour · UTC"
                        >
                          <div className="console-chart">
                            {summary.hourlyTraffic.length ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={summary.hourlyTraffic}>
                                  <defs>
                                    <linearGradient
                                      id="activityFill"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="#5268d7"
                                        stopOpacity={0.28}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#5268d7"
                                        stopOpacity={0.01}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    vertical={false}
                                    stroke="#e7ebf3"
                                  />
                                  <XAxis
                                    dataKey="hour"
                                    tickFormatter={(v) =>
                                      `${v.slice(11, 13)}:00`
                                    }
                                    tick={{ fill: '#52627a', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    allowDecimals={false}
                                    width={35}
                                    tick={{ fill: '#52627a', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <Tooltip />
                                  <Area
                                    dataKey="events"
                                    type="monotone"
                                    stroke="#5268d7"
                                    fill="url(#activityFill)"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    isAnimationActive={false}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            ) : (
                              <Empty />
                            )}
                          </div>
                        </Panel>
                        <Panel
                          title="What students explored"
                          note="Interaction counts, not a learning-outcome score"
                        >
                          <Distribution rows={events} />
                        </Panel>
                      </div>
                      <div className="console-grid">
                        <Panel
                          title="Questionnaire · policy to discuss"
                          note="Example exit ticket · demo-v1"
                        >
                          <Distribution
                            rows={summary.surveys.choices}
                            color="#218465"
                          />
                        </Panel>
                        <Panel
                          title="Self-reported confidence"
                          note="1 = not yet confident · 5 = very confident"
                        >
                          <div className="console-chart short">
                            {summary.surveys.count ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={[1, 2, 3, 4, 5].map((v) => ({
                                    score: String(v),
                                    responses:
                                      summary.surveys.confidence.find(
                                        (r) => r.name === String(v),
                                      )?.count || 0,
                                  }))}
                                >
                                  <CartesianGrid
                                    vertical={false}
                                    stroke="#e7ebf3"
                                  />
                                  <XAxis
                                    dataKey="score"
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    allowDecimals={false}
                                    width={25}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <Tooltip />
                                  <Bar
                                    dataKey="responses"
                                    fill="#9273ce"
                                    radius={[5, 5, 0, 0]}
                                    maxBarSize={42}
                                    isAnimationActive={false}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <Empty>
                                Submit a questionnaire from the student view.
                              </Empty>
                            )}
                          </div>
                        </Panel>
                      </div>
                      <div className="console-grid">
                        <Panel
                          title="Submitted reflections"
                          note="Latest 12 submissions in the selected window · only explicitly submitted text"
                        >
                          <div className="console-reflections">
                            {summary.surveys.recent.length ? (
                              summary.surveys.recent.map((r, i) => (
                                <article key={i}>
                                  <div>
                                    <span>
                                      {r.synthetic
                                        ? 'SIMULATED RESPONSE'
                                        : 'SUBMITTED RESPONSE'}
                                    </span>
                                    <time>{time(r.recordedAt)}</time>
                                  </div>
                                  <p>
                                    {r.answers.reflection ||
                                      'No optional reflection provided.'}
                                  </p>
                                </article>
                              ))
                            ) : (
                              <Empty>No answers submitted yet.</Empty>
                            )}
                          </div>
                        </Panel>
                        <Panel
                          title="Recent activity"
                          note="Latest 8 events · no student identifiers"
                        >
                          <div className="console-timeline">
                            {summary.events.recent.length ? (
                              summary.events.recent.map((e, i) => (
                                <div key={i}>
                                  <i />
                                  <div>
                                    <strong>{title(e.name)}</strong>
                                    <span>{title(e.policyId)}</span>
                                  </div>
                                  <time>{time(e.recordedAt)}</time>
                                </div>
                              ))
                            ) : (
                              <Empty />
                            )}
                          </div>
                        </Panel>
                      </div>
                    </>
                  )}
                  {visible('system') && (
                    <>
                      <div className="console-section-label">
                        <Server size={18} />
                        SYSTEM HEALTH{' '}
                        <span>
                          Actual API measurements · all classrooms · selected
                          time window
                        </span>
                      </div>
                      <div className="console-health">
                        <article>
                          <span>API service</span>
                          <strong className={fresh ? 'ok' : 'warn'}>
                            {fresh ? 'Operational' : 'Not verified'}
                          </strong>
                          <small>
                            Uptime {Math.floor(summary.uptimeSeconds / 60)} min
                            · RSS {summary.memoryMb} MB
                          </small>
                        </article>
                        <article>
                          <span>MongoDB</span>
                          <strong className={fresh ? 'ok' : 'warn'}>
                            {fresh ? 'Connected' : 'Not verified'}
                          </strong>
                          <small>
                            Last ping {summary.database.latencyMs} ms
                          </small>
                        </article>
                        <article>
                          <span>API requests</span>
                          <strong>{number(metrics.requests)}</strong>
                          <small>
                            Excludes console polling & health checks
                          </small>
                        </article>
                        <article>
                          <span>Response time</span>
                          <strong>
                            {metrics.averageDurationMs}
                            <em> ms</em>
                          </strong>
                          <small>Approx. P95 {metrics.p95DurationMs} ms</small>
                        </article>
                        <article>
                          <span>Server errors</span>
                          <strong
                            className={metrics.serverErrors ? 'warn' : ''}
                          >
                            {metrics.serverErrorRate}
                            <em>%</em>
                          </strong>
                          <small>
                            {metrics.serverErrors} server errors ·{' '}
                            {metrics.clientErrors} client errors
                          </small>
                        </article>
                      </div>
                      <Panel
                        title="API performance"
                        note="Requests handled by this local backend"
                      >
                        <div className="console-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Endpoint</th>
                                <th>Requests</th>
                                <th>4xx / 5xx</th>
                                <th>Average</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.routes.map((r) => (
                                <tr key={r.method + r.route}>
                                  <td>
                                    <span className="console-method">
                                      {r.method}
                                    </span>
                                    {r.route}
                                  </td>
                                  <td>{r.requests}</td>
                                  <td>{r.errors}</td>
                                  <td>{r.averageDurationMs} ms</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!summary.routes.length && <Empty />}
                        </div>
                      </Panel>
                    </>
                  )}
                  {visible('data') && quality && (
                    <Panel
                      title="Dataset release"
                      note={`${quality.datasetId} · ${quality.datasetVersion}`}
                    >
                      <div className="console-data-top">
                        <div>
                          <Database size={27} />
                          <strong>{quality.recordCount} records</strong>
                          <span>
                            {quality.featureCount} features ·{' '}
                            {quality.sourceType}
                          </span>
                        </div>
                        <span className="console-data-badge">
                          <CheckCircle2 size={16} />
                          {quality.status === 'valid'
                            ? 'Schema checks passed'
                            : 'Review needed'}
                        </span>
                      </div>
                      <div className="console-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Feature</th>
                              <th>Missing values</th>
                              <th>Out of range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(quality.missingValues).map((key) => (
                              <tr key={key}>
                                <td>{key}</td>
                                <td>{quality.missingValues[key]}</td>
                                <td>{quality.outOfRangeValues[key]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="console-footnote">
                        These checks describe data structure and ranges; they do
                        not establish fairness or de-identification.
                      </p>
                    </Panel>
                  )}
                  <footer className="console-footer">
                    <div>
                      <label>
                        <input
                          type="checkbox"
                          checked={auto}
                          onChange={(e) => setAuto(e.target.checked)}
                        />{' '}
                        Refresh every 15 seconds
                      </label>
                      <span>
                        Updated {time(summary.generatedAt)} ·{' '}
                        {summary.retentionDays}-day retention
                      </span>
                    </div>
                    <button
                      className="console-secondary"
                      onClick={exportReport}
                      disabled={!fresh}
                    >
                      <Download size={16} />
                      Export snapshot
                    </button>
                  </footer>
                  <p className="console-privacy">
                    No IP addresses, student record IDs, or persistent visitor
                    identifiers are stored by this application. Submitted
                    questionnaires include the answers the respondent chose to
                    send. This demo does not measure unique participants or
                    learning gains.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
