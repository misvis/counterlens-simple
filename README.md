# CounterLens Simplified

A classroom AI ethics prototype with a React interface, a small Fastify API, and a local MongoDB database. The current priority is a working local demo and presentation workflow.

The public [GitHub Pages demo](https://misvis.github.io/counterlens-simple/) remains independently deployable. It cannot run the API or database.

## Student workspace

- **Policy Studio** selects the scoring rule; **Admission Threshold** changes its cutoff for all students.
- **Counterfactual Visualizer** shows GPA/SAT outcomes and a live decision boundary. Context-sensitive policies use a band across background combinations; selecting a student shows the exact slice for that background. No PCA projection is used.
- **Counterfactual Editor** changes a hypothetical profile without changing the cohort. Gold highlights identify nearby edge cases; purple identifies counterfactual edits. **Group Outcomes** compares cohort admission rates.

Light, Graphite, and Summer themes and English, Chinese, and Spanish are available. The public build works without an API; collecting events or questionnaire answers requires a separately running backend.

## Run locally

Requirements: Node.js 20.19+ and MongoDB 7+ (the console uses MongoDB's approximate percentile aggregation). Start MongoDB on `127.0.0.1:27017`, then:

```powershell
npm install
npm run dev
```

No `.env` is needed with the local defaults. The API connects to the dedicated `counterlens_demo` database and seeds the 72-record synthetic release, example questionnaire, and `local-demo` classroom without replacing existing data.

- Student page: http://localhost:5173/
- Classroom console: http://localhost:5173/?view=console
- API liveness: http://127.0.0.1:8787/healthz
- API/database readiness: http://127.0.0.1:8787/readyz
- http://127.0.0.1:8787/monitoring redirects to the console.

The local development console automatically tries demo access for a loopback API. If a custom token is configured, it returns to the connection form. Development uses the public convenience token `counterlens-local-demo` when no token is configured. The API binds to loopback by default. Set a private `MONITORING_TOKEN` before exposing it to other machines. Production does not supply a default token or enable showcase generation. Tokens remain in page memory, not browser storage.

For another laptop, see [the demo handoff guide](docs/LAPTOP_DEMO.md). Copying the source does not copy MongoDB data; generate a new showcase on that machine.

## Five-minute demonstration

1. Open the console and select **Generate showcase** to create a separate, labeled session with simulated events and 24 simulated answers. Service measurements are still real.
2. Select **New classroom** and enter a title for a fresh session.
3. Use **Open student view**. The link's `class` parameter assigns events and answers to that classroom.
4. Compare policies and inspect a student. Open **Check-in**, answer the questions, agree to submission, and submit.
5. Return to the console and refresh. Inspect activity, question distributions, and submitted text. Close collection when finished.
6. Use **Export snapshot** for a JSON report of the displayed window (includes up to 12 recent answers, not a full research-data export).

The console supports Overview, Classroom & surveys, System health, and Dataset release views; automatic refresh is optional. An unavailable API/database produces an error and marks previous values as unverified. Counts are event/submission counts, not unique-person counts, completion rates, or learning outcomes.

## Questionnaire framework

`shared/questionnaire.js` defines a versioned example exit ticket with choice, integer scale, and optional text questions. Student rendering and server answer validation use the definition stored for that classroom. English, Chinese, and Spanish labels are supported.

When changing questions, increment the questionnaire version and create a new classroom. Existing classrooms remain tied to their original version. The dashboard's policy and confidence charts currently illustrate the example questions; adding different research questions also requires adapting these charts. A form-builder UI, participant identities, longitudinal linking, and pre/post experiment design are intentionally deferred.

Answers are saved only on explicit submission. A random submission ID prevents retries of the same request from adding another response. It is not a participant identifier and does not stop one person from submitting again after reloading. The standalone **Discuss / Your reflection** panels have been removed from the student workspace; the optional **Check-in** questionnaire remains available when an API is configured.

## MongoDB collections

| Collection | Purpose |
| --- | --- |
| `dataset_releases` | Versioned classroom metadata, policies, and public-release status |
| `classroom_records` | One approved classroom record per document |
| `questionnaires` | Versioned question definitions |
| `classrooms` | Classroom title, collection state, dataset and questionnaire versions |
| `events` | Allow-listed interactions, assigned to a classroom |
| `responses` | Explicitly submitted questionnaire answers and version context |
| `request_metrics` | Route templates, status codes, and duration; no request bodies |

Events, responses, and request metrics receive an `expiresAt` timestamp and TTL index (30 days by default, set at insertion). TTL deletion is asynchronous; console queries also exclude expired records. Dataset releases and definitions are retained. Old SQLite files in `server/.data/` are untouched and are not automatically imported into MongoDB.

## Configuration

Copy `.env.example` to `.env` only when overriding defaults. Never commit `.env` or database dumps.

| Variable | Local default | Purpose |
| --- | --- | --- |
| `HOST` / `PORT` | `127.0.0.1` / `8787` | API listener |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Server-only database connection |
| `MONGODB_DB` | `counterlens_demo` | Application database |
| `MONITORING_TOKEN` | `counterlens-local-demo` in development | Console access |
| `MONITORING_RETENTION_DAYS` | `30` | Retention for new events, answers, and metrics |
| `CONSOLE_URL` | `http://localhost:5173/?view=console` | Console redirect |
| `ALLOWED_ORIGINS` | Local Vite and `https://misvis.github.io` | Browser origins |
| `VITE_API_BASE_URL` | Set by `npm run dev` | Browser API endpoint, never the MongoDB URI |
| `VITE_DATASET_ID` | `admissions-demo` | Classroom dataset |

`npm run dev:web` runs only the static frontend, with bundled synthetic data and no answer/event submission unless an API URL is configured. `npm run deploy` still publishes the static build to GitHub Pages. The current local platform changes require a separately running API to collect anything.

## API overview

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /healthz` | Process liveness | Public |
| `GET /readyz` | Live MongoDB ping | Public |
| `GET /api/v1/classroom-view/:datasetId` | Public-approved release, optionally pinned by classroom | Public |
| `GET /api/v1/classrooms/:id` | Classroom state and questionnaire | Public |
| `POST /api/v1/events` | Strictly allow-listed events | Public, rate limited |
| `POST /api/v1/responses` | Validated questionnaire answers | Public, rate limited |
| `GET/POST /api/v1/monitoring/classrooms` | List/create classrooms | Console token |
| `PATCH /api/v1/monitoring/classrooms/:id` | Open/close collection | Console token |
| `POST /api/v1/monitoring/showcase` | Generate labeled presentation examples | Console token, development only |
| `GET /api/v1/monitoring/summary` | Session results and system health | Console token |

The session selector filters classroom events and answers. Operational metrics cover all classrooms in the selected time window and exclude console polling, health probes, and CORS preflights. P95 response time is an approximate server-side metric.

## Data boundary

The application does not store IP addresses, user agents, student record IDs in analytics, or persistent visitor identifiers. It **does** store explicitly submitted questionnaire answers, including optional text. Free text can contain identifying information if someone enters it; the form asks respondents not to do so. Operational request metrics never store answers. External web servers may have separate logs.

All data sent to a public browser can be downloaded. Public-release flags and schema checks do not establish anonymity. Source files and linkage keys stay outside this public repository. See [the release checklist](docs/DATA_RELEASE_CHECKLIST.md) before using institutional data. Question wording, recruitment, consent, and evaluation measures remain demo placeholders pending research design.

## Verification

```powershell
npm run check
```

Runs ESLint, integration tests against the local MongoDB service, admission-boundary math tests, and a production build. Integration tests create a fresh `counterlens_test_<random-id>` database and remove only that test database. They exercise answer validation, authentication, retry deduplication, session isolation, closed collection, simulated-data separation, retention filtering, persistence after restart, rate limiting, and readiness failure. Math tests check boundary equality across policies, backgrounds, and thresholds, including off-chart and degenerate cases.

## License

Creative Commons Attribution-NonCommercial 4.0 International. See [LICENSE](LICENSE).
