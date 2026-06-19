import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { AskResponse, Meta } from "../api/types";
import AnswerPanel from "../components/search/AnswerPanel";
import MockNoticeBanner from "../components/search/MockNoticeBanner";
import {
  Button,
  CodeLabel,
  DecodeText,
  Panel,
  Spinner,
} from "../components/ui";

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: AskResponse };

export default function SearchPage() {
  const { t } = useTranslation();

  const [question, setQuestion] = useState("");
  const [queryState, setQueryState] = useState<QueryState>({ status: "idle" });
  const [meta, setMeta] = useState<Meta | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .meta()
      .then(setMeta)
      .catch(() => {
        // meta failure is non-critical; just skip the banner
      });
  }, []);

  const examples = t("search.exampleList", { returnObjects: true }) as string[];

  async function runQuery(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setQueryState({ status: "loading" });

    try {
      const data = await api.ask(trimmed);
      setQueryState({ status: "success", data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setQueryState({ status: "error", message });
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

  const isLoading = queryState.status === "loading";

  return (
    <div className="mx-auto max-w-2xl">
      {/* Mock notice banner */}
      {meta?.provider === "mock" && (
        <div className="mb-8 animate-panel-in">
          <MockNoticeBanner />
        </div>
      )}

      {/* Query terminal: the search form lives inside a "QUERY //" dossier panel. */}
      <Panel
        code={t("search.code")}
        title={t("search.title")}
        accent="orange"
        windowButtons
        footer="SECTOR 02 // INTEL"
        className="animate-panel-in"
      >
        {/* Hero heading with a decode reveal. */}
        <DecodeText
          as="h1"
          text={t("search.title")}
          className="block font-display text-2xl font-bold uppercase tracking-wide text-fg sm:text-3xl"
        />
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {t("search.subtitle")}
        </p>

        {/* Search form: prompt input + orange Ask button. */}
        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {/* The whole frame is a label, so a click anywhere in it focuses the
                input, not just the narrow text glyph. */}
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
                placeholder={t("search.placeholder")}
                disabled={isLoading}
                aria-label={t("search.placeholder")}
                className="h-11 min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-fg placeholder-fg-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <Button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="h-11 shrink-0 rounded-sm px-5 uppercase tracking-wide"
            >
              {t("search.ask")}
            </Button>
          </div>
        </form>

        {/* Example chips as terminal options. */}
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
                disabled={isLoading}
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

        {/* Grounding note. */}
        <p className="mt-5 text-xs leading-relaxed text-fg-faint">
          {t("search.groundedNote")}
        </p>
      </Panel>

      {/* Result area */}
      <div className="mt-8">
        {queryState.status === "idle" && (
          <p className="text-center text-sm text-fg-faint">
            {t("search.noAnswer")}
          </p>
        )}

        {queryState.status === "loading" && (
          <Panel
            code={t("search.codeRunning")}
            accent="amber"
            footer="RETRIEVING INTEL // GROUNDED SEARCH"
            className="animate-panel-in"
          >
            <div className="flex items-center gap-4 py-3">
              <Spinner />
              <div className="min-w-0">
                <DecodeText
                  as="p"
                  text={t("search.searching")}
                  className="block font-display text-sm font-semibold uppercase tracking-wide text-fg"
                />
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                  {t("search.searchingNote")}
                </p>
              </div>
            </div>
          </Panel>
        )}

        {queryState.status === "error" && (
          <div
            role="alert"
            className="rounded-sm border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical"
          >
            {t("common.error")}
            {queryState.message && (
              <span className="ml-1 opacity-70">({queryState.message})</span>
            )}
          </div>
        )}

        {queryState.status === "success" && (
          <AnswerPanel response={queryState.data} />
        )}
      </div>
    </div>
  );
}
