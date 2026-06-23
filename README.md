# BuildingLens

> From unstructured building inspection reports to an actionable, portfolio-wide risk view, with cited answers.

![Python 3.11](https://img.shields.io/badge/Python-3.11-blue) ![License: MIT](https://img.shields.io/badge/License-MIT-green) ![Runs offline](https://img.shields.io/badge/runs%20offline-no%20API%20key-success) ![UI](https://img.shields.io/badge/UI-Streamlit%20%2B%20React-orange)

**English** | [Français](docs/README.fr.md)

<!-- Demo video: on github.com, edit this README and drag buildinglens-demo-web.mp4 onto the
     line below. GitHub hosts the file and renders an inline player, keeping it out of the repo. -->
_A short screen capture walks through the product; a step-by-step plan is in [`docs/demo-script.md`](docs/demo-script.md)._

BuildingLens turns technical building inspection reports (unstructured PDFs) and public building data into an actionable risk view for an asset manager or a building insurer. It extracts defects from reports, scores each building's risk, and lets you query the whole stock in plain language with cited sources, on a reproducible demo corpus of 40 inspected buildings. It is reproducible from zero and runs offline in a mock mode with no API key.

## Quickstart

```bash
# 1. Install (Python backend + React deps)
make install
cd web && npm install && cd ..      # React deps, first time only

# 2. Build the demo data and the AI index
make data                           # EUBUCCO + STATEC + communes + synthetic PDFs -> SQLite
make extract                        # LLM defect extraction + risk scoring + RAG index

# 3. Run the app, then open http://localhost:5173
make web                            # FastAPI (:8000) + React (Vite, :5173) together
```

No API key? Copy `.env.example` to `.env` and set `LLM_PROVIDER=mock`: the whole pipeline, the app and the eval run offline (mock mode inserts no defects; add a key for real extraction). Streamlit is a lightweight backup UI (`make run`), and `make eval` scores extraction against the gold set. Full details under [Reproducibility](#reproducibility).

## What it does

- **Extract defects.** Each inspection PDF becomes a structured list of defects, each with element, location, severity (critical / major / minor) and a verbatim citation.
- **Score risk.** A building's defects roll up into a single 0 to 100 risk score with severity counts, so a whole stock ranks at a glance.
- **Ask in plain language.** A RAG Q&A answers in French or English, grounded only in the report text, cites the source blocks it used, and says it does not know rather than invent.

## 1. What problem, and for whom?

The user is an **asset manager or a building insurer**. The concrete pain point: today they cannot get a fast, portfolio-wide answer to "which of my buildings have critical defects, and which ones?" because the answer lives in dozens of phased inspection reports written in prose, not in a queryable structure.

BuildingLens addresses this with three things working together:

1. **Defect extraction.** One inspection PDF becomes a structured list of defects, each with `element`, `description`, `location`, `severity` (critical / major / minor) and a `citation` (the verbatim snippet from the report that justifies it).
2. **Risk scoring.** The defects of a building are aggregated into a single 0 to 100 risk score, plus the count of critical / major / minor findings, so a whole stock can be ranked at a glance.
3. **RAG Q&A with citations.** You can ask, in French or English, things like "what are the critical defects of building X?" or "which buildings have a fire risk?". Answers are grounded only in the retrieved report text, each answer cites the source blocks it used, and the model is instructed to say it does not know rather than invent.

## 2. Why is this relevant to SECO?

SECO is an independent technical-control and engineering body for construction (founded 1934 in Belgium, SECO Luxembourg since 1987, around 12,500 structures inspected over its history). Its core business, building technical control, is exactly the upstream of the decennial and biennial insurance guarantee: SECO produces the initial report for the insurer plus the inspection notes that form the basis of risk assessment.

That business generates large volumes of technical data (phased inspection reports, observation synthesis tables by discipline, defect photos, measurements, BIM scans) that today remain largely underexploited. There is no search or RAG over the reports and no defect model on top of them. That gap is precisely this challenge's pain point.

BuildingLens speaks directly to SECO's value chain:

- The defect-by-discipline structure it produces mirrors SECO's own observation synthesis tables, where each finding is tagged by discipline and rated.
- The insurer touchpoint is the natural home for a **machine-readable risk signal** instead of a PDF, which is how a control service turns into a data partnership.
- SECO's historical corpus (thousands of inspected structures) is a uniquely structurable, proprietary dataset: time-stamped observations tagged by discipline and linked to plans and standards. It is one of construction's cleanest "unstructured to structured" problems.

The severity taxonomy is anchored to public, recognised scales (RICS C1/C2/C3 condition ratings as the canonical three classes, with ASTM E2018 and Eurocode consequence classes CC1/CC2/CC3 cited as additional public vocabulary).

## 3. What data sources, and why?

BuildingLens runs on **public, reproducible data only**, combining three real Luxembourg sources with one synthetic layer. Everything can be re-fetched or regenerated from scratch by the pipeline.

| Source | Type / format | Role | License |
|---|---|---|---|
| **EUBUCCO v0.2 (Luxembourg, `nuts_id=LU00`)** | Structured, per building, Parquet (geometry as WKB, EPSG:3035), anonymous S3 download | Per-building anchor: real footprints, coordinates, footprint area, height, plus model-estimated use and floors. Populates the `buildings` table | Mixed per building, stored in `buildings.source`: national LOD1 cadastre (gov-luxembourg, around 77%) is CC0; OpenStreetMap (around 13%) is ODbL (attribution and share-alike); Microsoft (around 10%) |
| **STATEC "Autorisations de bâtir" (building permits)** | Structured, aggregated, labelled CSV via the LUSTAT SDMX REST API (no key) | Sector context only: permit trends by canton and type. Never joined to individual buildings. Satisfies the brief's second heterogeneous source | CC0 |
| **ACT commune boundaries (Luxembourg)** | Structured polygons, GeoJSON, EPSG:4326, committed in-repo (around 1 MB) | Recovers the real commune of each building by point-in-polygon on its centroid (EUBUCCO only carries a coarse code, not a name) | CC0 |
| **Synthetic inspection reports** | Unstructured PDF (generated with ReportLab) | The inspection corpus that feeds extraction and RAG | Generated by the project |

Why these: EUBUCCO is the best open per-building attribute source for Luxembourg (around 186,000 buildings in the LU subset), giving real geometry and height at country scale with no account. STATEC gives official sector context that is machine-readable and pinnable (dataflows plus `startPeriod`) without claiming per-building precision. The ACT boundaries recover a real administrative attribute (the commune) that EUBUCCO does not name, and they are committed in-repo so the build stays offline and byte-for-byte reproducible.

**Real vs synthetic (encoded in the schema comments):**

- **Real, per building:** footprint geometry and coordinates (100% coverage), footprint area in m² computed from the real outline, and the commune resolved by point-in-polygon. Height is real (cadastre / LOD1) for around 78% of buildings and ML-estimated for around 22%, with the source flagged.
- **Real but model-estimated (labelled "estimated" in the UI):** use type and subtype (part ML-estimated, part OpenStreetMap), floors (regression, stored rounded). Construction year is effectively absent in the LU subset and treated as unreliable.
- **Synthetic:** building name, street, number and postcode (EUBUCCO provides none for Luxembourg), and the inspection reports themselves with every defect in them. So a building's **location and footprint are real, but its condition is fictional.**

Why the reports are synthetic, and the production-swap argument: no public corpus of real technical inspection reports exists at volume (they are commercial deliverables), and EUBUCCO has no names or addresses. A seeded generator is the only fully reproducible option, and generating the corpus from code is more robust than scraping while demonstrating that the target schema is understood. In production these PDFs are replaced by **real SECO reports without changing the rest of the pipeline**: extraction, scoring, RAG and the schema all stay the same.

More detail lives in `docs/data-sources.md`.

## 4. Technical decisions and tradeoffs

**Architecture overview.** Two layers. A core Python library, `src/buildinglens/`, holds all the logic (data ingestion, LLM access, extraction, scoring, RAG, report generation). A thin **FastAPI** layer, `api/`, composes that core into HTTP endpoints; it never reimplements logic, it calls core functions, and the core never imports the API. Storage is a single **SQLite** database. Two front-ends sit on top of the same API: a **React + Vite + TypeScript** single-page app (`web/`, the polished presentation layer) and a lightweight **Streamlit** app (`app/`, the reference UI). The two front-ends are intentional, see the tradeoffs below.

**LLM provider abstraction.** A single `LLMClient` protocol (`complete` and `stream`) is implemented by six backends: `anthropic`, `openai`, `mistral`, `local` (Ollama over HTTP, no key), and `mock`. Every provider SDK is imported lazily, so a missing package only fails if you actually select that provider. The factory has a deliberate safety behaviour: if an online provider is selected but its key is missing, it returns the mock client instead of crashing, and callers can detect that silent fallback. This is what keeps the whole app runnable with no key.

**Runtime settings overlay.** Provider, key and model can be changed at runtime from the Settings page and are persisted in SQLite (`app_settings` table), so configuration survives a restart. The `Settings` dataclass is frozen and never mutated; instead the effective config is rebuilt from `.env` defaults plus persisted overrides and atomically rebound. The database path is deliberately excluded from what can be overridden at runtime. The tradeoff is honest: the live path uses single-process module-global rebinding rather than dependency injection, which is simple and correct for one server process but would need rethinking under multiple worker processes.

Other decisions and the tradeoffs accepted:

- **SQLite, not Postgres.** Zero setup, fully reproducible, fast enough for this scale, and it makes `make data && make run` work from zero. WAL journaling and a busy-timeout are enabled so the API can serve reads, settings writes and ingest writes from a threadpool without "database is locked" errors. Tradeoff: it would not survive a real concurrent multi-writer production load; that is a known swap.
- **pdfplumber for text, not OCR.** The synthetic corpus is born-digital, so plain text extraction is enough and OCR would be dead weight here. Tradeoff: real scanned reports with photos would need an OCR stage (Tesseract or a layout model), which is listed as a production redo.
- **Local embeddings for RAG.** Retrieval uses LlamaIndex with a local `sentence-transformers` multilingual model (`paraphrase-multilingual-MiniLM-L12-v2`), so no embedding text ever leaves the machine and there is no per-query network cost once the weights are cached. LlamaIndex's own LLM is forced off so it never builds an OpenAI client behind our back; generation always goes through our provider abstraction. Tradeoff: a small model and an in-memory vector store are fine for this corpus size but would move to a real vector store at scale.
- **Hand-tuned risk score, not a learned model.** The score is `100 * (1 - exp(-raw / K))` with severity weights critical=10, major=4, minor=1 and K=30, which saturates so even very defective buildings stay inside 0 to 100. It is calibrated for a plausible spread, not learned. With a real labelled history this should become a fitted model.
- **One extraction call per document.** Extraction is a single grounded JSON call per report (no tool-use), with fence-tolerant parsing and a retry on the substring between the first and last brace. Defects with an unrecognised severity are skipped with a warning rather than inserted. This favours robustness and simplicity over squeezing maximum recall.
- **Streamlit first, then React.** Streamlit proved the three core features fast and stays as the minimal reference UI. The React app was added on top of the same API to make the product demo-grade (dossier views, streaming Q&A, a portfolio chart, a locator map). The Streamlit app is the reference UI and the React app the polished one, both on the same API.
- **Defensive degradation everywhere.** Every external fetch (EUBUCCO, LUSTAT, commune boundaries) has a deterministic offline fallback, bad rows are warned-and-skipped instead of aborting a batch, and a failed ingest performs a full compensating rollback so it never leaves orphans.
- **Import guarded against duplicates.** A new building created from an address is snapped to its real EUBUCCO footprint; the same footprint under the same name is then recognised as one already on file, so the import is blocked (the existing dossier is shown, with a one-click override) instead of silently creating a copy. Looser matches (a similar name, a nearby footprint) are surfaced but never block, so a genuinely new building is never wrongly refused. The check runs under the ingest lock and before the expensive extraction, so it also closes the double-submit race and a refused duplicate costs nothing.

The web app is styled as a dark "dossier / terminal" interface. It bundles complete English and French translation resources, but it currently initialises in English only and has no active language switcher in the UI (the French bundle stays loaded so the toggle can be re-enabled later).

More detail lives in `docs/architecture.md` and `docs/api.md`.

## 5. What I would put in production tomorrow vs throw away

**Keep for production (with small changes):**

- The core library boundary (data / LLM / extraction / scoring / RAG kept separate from the API).
- The provider abstraction and the mock fallback. Being able to switch provider or run offline with no key is genuinely useful operationally.
- The extraction contract: structured defects with a verbatim citation per finding, which is what makes the output auditable.
- The RAG citation and "I don't know" guardrail, the batched (never N+1) source resolution, and the streaming protocol.
- The reproducible pipeline with offline fallbacks and the honest real-vs-synthetic provenance encoded in the schema.

**Throw away or redo before production:**

- The **synthetic inspection reports**, replaced by real SECO reports (the rest of the pipeline stays).
- The **synthetic evaluation gold set**, replaced by a hand-labelled one on real reports (see the evaluation section for why the current 1.00 is not a real accuracy figure).
- The **hand-tuned scoring weights**, replaced by a model fitted on real claim or defect history.
- **SQLite**, swapped for a managed database once there is real concurrency, and the runtime overlay's single-process rebinding reworked for multiple workers.
- **CORS** allows any localhost origin in dev (a regex, so the Vite fallback port still works); production needs a tightened origin list or a reverse proxy.
- An **OCR stage** would be added for scanned reports (Tesseract or a layout model, ahead of extraction).
- **Incremental RAG indexing** would replace the full reindex per upload with a background ingest queue and differential indexing, so adding one report does not re-embed the whole corpus.
- **Extraction confidence and a review queue**: a per-defect confidence score and a human-in-the-loop review step, so low-confidence findings are validated before they reach the score.
- **Observability and CI**: structured logging, per-LLM-call cost tracking, and evaluation runs in CI, so quality and spend stay visible as the corpus grows.

## 6. With 3 more months

BuildingLens would grow from a per-building tool into a portfolio-scale insurer risk cockpit:

- a geo-map of the stock with risk hotspots and multi-building aggregation, cross-referenced with EPC data, built on the real coordinates and communes already in the database;
- a temporal view of how each building's risk evolves across its phased inspections, so a reviewer sees whether a structure is improving or degrading rather than just a snapshot;
- benchmarking a building's risk against the portfolio or against similar building types and cantons, using the STATEC sector context already ingested;
- discipline-tagged ingestion that links defects to plans and standards (Eurocode references), mirroring SECO's observation synthesis tables so the output drops into the existing workflow;
- a machine-readable risk signal delivered to insurers via API, so a technical-control service becomes a data product;
- role-based team access behind Azure Entra ID single sign-on, with distinct views for inspector, asset manager and insurer;
- computer vision on defect photos (crack detection, severity assist) with spatial tracking on a BIM model or 3D scan, so a defect is located in the structure, not just described in prose;
- active learning that feeds operator corrections back into extraction and scoring;
- data lineage and a GDPR posture: end-to-end provenance, an audit log of ingest and edit actions, data residency and retention, and an EU-hosted LLM option through the provider abstraction.

This is a vision and is not coded.

## Architecture at a glance

```
Public sources                Core (src/buildinglens/)              Interfaces
--------------                ------------------------              ----------
EUBUCCO parquet  ─┐
ACT communes     ─┼─ ingest ─▶ SQLite (buildings/documents/        FastAPI (api/)  ─┬─▶ React + Vite (web/)
STATEC permits   ─┘            defects/app_settings)                                 └─▶ (same API)
                                      │                             Streamlit (app/)
Synthetic PDFs  ── ingest_pdf ────────┤
                                      ├─ extract  (LLM, JSON + citation)
                                      ├─ scoring  (0..100 risk)
                                      └─ rag      (LlamaIndex + local embeddings,
                                                   generation via provider abstraction)

LLM provider abstraction: anthropic | openai | mistral | local (Ollama) | mock
Runtime settings (provider/key/model) persisted in SQLite, changeable without restart.
```

## Reproducibility

Everything runs from zero. Python 3.11 recommended. The `make` targets are in the [Quickstart](#quickstart). `make web` starts the FastAPI backend and the React dev server together (it runs `scripts/dev.py`). To run them separately, in two terminals:

```bash
# Terminal 1: FastAPI backend
python -m uvicorn api.main:app --port 8000

# Terminal 2: React web app
cd web
npm install
npm run dev        # Vite dev server on http://localhost:5173, proxies /api to :8000
```

Extras: `make run` (Streamlit backup UI), `make test` (pytest), `make fmt` (ruff format), `make clean` (remove the generated DB, keep downloaded raw sources).

**Mock mode (no API key).** Copy `.env.example` to `.env`. With no key, set `LLM_PROVIDER=mock` (or pass `--mock`) to use deterministic fixtures: the whole pipeline, the app and the evaluation all run offline. `.env` is never committed; keys are left blank in the example (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`), the default model is `claude-opus-4-8`, and the local provider points at Ollama (`http://localhost:11434`, `llama3.1`). Note: real defect extraction needs a key. In mock mode `make extract` inserts no defects, so `make eval` then reports the gold set with zero predicted and prints a hint to configure a key.

## Evaluation

Evaluation lives in `eval/eval_extraction.py` and compares the **predicted** defects (what extraction wrote into the `defects` table) against a **synthetic ground truth**.

- **Gold set.** It is the exact set of defects the generator embedded in each report, rebuilt at eval time and persisted to `eval/gold.jsonl` (one JSON line per defect). The committed set is **241 defects across 40 buildings**.
- **Matching.** Element-level, per building: a prediction matches a gold defect when their normalised element token sets overlap enough (Jaccard at least 0.5, or one set is a subset of the other). Matching is greedy and one-to-one.
- **Metrics reported.** `gold_defects`, `predicted_defects`, `matched` (true positives), **precision**, **recall**, **F1**, and **severity accuracy** measured only on matched pairs (exact severity match), all rounded to three decimals.

**Honest limitations.** Because the same generator both writes the PDFs and emits the gold set, this is a **mechanics check on extraction fidelity over synthetic text, not real-world accuracy.** With Claude the run reports precision, recall and F1 of 1.00 and severity accuracy 1.00; that is expected and only shows the model re-reading what the generator injected and mapping each RICS rating to the right severity. It should not be read as a real accuracy figure. Real, heterogeneous reports with OCR noise and varied wording would score lower and would need a hand-labelled gold set, which is listed as a redo-before-production item.

Other limitations:

- **Hallucinations.** The RAG path is constrained to answer only from retrieved text, cite its sources, and say it does not know otherwise, but no LLM guardrail is perfect.
- **False positives.** Extraction can over-extract or mis-classify on real prose; the citation field exists precisely so a human can check each finding.
- **Synthetic inspection data.** The reports and the defects in them are generated, so the condition of every building is fictional; only its location and footprint are real.

## Demo

A short screencast of the product is recorded locally (run the FastAPI backend and the React app, then walk through search, a building dossier and ingest). A step-by-step demo plan is in `docs/demo-script.md`. The demo is a **bonus**, not a core deliverable.

## Brief coverage

Core MVP is complete.

- [x] `make data && make run` works from zero (reproducible)
- [x] At least two heterogeneous sources ingested, at least one real public source cited
- [x] AI defect extraction and severity classification, evaluated (synthetic mechanics check, P/R/F1 = 1.00; see Evaluation for why this is not a real-world accuracy figure)
- [x] RAG with citations and an anti-hallucination "I don't know" guardrail
- [x] Usable UI (Streamlit reference UI plus a React companion app)
- [x] `--mock` mode to run with no API key
- [x] README answering the six questions, with documented limits and owned tradeoffs
- [x] Clean, atomic git history
- [x] **Client reports (signature feature), v1 shipped.** Per-building Excel and PDF reports with severity colour coding and an LLM executive summary (a deterministic template in mock mode), exportable from the building dossier. v2, an insurer synthesis table with automatic RICS / ASTM deviation flagging, is a planned extension (see section 6).
- [ ] Demo screencast (bonus, recorded locally)
