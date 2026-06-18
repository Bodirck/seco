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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-xs font-semibold tabular-nums text-brand-700">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-slate-700">
          {t("common.building")}{" "}
          <span className="font-mono tabular-nums">{source.building_id}</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-slate-400">
          #{source.document_id}
        </span>
        <Link
          to={`/building/${source.building_id}`}
          className="ml-auto inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          {t("portfolio.viewDetail")}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
      <p className="text-sm italic leading-relaxed text-slate-600">
        &ldquo;{source.snippet}&rdquo;
      </p>
    </div>
  );
}
