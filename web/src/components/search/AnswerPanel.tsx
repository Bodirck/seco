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
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
          {response.answer}
        </p>
      </div>

      {response.sources.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("search.sources")}
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
