import { useTranslation } from "react-i18next";
import type { AskResponse } from "../../api/types";
import SourceCard from "./SourceCard";

interface AnswerPanelProps {
  response: AskResponse;
}

export default function AnswerPanel({ response }: AnswerPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 border-l-4 border-l-brand-600 bg-white p-6 shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
          {response.answer}
        </p>
      </div>

      {response.sources.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("search.sources")}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-500">
              {response.sources.length}
            </span>
          </h2>
          <div className="space-y-3">
            {response.sources.map((src, i) => (
              <SourceCard key={`${src.document_id}-${src.building_id}-${i}`} source={src} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
