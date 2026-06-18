import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import type { AskResponse } from "../../api/types";
import { InfoTip } from "../ui/Tooltip";

interface Props {
  buildingId: number;
}

export default function AskSection({ buildingId }: Props) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await api.ask(q, buildingId);
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void handleAsk();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {t("building.askAbout")}
        <InfoTip text={t("building.tips.askAbout")} />
      </h3>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        />
        <button
          onClick={() => void handleAsk()}
          disabled={loading || !question.trim()}
          className="inline-flex cursor-pointer items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("search.ask")}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {response && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-slate-700">{response.answer}</p>

          {response.sources.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("search.sources")}
              </p>
              <ul className="space-y-1.5">
                {response.sources.map((src, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    <span className="font-mono font-medium tabular-nums text-brand-700">
                      #{src.document_id}
                    </span>{" "}
                    {src.snippet}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
