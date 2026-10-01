# Bridge Health Monitor

Bridge Health Monitor is a full-stack demo for exploring how bridge readings, project thresholds, inspections, and maintenance assignments fit together. It has a 58-bridge catalog and generates sensor telemetry from a bundled dataset and in-process simulators. The readings are not connected to physical sensors.

## What you can do

- **Monitor and plan:** Review simulated readings, health scores, alerts, and history. The predictive maintenance page estimates degradation and compares repair timing against the same simulated failure boundary.
- **Inspect and report:** Compare a selected bridge's readings with shared project thresholds, generate an inspection report, and export PDFs. Photo assessment reports model-estimated visual findings separately from any calibrated width supplied by the user.
- **Coordinate work:** Admins can create assignments for engineers; engineers can progress their own assignments. The Bridge Assistant shows the causes of network alerts and opens an inspection or a prefilled assignment form for review. Dispatch requires a separate admin confirmation.
- **Review access:** The admin page shows accounts, recorded audit events, and metrics where the backend has enough data to calculate them.

Generated inspection prose, photo assessment, and some chat responses require a configured external model provider. Simulated monitoring, threshold checks, and forecast calculations do not.

## Stack and architecture

The frontend uses React 19, Vite 8, Tailwind CSS 4, Recharts, Leaflet, and Lucide icons. The backend uses FastAPI, Pydantic, NumPy, pandas, scikit-learn, and XGBoost; ReportLab creates PDFs. Groq is used for the main report, chat, and photo-model requests when configured. Telegram messaging and an Anthropic-backed legacy endpoint are optional integrations.

The React app calls the FastAPI `/api` routes. The backend reads bundled CSV data, maintains bridge simulators in process, and applies the shared condition and sensor thresholds in `backend/constants.py`. Maintenance assignments are also stored in process; session and audit records use local files. This is a demo architecture, not a durable multi-server deployment.

## Run locally

Python 3.13 was used to verify this checkout. The locked Vite version requires Node.js 20.19+ or 22.12+.

From the repository root, start the backend:

```sh
python -m venv .venv
```

Activate it with `.\.venv\Scripts\Activate.ps1` in PowerShell or `source .venv/bin/activate` in bash/zsh, then run:

```sh
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

In a second shell, start the frontend:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`; API documentation is at `http://localhost:8000/docs`. The frontend defaults to that backend URL. The backend seeds demo accounts for the admin, engineer, and viewer roles in `backend/main.py`; these accounts are for local evaluation, not production authentication.

No environment variables are needed for the simulated monitoring views. Set these when enabling an integration or changing the default addresses, using your own values:

```text
GROQ_API_KEY=<groq-api-key>                         # Generated reports, photo analysis, model chat
BRIDGEIQ_INTERNAL_API_BASE_URL=<backend-origin>   # Internal report/chat requests if not on localhost:8000
TELEGRAM_BOT_TOKEN=<telegram-bot-token>           # Optional dispatch
TELEGRAM_CHAT_ID=<telegram-chat-id>               # Optional dispatch recipient
TELEGRAM_RECIPIENT_NAME=<recipient-label>         # Optional display name for that recipient
ANTHROPIC_API_KEY=<anthropic-api-key>             # Optional legacy /api/rag/chat endpoint
VITE_API_URL=<backend-origin>                     # Frontend build when the backend is not localhost:8000
```

Set backend variables in the backend process environment; set `VITE_API_URL` when starting or building the frontend. Do not commit credentials. The Bridge Assistant's manual dispatch requires admin review and confirmation. Separately, a legacy live-reading hook can send automatic Telegram alerts from simulated readings when Telegram credentials are set; leave them unset unless that behavior is intended.

## Roles and workflow

An admin or engineer selects a bridge and runs an inspection against the current simulated readings. The report can be reviewed on screen or exported as a PDF. An admin can then create an assignment for a valid bridge and engineer, with a task, priority, description, and due date. Engineers see their own assignments and can move them from pending to in progress to completed; admins can also cancel or delete assignments. Viewers can read assignment and bridge information but cannot create or change assignments, run inspections or photo analysis, or dispatch messages. The backend enforces these permissions independently of the UI.

## Tests

Run these from the repository root unless noted:

```sh
python -m unittest discover -s backend -p 'test_*.py'
python -m pip install pytest                     # additional test dependency
python -m pytest backend/test_agent_pdf.py -q
cd frontend
node --test src/components/chatPanelUtils.test.js src/pages/adminPanelUtils.test.js
npm run build
npm run lint
```

The full frontend lint command currently reports errors; it is listed so the current diagnostics are visible rather than hidden.

## Deployment

The URLs already listed in this repository returned HTTP 200 when checked on 2026-10-01: [hosted frontend](https://brideg-health-monitor-145g.vercel.app) and [backend API documentation](https://brideg-health-monitor.onrender.com/docs). Availability does not establish that every feature is configured there. There are no Vercel or Render deployment manifests in this repository.

## Current limitations

- Telemetry and traffic are simulated. Forecasts and repair scenarios are estimates, not field measurements or guarantees.
- Sensor limits are project thresholds, not verified code-compliance limits. This demo is not a certified structural assessment system.
- Photo findings are model estimates; model performance has not been independently validated. Physical dimensions cannot be inferred from an uncalibrated image. A width can be supplied from a calibrated field measurement.
- Generated reports, photo analysis, and model chat depend on external services and may be unavailable without credentials or provider access.
- Assignments are lost when the backend process restarts. Local session and audit files are not a substitute for a production database.
- The India network endpoint currently fails in this checkout because it expects a `crossings` field that the traffic monitor does not provide; the map's network data needs repair.

## Repository structure

```text
backend/     FastAPI routes, simulators, thresholds, forecasts, inspections, reports, and tests
frontend/    React app, pages, components, and frontend tests
data/        Bundled sensor and model-output datasets used by the demo
plots/       Analysis plots produced for the project
scratch/     Development scripts and experiments
```
