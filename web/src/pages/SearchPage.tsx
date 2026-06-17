import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { AskResponse, Meta } from "../api/types";
import AnswerPanel from "../components/search/AnswerPanel";
import MockNoticeBanner from "../components/search/MockNoticeBanner";

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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t("search.title")}
        </h1>
        <p className="mt-3 text-base text-slate-500">{t("search.subtitle")}</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("search.placeholder")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            disabled={queryState.status === "loading"}
          />
          <button
            type="submit"
            disabled={queryState.status === "loading" || !question.trim()}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("search.ask")}
          </button>
        </div>
      </form>

      {/* Example chips */}
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {t("search.examples")}
        </p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleExampleClick(ex)}
              disabled={queryState.status === "loading"}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Result area */}
      <div>
        {queryState.status === "idle" && (
          <p className="text-center text-sm text-slate-400">{t("search.noAnswer")}</p>
        )}

        {queryState.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
              aria-hidden="true"
            />
            {t("common.loading")}
          </div>
        )}

        {queryState.status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
