# BuildingLens API

Thin FastAPI server that exposes the buildinglens Python core over HTTP for the React front-end.

## Prerequisites

1. Python 3.11 and the project dependencies installed:

   ```bash
   make install
   ```

2. The database populated with buildings and defects:

   ```bash
   make data     # download public data and generate synthetic reports
   make extract  # extract defects, score buildings, build RAG index
   ```

   `make extract` needs an API key in `.env` (copy `.env.example` and fill in `ANTHROPIC_API_KEY`). Without a key the command runs in mock mode: buildings and documents are present but no defects are extracted. The API still starts correctly and all endpoints respond; the RAG endpoint returns placeholder answers.

## Running the server

```bash
python -m uvicorn api.main:app --port 8000
```

The server listens on `http://localhost:8000`. The React dev server (port 5173) proxies `/api/*` to this address.

For auto-reload during development:

```bash
python -m uvicorn api.main:app --port 8000 --reload
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/meta` | LLM provider name and database row counts. |
| GET | `/api/buildings` | All buildings with risk scores and defect counts, sorted by risk score descending. |
| GET | `/api/buildings/{id}` | Full detail for one building: metadata, risk breakdown, KPI aggregates, defect list. Returns 404 if not found. |
| POST | `/api/ask` | RAG question-answer: retrieves relevant report chunks and returns an LLM-generated answer with cited sources. |
| GET | `/api/buildings/{id}/report` | Download a per-building report. Query parameter `format=pdf` (default) or `format=xlsx`. Returns 404 if not found. |

For full request and response shapes see `docs/api.md`.

## Project layout

```
api/
  __init__.py
  main.py       # FastAPI app, CORS middleware, /api/meta route
  deps.py       # get_conn: per-request SQLite connection dependency
  routers/
    __init__.py
    buildings.py  # GET /api/buildings, GET /api/buildings/{id}
    ask.py        # POST /api/ask
    reports.py    # GET /api/buildings/{id}/report
    settings.py   # GET/PUT /api/settings, POST /api/settings/test
```

## CORS

The server accepts requests from `http://localhost:5173` and `http://127.0.0.1:5173` (the Vite dev server). For a production deployment update the `allow_origins` list in `api/main.py` or place a reverse proxy in front.

## Environment variables

Controlled by the `buildinglens` core through a plain frozen `Settings` dataclass loaded from `.env` with `python-dotenv`, plus a SQLite `app_settings` overlay that holds any runtime changes made through the settings API. Copy `.env.example` to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...   # or OPENAI_API_KEY depending on provider
DB_PATH=data/buildinglens.db   # default, usually no need to change
```

All `.env` files are git-ignored.

## Runtime settings

The LLM provider, models and API keys can be changed at runtime from the UI, with no server restart. Updates are persisted in the SQLite `app_settings` table and re-applied on startup, so they survive a restart. The raw API key is never returned: endpoints only report whether a key is set (`has_key`) and its last four characters (`key_tail`).

| Method | Path | Description |
|---|---|---|
| GET | `/api/settings` | Current provider, models, key presence/tail, and the actually active client (`effective`, which reveals a silent mock fallback). |
| PUT | `/api/settings` | Apply and persist overrides; returns the recomputed settings object. An empty-string key means "leave unchanged". |
| POST | `/api/settings/test` | Run a real liveness check against the chosen (or current) provider; returns `{ ok, provider, effective, message }` with any key scrubbed from the message. |
