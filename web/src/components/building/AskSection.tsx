import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import type { AskResponse } from "../../api/types";
import { Button, Input, Panel, Spinner } from "../ui";

interface Props {
  buildingId: number;
  /** Case code for the panel title, e.g. "B-047". */
  caseId: string;
}

export default function AskSection({ buildingId, caseId }: Props) {
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
    <Panel
      code={
        <>
          {t("search.code")} {caseId}
        </>
      }
      title={t("building.askAbout")}
      footer={`${caseId} // GROUNDED`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          className="flex-1"
        />
        <Button
          onClick={() => void handleAsk()}
          disabled={loading || !question.trim()}
          leftIcon={loading ? <Spinner size="sm" /> : undefined}
        >
          {loading ? t("common.loading") : t("search.ask")}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-critical">{error}</p>}

      {response && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-fg">{response.answer}</p>

          {response.sources.length > 0 && (
            <div>
              <p className="mb-2 font-display text-xs font-medium uppercase tracking-[0.18em] text-fg-faint">
                {t("search.sources")}
              </p>
              <ul className="space-y-1.5">
                {response.sources.map((src, idx) => (
                  <li
                    key={idx}
                    className="rounded-sm border border-line bg-ink-800 px-3 py-2 text-xs text-fg-muted"
                  >
                    <span className="font-mono font-medium tabular-nums text-signal-300">
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
    </Panel>
  );
}
