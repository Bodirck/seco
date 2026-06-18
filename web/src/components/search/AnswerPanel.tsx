import { useTranslation } from "react-i18next";
import type { AskResponse } from "../../api/types";
import { Card } from "../../components/ui";
import SourceCard from "./SourceCard";

interface AnswerPanelProps {
  response: AskResponse;
}

export default function AnswerPanel({ response }: AnswerPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card className="border-l-2 border-l-signal-500 p-6">
        <p className="whitespace-pre-wrap font-sans leading-relaxed text-fg">
          {response.answer}
        </p>
      </Card>

      {response.sources.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
            {t("search.sources")}
            <span className="rounded-md bg-ink-700 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-fg-muted">
              {response.sources.length}
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
