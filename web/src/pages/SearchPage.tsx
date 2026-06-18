import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { AskResponse, Meta } from "../api/types";
import AnswerPanel from "../components/search/AnswerPanel";
import MockNoticeBanner from "../components/search/MockNoticeBanner";
import { Button, Input, Spinner } from "../components/ui";

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
        <div className="mb-8">
          <MockNoticeBanner />
        </div>
      )}

      {/* Hero heading */}
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {t("search.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-fg-muted">
          {t("search.subtitle")}
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="min-w-0 flex-1">
            <Input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("search.placeholder")}
              disabled={isLoading}
              aria-label={t("search.placeholder")}
              className="h-11 px-4 text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="h-11 shrink-0 px-5"
          >
            {t("search.ask")}
          </Button>
        </div>
      </form>

      {/* Example chips */}
      <div className="mb-3">
        <p className="mb-2 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
          {t("search.examples")}
        </p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleExampleClick(ex)}
              disabled={isLoading}
              className="cursor-pointer rounded-full border border-line bg-ink-850 px-3 py-1.5 text-xs text-fg-muted transition duration-150 ease-out hover:border-signal-400/40 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Grounding note */}
      <p className="mb-10 text-xs leading-relaxed text-fg-muted">
        {t("search.groundedNote")}
      </p>

      {/* Result area */}
      <div>
        {queryState.status === "idle" && (
          <p className="text-center text-sm text-fg-faint">
            {t("search.noAnswer")}
          </p>
        )}

        {queryState.status === "loading" && (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-fg-muted">
            <Spinner size="sm" />
            {t("common.loading")}
          </div>
        )}

        {queryState.status === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical"
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
