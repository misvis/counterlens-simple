# CounterLens Simplified

CounterLens Simplified is a one-page AI ethics teaching prototype. It lets students compare admission policies, inspect group admission rates, find borderline cases, and run simple counterfactual checks.

**Live classroom demo:** [https://misvis.github.io/counterlens-simple/](https://misvis.github.io/counterlens-simple/)

The repository now contains two independently deployable parts:

- `src/`: the React/Vite classroom interface hosted on GitHub Pages.
- `server/`: a small Fastify API intended for a UMBC-managed server.

## Privacy boundary

The public API serves only a **classroom view** of a dataset. A release is rejected at startup unless it explicitly declares both:

- `containsDirectIdentifiers: false`
- `approvedForPublicDisplay: true`

This is a technical guardrail, not a substitute for PI, IRB, data-provider, FERPA, or data-use-agreement review. Research authorization does not automatically authorize row-level public release.

The monitoring system deliberately does **not** store:

- IP addresses or user agents
- student record IDs or feature values
- reflection text
- cookies, persistent session IDs, or unique-person identifiers

Consequently, its page-view and event counts are useful operational signals, not audited counts of unique people.

See [docs/DATA_RELEASE_CHECKLIST.md](docs/DATA_RELEASE_CHECKLIST.md) before adding any approved real-world dataset.

## Local development

Requirements: Node.js 20 or newer.

```powershell
npm install
Copy-Item .env.example .env
```

Replace `MONITORING_TOKEN` in `.env` with a long random value, then start the frontend and API together:

```powershell
npm run dev
```

- Classroom interface: `http://localhost:5173/`
- API health: `http://127.0.0.1:8787/healthz`
- Monitoring dashboard: `http://127.0.0.1:8787/monitoring`

Enter the `MONITORING_TOKEN` from `.env` in the dashboard. The token stays in page memory and is not saved in browser storage.

To run only the static frontend with its bundled synthetic dataset:

```powershell
npm run dev:web
```

## Checks

```powershell
npm run check
```

This runs ESLint, the backend contract/privacy tests, and the production frontend build.

## Minimal API

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /healthz` | Service health | Public |
| `GET /api/v1/classroom-view/:datasetId` | Versioned, public-approved classroom data | Public, rate limited |
| `POST /api/v1/events` | Allow-listed anonymous teaching events | Public, validated and rate limited |
| `GET /monitoring` | Monitoring interface shell | Public, contains no monitoring data |
| `GET /api/v1/monitoring/summary` | Aggregated operations, events, and data quality | Bearer token required |

The current dataset identifier is `admissions-demo`. The API contract includes a schema version, dataset version, feature metadata, policy definitions, privacy status, and records.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | API bind address |
| `PORT` | `8787` | API port |
| `ALLOWED_ORIGINS` | local Vite + `https://misvis.github.io` | Comma-separated browser origins |
| `MONITORING_TOKEN` | empty | Enables protected monitoring summaries |
| `MONITORING_DB_PATH` | `server/.data/monitoring.sqlite` | Local aggregate/event store |
| `MONITORING_RETENTION_DAYS` | `30` | Automatic monitoring retention |
| `VITE_API_BASE_URL` | empty in production builds | Public API base URL embedded into the frontend |
| `VITE_DATASET_ID` | `admissions-demo` | Classroom dataset requested by the frontend |

When `VITE_API_BASE_URL` is absent, the frontend intentionally uses the bundled synthetic dataset and sends no analytics. If an API URL is configured but unavailable, the page displays a fallback warning instead of silently presenting the fallback as real data.

## Deployment boundary

The GitHub Pages command remains:

```powershell
npm run deploy
```

Without `VITE_API_BASE_URL`, this deploys the current self-contained synthetic demo. Once the UMBC API hostname exists, build the frontend with that HTTPS origin configured and add `https://misvis.github.io` to `ALLOWED_ORIGINS` on the server.

The API should run behind the UMBC server's HTTPS reverse proxy and process manager. Exact service and proxy files are intentionally deferred until the target UMBC environment is known.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International license. See [LICENSE](LICENSE).
