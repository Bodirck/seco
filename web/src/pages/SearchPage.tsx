import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type {
  ChatTurn,
  Meta,
  ResolveScopeResponse,
  SearchOptions,
  Turn,
} from "../api/types";
import ConversationView from "../components/search/ConversationView";
import MockNoticeBanner from "../components/search/MockNoticeBanner";
import ScopeBar, {
  emptyScope,
  scopeIsEmpty,
  type FacetKey,
  type ScopeState,
} from "../components/search/ScopeBar";
import {
  Button,
  CodeLabel,
  DecodeText,
  Panel,
} from "../components/ui";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function scopeArrays(s: ScopeState) {
  return {
    communes: [...s.communes],
    uses: [...s.uses],
    severities: [...s.severities],
  };
}

export default function SearchPage() {
  const { t } = useTranslation();

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [options, setOptions] = useState<SearchOptions | null>(null);
  const [scope, setScope] = useState<ScopeState>(emptyScope());
  const [resolved, setResolved] = useState<ResolveScopeResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resolveReq = useRef(0);

  // Provider meta (for the mock banner) and the facet options. Both are
  // non-critical: a failure just hides the banner or the scope bar.
  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    api.searchOptions().then(setOptions).catch(() => {});
  }, []);

  // Abort any in-flight stream when the page unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Live "N of M" scope summary: resolve facets to a count, debounced and
  // race-guarded so a fast click sequence shows the latest scope only.
  useEffect(() => {
    if (scopeIsEmpty(scope)) {
      setResolved(null);
      return;
    }
    const id = ++resolveReq.current;
    const handle = setTimeout(() => {
      api
        .resolveScope(scopeArrays(scope))
        .then((r) => {
          if (resolveReq.current === id) setResolved(r);
        })
        .catch(() => {
          if (resolveReq.current === id) setResolved(null);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [scope]);

  const examples = t("search.exampleList", { returnObjects: true }) as string[];
  const total = meta?.buildings ?? 0;

  function buildScopeSummary(s: ScopeState): string {
    const parts: string[] = [];
    if (s.communes.size) parts.push([...s.communes].join(", "));
    if (s.uses.size) parts.push([...s.uses].join(", "));
    if (s.severities.size) {
      parts.push([...s.severities].map((x) => t(`common.${x}`)).join(", "));
    }
    return parts.join(" / ");
  }

  function toggleFacet(facet: FacetKey, value: string) {
    setScope((prev) => {
      const next: ScopeState = {
        communes: new Set(prev.communes),
        uses: new Set(prev.uses),
        severities: new Set(prev.severities),
      };
      const set = next[facet] as Set<string>;
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return next;
    });
  }

  const updateTurn = (id: string, fn: (turn: ChatTurn) => ChatTurn) =>
    setTurns((prev) => prev.map((turn) => (turn.id === id ? fn(turn) : turn)));

  async function runQuery(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;

    let buildingIds: number[] | undefined;
    let scopeSummary: string | undefined;

    if (!scopeIsEmpty(scope)) {
      scopeSummary = buildScopeSummary(scope);
      // Resolve authoritatively at submit so a just-changed scope is never stale.
      let r: ResolveScopeResponse | null = resolved;
      try {
        r = await api.resolveScope(scopeArrays(scope));
        setResolved(r);
      } catch {
        // Resolution failed: fall back to the last known scope, or unscoped.
      }
      if (r) {
        if (r.count === 0) {
          // No building matches: answer immediately, never fire a doomed query.
          setTurns((prev) => [
            ...prev,
            {
              id: newId(),
              question: q,
              status: "success",
              answer: t("search.scope.empty"),
              sources: [],
              scopeSummary,
            },
          ]);
          setQuestion("");
          return;
        }
        buildingIds = r.building_ids;
      }
    }

    const history: Turn[] = turns
      .filter((turn) => turn.status === "success" && turn.answer.trim())
      .map((turn) => ({ question: turn.question, answer: turn.answer }));

    const id = newId();
    setTurns((prev) => [
      ...prev,
      { id, question: q, status: "loading", answer: "", sources: [], scopeSummary },
    ]);
    setQuestion("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let deltas = 0;

    try {
      await api.askStream(q, {
        buildingIds,
        history,
        signal: controller.signal,
        onSources: (sources) =>
          updateTurn(id, (turn) => ({ ...turn, sources, status: "streaming" })),
        onDelta: (text) => {
          deltas += 1;
          updateTurn(id, (turn) => ({
            ...turn,
            answer: turn.answer + text,
            status: "streaming",
          }));
        },
      });
      updateTurn(id, (turn) => ({ ...turn, status: "success" }));
    } catch (err) {
      if (controller.signal.aborted) {
        // User stopped: keep whatever streamed, otherwise mark the turn stopped.
        updateTurn(id, (turn) =>
          turn.answer.trim()
            ? { ...turn, status: "success" }
            : { ...turn, status: "error", errorMessage: t("search.stopped") },
        );
      } else if (deltas === 0) {
        // Pre-delta failure: fall back transparently to the non-streaming ask.
        try {
          const resp = await api.ask(q, { buildingIds, history });
          updateTurn(id, (turn) => ({
            ...turn,
            answer: resp.answer,
            sources: resp.sources,
            status: "success",
          }));
        } catch (err2) {
          const message = err2 instanceof Error ? err2.message : String(err2);
          updateTurn(id, (turn) => ({ ...turn, status: "error", errorMessage: message }));
        }
      } else {
        // Mid-stream failure: keep the partial answer with a soft note.
        updateTurn(id, (turn) => ({
          ...turn,
          status: "success",
          errorMessage: t("search.streamFallback"),
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runQuery(question);
  }

  function handleExampleClick(example: string) {
    setQuestion(example);
    inputRef.current?.focus();
    runQuery(example);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleClear() {
    abortRef.current?.abort();
    setTurns([]);
  }

  const placeholder =
    turns.length > 0 ? t("search.followUpPlaceholder") : t("search.placeholder");

  return (
    <div className="mx-auto max-w-3xl">
      {meta?.provider === "mock" && (
        <div className="mb-8 animate-panel-in">
          <MockNoticeBanner />
        </div>
      )}

      {/* Query terminal: scope bar + the prompt form inside a "QUERY //" panel. */}
      <Panel
        code={t("search.code")}
        title={t("search.title")}
        accent="orange"
        windowButtons
        footer="SECTOR 02 // INTEL"
        className="animate-panel-in"
      >
        <DecodeText
          as="h1"
          text={t("search.title")}
          className="block font-display text-2xl font-bold uppercase tracking-wide text-fg sm:text-3xl"
        />
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {t("search.subtitle")}
        </p>

        <div className="mt-6">
          <ScopeBar
            options={options}
            scope={scope}
            total={total}
            resolvedCount={resolved ? resolved.count : null}
            onToggle={toggleFacet}
            onClearAll={() => setScope(emptyScope())}
          />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <label className="flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-sm border border-line bg-ink-800 pl-3 transition duration-150 ease-out focus-within:border-signal-400/60 focus-within:ring-2 focus-within:ring-signal-400/70">
              <span
                aria-hidden="true"
                className="select-none font-mono text-sm font-semibold text-signal-400"
              >
                &gt;_
              </span>
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={placeholder}
                disabled={busy}
                aria-label={placeholder}
                className="h-11 min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-fg placeholder-fg-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            {busy ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleStop}
                className="h-11 shrink-0 rounded-sm px-5 uppercase tracking-wide"
              >
                {t("search.stop")}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!question.trim()}
                className="h-11 shrink-0 rounded-sm px-5 uppercase tracking-wide"
              >
                {t("search.ask")}
              </Button>
            )}
          </div>
        </form>

        {turns.length === 0 ? (
          <div className="mt-5">
            <p className="mb-2">
              <CodeLabel accent="amber">{t("search.examples")}</CodeLabel>
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExampleClick(ex)}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-ink-800 px-3 py-1.5 text-xs text-fg-muted transition duration-150 ease-out hover:border-signal-400/40 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-[10px] font-semibold text-signal-400"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="uppercase tracking-wide"
            >
              {t("search.clearConversation")}
            </Button>
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-fg-faint">
          {t("search.groundedNote")}
        </p>
      </Panel>

      {/* Transcript */}
      <div className="mt-8">
        {turns.length === 0 ? (
          <p className="text-center text-sm text-fg-faint">{t("search.noAnswer")}</p>
        ) : (
          <ConversationView turns={turns} />
        )}
      </div>
    </div>
  );
}
