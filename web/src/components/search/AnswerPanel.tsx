import { useTranslation } from "react-i18next";
import type { AskResponse } from "../../api/types";
import { CodeLabel, Panel } from "../../components/ui";
import SourceCard from "./SourceCard";

interface AnswerPanelProps {
  response: AskResponse;
}

/**
 * The grounded answer, framed as an "INTEL // RESPONSE" dossier panel with an
 * orange left accent, followed by the cited sources as small dossier tiles. The
 * codes (INTEL // RESPONSE, REF footer) are chrome; the readable note headings
 * stay in i18n.
 */
export default function AnswerPanel({ response }: AnswerPanelProps) {
  const { t } = useTranslation();
  const sourceCount = response.sources.length;

  return (
    <div className="space-y-6">
      <Panel
        code="INTEL // RESPONSE"
        accent="orange"
        windowButtons
        footer="GROUNDED // VERIFIED"
        className="animate-panel-in border-l-2 border-l-signal-500"
      >
        <p className="whitespace-pre-wrap font-sans leading-relaxed text-fg">
          {response.answer}
        </p>
      </Panel>

      {sourceCount > 0 && (
        <div className="animate-panel-in [animation-delay:60ms]">
          <h2 className="mb-3 flex items-center gap-2">
            <CodeLabel accent="amber">{t("search.sources")}</CodeLabel>
            <span className="rounded-sm border border-line bg-ink-800 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-amber">
              {String(sourceCount).padStart(2, "0")}
            </span>
          </h2>
          <div className="space-y-3">
            {response.sources.map((src, i) => (
              <SourceCard
                key={`${src.document_id}-${src.building_id}-${i}`}
                source={src}
                index={i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
