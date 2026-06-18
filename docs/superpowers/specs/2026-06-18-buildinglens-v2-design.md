# BuildingLens web v2 design spec

Date: 2026-06-18. Branch: `feature/react-app`.

Turn the polished-but-plain React app into a futuristic, refined ("First Light") product: a real landing page,
a settings area to configure the AI (API key or local Ollama), a RAG ingestion section to feed documents, and a
readability fix on the building page. The Streamlit app is untouched for now. Visual language is locked in
`design-system/buildinglens/V2-FIRST-LIGHT.md` (dark, epure, cyan accent, Space Grotesk / Inter / JetBrains Mono).

## Decisions (locked)

- Theme: dark only (no light toggle for now). Whole React app is converted; the app must never be half light, half dark.
- This is a single-user LOCAL tool. No auth now, which is what makes an in-app settings page handling keys acceptable.
- Settings persistence: a SQLite `settings` table layered over `.env` defaults. The API key entered in the UI is stored
  there (the DB is gitignored). The API never returns a raw key, only `has_key` + a masked tail.
- Ingestion attaches an uploaded PDF to an existing building OR creates a new building from entered metadata.
- Reindex after ingestion runs synchronously behind a write-lock (honest about the O(corpus) cost in the README).
- Azure Entra ID B2B login is documented as 3-month vision only, plus a disabled "coming soon" block in Settings. Not built.

## Stage 0: foundation (build first)

Shared UI primitives and tokens so three new surfaces do not triple the existing copy-paste. See the design system for
the exact component contracts. Deliver:

- `web/tailwind.config.js`: First Light dark tokens (ink, line, fg, signal, critical/major/minor) + font families.
- `web/src/index.css`: Google Fonts import (Space Grotesk, Inter, JetBrains Mono), dark base, selection + scrollbar,
  the reduced-motion guard (kept), an optional faint grid/glow utility.
- `web/src/lib/risk.ts`: one module for severity colors (hex + tone) and risk thresholds, consumed by charts and badges.
- `web/src/components/ui/`: `Card`, `Button`, `Input`/`Textarea` (Field), `Badge`, `Spinner`, `EmptyState`,
  `PageHeader`, `Section`, plus a barrel `index.ts` re-exporting these and the existing `Tooltip`/`InfoTip`/`LocatorMap`.
- `Layout` becomes a dark shell: a data-driven `NavLink` list in two groups (primary: Home, Search, Portfolio | tools:
  Ingest, Settings), a global "AI provider" status chip fed by `/api/meta` (shows the effective provider or "mock",
  links to Settings), the EN/FR switcher, and a slim footer. Active state via `NavLink` isActive (fixes nested routes).

All existing components (search, portfolio, building groups) are converted to the dark system in this stage so the app
stays coherent. The building group also gets the readability fix below.

## Stage 1: landing page

- `LandingPage` at `/`; `SearchPage` moves to `/search` (logic unchanged); add a `*` 404 page; update the wordmark and
  nav links and the active match.
- Sections: hero (value proposition + two CTAs: Search, Portfolio; HUD corner ticks + faint glow), the problem
  (asset managers and insurers drown in long heterogeneous reports), what it does (three cards: extract defects, score
  risk, ask in plain language with citations), a live "proof of data" strip from `/api/meta` (buildings / documents /
  defects counts) with a graceful zero-state linking to Ingest, and a short "how it works + data sources" note linking
  to the docs. Bilingual EN/FR.

## Stage 1b: building-card readability fix

The address renders twice today (header + Overview card) and source twice, plus a filler subtitle. Fix:

- Header is the single home of identity via `PageHeader`: H1 = name, one quiet meta line = address + a source `Badge`,
  and the risk score promoted into the header as the headline metric (large mono figure + severity color + InfoTip).
- Remove the duplicate Address and Source rows from the Overview card and drop the generic subtitle. Overview keeps year
  built, height, coordinates/source-id and the locator map.

## Stage 2: settings + backend

Backend:
- `src/buildinglens/config.py`: add `get_settings()` / `set_settings(overrides)` that rebuild the frozen `Settings`
  atomically and rebind both `config.settings` and `llm.default_settings`. `llm.get_llm()` defaults to `get_settings()`.
  Because `get_llm()` is already called per request, changes take effect with no restart.
- Persistence: a `settings` table (key, value) in SQLite. On startup, effective config = `.env` defaults overlaid with
  the table. The UI-entered API key is stored there. Correct the `api/README.md` line that wrongly says pydantic-settings.
- `api/routers/settings.py`: `GET /api/settings` returns provider, models, ollama url/model, and `has_key` + masked tail
  per provider (never the raw key). `PUT /api/settings` saves provider + optional key + models + ollama settings.
  `POST /api/settings/test` runs a real connection check (provider `complete("ping")`, or Ollama `/api/tags`) and returns
  ok/fail + the effective client name, so a bad key cannot silently fall back to mock unnoticed.

Frontend `SettingsPage` at `/settings`: provider selector (Anthropic / OpenAI / Mistral / local Ollama / mock), a
write-only key field (shows "key set, ...1234" when present), per-provider model fields, Ollama URL, a Test button with
clear success/failure, and a disabled "Authentication (Azure Entra ID), coming soon" section. `client.ts` gains
`getSettings` / `saveSettings` / `testSettings`.

## Stage 3: RAG ingestion + backend

Backend `api/routers/ingest.py`: `POST /api/ingest` (multipart). Save the PDF under `data/raw/uploads/`, then attach to a
chosen `building_id` or create a new building from posted name/address; compose the existing core:
`ingest_pdf.ingest_reports` -> `extract.extract_for_document` -> `scoring.compute_scores` -> `rag.build_index`
(explicitly, so new content is retrievable), all behind a single write-lock, synchronous. Return
`{document_id, building_id, defects_extracted, new_risk_score, chunks_indexed}`; in mock mode state clearly that no
defects were extracted.

Frontend `IngestPage` at `/ingest`: a target selector (existing building dropdown OR "new building" with name/address),
a PDF picker, and a result panel showing extracted defects + new score with a link to the building. `client.ts` gains a
multipart `ingest()` path. Wire the Portfolio zero-buildings state to an `EmptyState` that links to `/ingest`, making
ingestion the natural first-run flow.

## 3-month vision (documented only)

README "3 months" section: B2B login via Azure Entra ID (multi-tenant, per-org portfolios, roles), incremental RAG
indexing (chunk ids + `index.add()`), and a background job queue for ingestion. Settings shows the disabled auth block.

## Risks and mitigations

- Secret handling: never return the raw key from the API; store runtime keys in the SQLite settings table (gitignored DB);
  scrub keys from logs. Local-only, no-auth assumption stated in the README.
- Frozen-config mutability: rebind the whole `Settings` object atomically via `set_settings`; verify by reading back
  `/api/meta` provider after save.
- Reindex cost / staleness: reindex synchronously behind a lock and always call `build_index` explicitly after ingest
  (`answer()` only auto-builds when the index file is absent). Document the cost.
- SQLite write concurrency: serialize ingest/extract/score/reindex behind one lock; name it as a known single-user limit.
- Silent mock fallback: surface the effective provider globally (the nav chip) and add the Test connection action.

## Execution (multi-agent, staged)

Waves of multi-agent workflows, each followed by a build + adversarial review pass, browser verification, and a cohesive
commit on `feature/react-app`:

1. Wave 1: Stage 0 foundation (tokens + primitives) and dark conversion of Layout + the three existing page groups
   (building group includes the readability fix).
2. Wave 2: Stage 1 landing page + 404 + routing move.
3. Wave 3: Stage 2 settings (backend config-rebind seam + endpoints, then the page).
4. Wave 4: Stage 3 ingestion (backend endpoint + multipart client, then the page + first-run wiring).
5. Docs: README v2 section + the 3-month vision; correct the api/README config note.

Constraints throughout: English UI/code/commits (README bilingual), no em-dashes, every visible string in both
`en.json` and `fr.json` with a `nav.*` key, no AI attribution on commits (author Michel Milanesi), accessibility per the
design system.
