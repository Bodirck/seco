# Search deep pass: scoped, streaming, multi-turn RAG with rich citations

Date: 2026-06-19
Branch: `feat/search-deep`
Status: approved scope, implementation in progress

## Goal

Take the Search page from a single question to answer exchange to a full
conversational RAG console, with four capabilities the asset manager / insurer
actually needs:

1. Structured filters / scope (commune, severity, building use)
2. Streaming answers (token by token)
3. Conversation with follow up questions (multi turn)
4. Enriched citations (relevance, building name and commune, full passage)

Constraint that frames everything: this is a recruitment take home. Relevance
and defensibility at an oral beat sophistication. The whole pipeline must keep
working in mock mode with no API key (the grading machine runs in mock).

## One endpoint, not three

The three heavy capabilities all converge on a single new endpoint. Designing
three would fragment the contract and duplicate retrieval.

`POST /api/ask/stream` carries question, scope and history; the legacy
`POST /api/ask` stays byte for byte for the building page AskBar (and as the
streaming fallback).

Request body is a superset of the existing `AskBody`, every new field optional:

```
{
  "question": str,
  "building_id": int | null,                      // unchanged single building scope (EQ); wins if set
  "building_ids": int[] | null,                   // new portfolio scope (IN filter); [] = empty scope guard
  "history": [{"question": str, "answer": str}]   // new, default [], capped server side
}
```

Response: `200`, `Content-Type: application/x-ndjson`, headers
`Cache-Control: no-cache` and `X-Accel-Buffering: no`. Body is newline delimited
JSON frames in this exact order:

1. exactly one sources frame: `{"type":"sources","sources":[Source...]}` (before any token)
2. zero or more delta frames: `{"type":"delta","text": str}` (concatenation reconstructs the answer)
3. exactly one terminal frame: `{"type":"done"}` or `{"type":"error","message": str}`

HTTP level failures (422 bad body, 500 before streaming) come back as normal
FastAPI `{"detail": ...}` and the client surfaces them through the existing
`toError()` path.

### Why NDJSON over a StreamingResponse

SSE / `EventSource` is GET only and cannot carry a POST body (question +
filters + history), so we POST and read `res.body` with a `ReadableStream`
reader. NDJSON over `StreamingResponse` is the smallest mechanism that frames
typed events, needs no extra dependency, parses with one `split("\n")` plus a
buffer, works identically in mock, and is trivial to defend at the oral.

## Scope precedence (decided once)

Single source of truth in `rag.answer` / `rag.answer_stream`:

- `building_id` (single int) set: EQ branch, the AskBar path, unchanged.
- else non empty `building_ids`: IN branch.
- else: whole portfolio.
- `building_ids == []`: short circuit to the friendly empty scope answer with
  `sources: []` before loading the index.

`history` affects only the generation prompt, never retrieval, so it composes
cleanly with any scope.

All scope reduces to a `building_id` set fed to the same `rag._retrieve`
metadata path. Filter state lives in the frontend; the backend is stateless.
`POST /api/search/resolve` is the single facets to building_ids source of truth,
with a client side intersection as the MVP cut fallback.

## Conversation: no condensation

We do not rewrite follow ups into standalone queries (that is an extra LLM call
and an extra failure point). We include the last 3 turns (prior answers
truncated to about 300 chars) in the generation prompt only; retrieval always
uses the latest question alone. Defensible on a 40 building corpus. The history
cap is enforced server side, never trusting the client. The standalone query
rewrite is documented as a 3 month improvement.

## Enriched sources, once

The `Source` shape gains `score`, `full_text`, `building_name`, `commune`. It is
enriched once and carried identically by both the legacy `/api/ask` response and
the streaming sources frame, so the frontend `Source` type is defined a single
time and `SourceCard` renders both paths. The name / commune join is one batched
`SELECT id, name, commune FROM buildings WHERE id IN (...)` on the distinct
retrieved ids, not N+1.

## Shared core

One `rag._prepare(question, conn, building_id, building_ids, k, index_dir,
history)` does index build / load, retrieval, enriched sources and prompt
building for both `answer()` and `answer_stream()`, so streamed and non streamed
results can never drift.

## Build order

Each step is verifiable in isolation, in mock, before the next lands.

- WP-A backend, scope plumbing: `_retrieve` gains `building_ids` (IN branch,
  over fetch `max(k*4, 20)` + defensive post filter + cap); `answer` gains
  `building_ids` and `history` after existing kwargs; empty scope guard.
- WP-B backend, enriched sources: add `score`, `full_text`, batched name /
  commune join inside the shared source step.
- WP-C backend, streaming: `stream()` on the `LLMClient` Protocol and every
  provider (mock chunks its canned text); `answer_stream`; the `/api/ask/stream`
  route.
- WP-D backend, history in the prompt (no condense): `_format_history`, the
  system prompt line restricting `[n]` citation to the numbered context.
- WP-E frontend, types + client: enriched `Source`, `SearchOptions`,
  `ResolveScopeResponse`, `Turn`, `ChatTurn`, `AskStreamEvent`; `api.askStream`
  (fetch + reader + buffered split), `api.searchOptions`, `api.resolveScope`;
  keep `api.ask` backward compatible.
- WP-F frontend, facets + ScopeBar: `GET /api/search/options`,
  `POST /api/search/resolve` in a new `api/routers/search.py`; `ScopeBar.tsx`
  reusing the proven `DefectTable` portal popover pattern.
- WP-G frontend, transcript + streaming render: `SearchPage` from single answer
  to a streaming, scoped, multi turn transcript; `ConversationView.tsx`;
  redesigned `SourceCard`; Stop (AbortController) and Clear conversation.

## Risks tracked

- SQLite connection lifetime across `StreamingResponse`: Starlette consumes the
  generator while the dependency context is open, so the per request connection
  stays valid; must be verified with a real multi second mock stream. Fallback:
  open and close the connection inside the stream generator.
- NDJSON frame straddling network chunks: client buffers and only parses on
  `\n`, flushing the trailing partial at end. Unit tested.
- IN over fetch on a tiny corpus: in scope chunks can be crowded out; mitigated
  by over fetch + post filter + cap.
- Contract drift on `/api/ask`: new fields stay optional / defaulted; a test
  asserts `{question, building_id}` answers unchanged.
- Provider `stream()` SDK drift: real streaming on anthropic + openai + mock is
  the defensible floor; mistral / ollama can fall back to yielding `complete()`
  once if a provider SDK shifts.
- Double generation: the non streaming fallback fires only on a real pre delta
  failure, never alongside the stream.
- Data sparsity: commune may be null and use / floors are model estimated;
  facets exclude nulls, `SourceCard` omits a null commune line, the relevance
  bar clamps to [0, 1].
- Answer language: the synthetic corpus and existing RAG answers are French; the
  new empty scope and no result messages stay French to match the data, while
  the UI chrome stays English only.

## Out of scope (documented as future work)

Standalone query rewriting for follow ups; live facet recount after a mid
session ingest; real streaming hardening for mistral / ollama beyond the
complete() fallback.
