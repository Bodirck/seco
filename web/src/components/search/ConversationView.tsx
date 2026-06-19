import { useTranslation } from "react-i18next";
import type { ChatTurn } from "../../api/types";
import { DecodeText, Panel, Spinner } from "../ui";
import AnswerPanel from "./AnswerPanel";

interface Props {
  turns: ChatTurn[];
}

function QuestionBubble({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-signal-300">
        {t("search.youLabel")}
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-fg">{text}</p>
    </div>
  );
}

/**
 * The Search transcript: each turn is a "You" question bubble followed by its own
 * answer state (a loading panel, the streaming or final AnswerPanel with its own
 * sources, or an error alert). Sources live on the turn, never in shared page
 * state, so each answer keeps its own citations as the conversation grows.
 */
export default function ConversationView({ turns }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      {turns.map((turn) => (
        <div key={turn.id} className="space-y-4">
          <QuestionBubble text={turn.question} />

          {/* Announce coarsely (the visible status text), not per streamed delta. */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="false"
            aria-busy={turn.status === "loading" || turn.status === "streaming"}
            className="space-y-4"
          >
          {turn.status === "loading" && (
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

          {(turn.status === "streaming" || turn.status === "success") && (
            <>
              <AnswerPanel
                response={{ answer: turn.answer, sources: turn.sources }}
                streaming={turn.status === "streaming"}
                scopeSummary={turn.scopeSummary}
              />
              {turn.errorMessage && (
                <p className="text-xs leading-relaxed text-amber">{turn.errorMessage}</p>
              )}
            </>
          )}

          {turn.status === "error" && (
            <div
              role="alert"
              className="rounded-sm border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical"
            >
              {t("common.error")}
              {turn.errorMessage && (
                <span className="ml-1 opacity-70">({turn.errorMessage})</span>
              )}
            </div>
          )}
          </div>
        </div>
      ))}
    </div>
  );
}
