import { type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AskResponse } from "../../api/types";
import { Button, Panel, Spinner } from "../ui";

interface Props {
  /** Case code shown in the bar title, e.g. "B-047". */
  caseId: string;
  question: string;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  loading: boolean;
  error: string | null;
  response: AskResponse | null;
}

/**
 * The "ask this building" command bar, docked above the tabs and present on every
 * tab. It is a controlled, presentational component: BuildingPage owns the question
 * and answer state so a tab switch never wipes an in-progress question or a returned
 * answer. It composes the Panel primitive so its chrome stays in sync with every
 * other dossier module; the grounded answer flows in the panel body and grows
 * without clipping. Mirrors the search field pattern: the whole input frame is a
 * label, so a click anywhere in it focuses the prompt.
 */
export default function AskBar({
  caseId,
  question,
  onQuestionChange,
  onAsk,
  loading,
  error,
  response,
}: Props) {
  const { t } = useTranslation();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onAsk();
  }

  return (
    <section aria-label={t("building.askAbout")}>
      <Panel
        code={
          <>
            {t("search.code")} {caseId}
          </>
        }
        title={t("building.askAbout")}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <label className="flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-sm border border-line bg-ink-800 pl-3 transition duration-150 ease-out focus-within:border-signal-400/60 focus-within:ring-2 focus-within:ring-signal-400/70">
            <span aria-hidden="true" className="select-none font-mono text-sm font-semibold text-signal-400">
              &gt;_
            </span>
            <input
              type="text"
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder={t("search.placeholder")}
              disabled={loading}
              aria-label={t("building.askAbout")}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-fg placeholder-fg-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <Button
            type="submit"
            disabled={loading || !question.trim()}
            leftIcon={loading ? <Spinner size="sm" /> : undefined}
            className="h-11 shrink-0 rounded-sm px-5 uppercase tracking-wide"
          >
            {loading ? t("common.loading") : t("search.ask")}
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm text-critical">
            {error}
          </p>
        )}

        {response && (
          <div className="mt-4 space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{response.answer}</p>
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
    </section>
  );
}
