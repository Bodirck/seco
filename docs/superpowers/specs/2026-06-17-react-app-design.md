# BuildingLens React app: design

Built on the `feature/react-app` branch. The Streamlit app on `main` stays as the working MVP; this is the polished, ergonomic web version. Merge only when solid.

## Goal

A sober, explained, bilingual (EN default, FR) web app over the existing BuildingLens Python core. RAG search is the landing page. A BI view per building (KPIs and charts). Client report export (Excel and PDF). Abundant documentation. Built with a multi-agent fleet on a frozen API contract.

## Architecture

```
web/  (Vite + React + TypeScript + Tailwind)  --HTTP/JSON-->  api/  (FastAPI)  -->  src/buildinglens/ (reused)
                                                                                      db . scoring . rag . extract . reports(NEW)
```

The Python core is unchanged and reused. `api/` is a thin JSON layer. `web/` is a single-page app. No logic is duplicated in the frontend.

## API contract (frozen; backend and frontend both conform)

- `GET /api/meta` -> `{ provider: "anthropic"|"openai"|"mistral"|"local"|"mock", buildings: int, documents: int, defects: int }`
- `GET /api/buildings` -> `{ buildings: [ { id, name, address, risk_score, latitude, longitude, height_m, source, critical, major, minor } ] }` (sorted by risk_score desc)
- `GET /api/buildings/{id}` -> `{ id, name, address, year_built, height_m, latitude, longitude, source, risk_score, breakdown: { critical, major, minor, total }, kpis: { by_discipline: [ { discipline, count } ], by_severity: { critical, major, minor } }, defects: [ { discipline, element, description, location, severity, citation } ] }`
- `POST /api/ask` body `{ question: string, building_id?: int }` -> `{ answer: string, sources: [ { document_id, building_id, snippet } ] }`
- `GET /api/buildings/{id}/report?format=xlsx|pdf` -> binary file download (Content-Disposition attachment)

CORS allows the Vite dev origin. Errors return `{ detail }` with a proper HTTP status.

## Backend (`api/`)

- `api/main.py`: FastAPI app, CORS, include routers, `/api/meta`.
- `api/routers/buildings.py`: list, detail (uses `scoring.building_risk_breakdown`, queries defects, computes KPIs).
- `api/routers/ask.py`: RAG via `rag.answer`.
- `api/routers/reports.py`: streams the xlsx/pdf from `buildinglens.reports`.
- `api/deps.py`: a per-request SQLite connection.

## Reports (`src/buildinglens/reports.py`, reused by the API)

- `build_excel_report(conn, building_id) -> bytes` (openpyxl): cover (building, risk, KPIs) + defects sheet by discipline.
- `build_pdf_report(conn, building_id) -> bytes` (reportlab): executive summary written by the LLM (grounded in the building's defects), risk and KPIs, defect tables, sources.
- `executive_summary(conn, building_id, client=None) -> str`: short LLM summary; falls back to a templated summary in mock mode.

## Frontend (`web/`)

Pages (React Router):
- `/` Search (RAG, landing): prominent search box, clickable example queries, answer with cited sources, a short "how it works" note.
- `/portfolio` Portfolio: buildings table ranked by risk, map, global KPIs.
- `/building/:id` Building (BI): KPI cards, charts (defects by discipline bar, severity donut, risk gauge), filterable defect table, Download report (Excel / PDF) buttons.

Cross-cutting:
- i18n with react-i18next, English default, French toggle. All copy in `web/src/i18n/{en,fr}.json`.
- Sober design: neutral palette, clean typography, Tailwind, generous explanatory copy, helpful empty states, KPI tooltips.
- `web/src/api/client.ts` typed client; `web/src/api/types.ts` mirrors the contract above.
- Charts: a lightweight library (Recharts).
- Vite dev server proxies `/api` to the FastAPI backend.

## Documentation

README (bilingual) updated with the new architecture and run commands; `docs/architecture.md`, `docs/api.md`, `web/README.md`, `api/README.md`; docstrings throughout.

## Run commands

- Backend: `python -m uvicorn api.main:app --port 8000` (run `make data` and `make extract` first).
- Frontend: `cd web && npm install && npm run dev` (Vite on 5173, proxy to 8000).
- Convenience: `make api`, `make web`.

## Build plan (multi-agent)

- Phase 0 (solo, sequential): write this spec; build the FastAPI backend and `reports.py`; scaffold the Vite app foundation (configs, i18n, typed api client, layout/theme); `npm install`; freeze the contract above.
- Phase 1 (parallel fleet, distinct files): Search page, Portfolio page, Building/BI page, i18n strings, docs.
- Phase 2 (solo): integrate, `npm run build`, run backend and frontend, smoke test, fix, commit.

## Out of scope

Auth, persistence beyond SQLite, deployment. Real per-building inspection data (synthetic, as documented on main).
