import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/types";

interface SourceCardProps {
  source: Source;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-slate-700">
          {t("common.building", "Building")} {source.building_id}
        </span>
        <span className="text-xs text-slate-400">
          doc #{source.document_id}
        </span>
        <Link
          to={`/building/${source.building_id}`}
          className="ml-auto text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          {t("portfolio.viewDetail", "View")}
        </Link>
      </div>
      <p className="text-sm leading-relaxed text-slate-600 italic">
        &ldquo;{source.snippet}&rdquo;
      </p>
    </div>
  );
}
