import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/types";
import { Card } from "../../components/ui";

interface SourceCardProps {
  source: Source;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-signal-500/15 font-mono text-xs font-semibold tabular-nums text-signal-300">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-fg">
          {t("common.building")}{" "}
          <span className="font-mono tabular-nums">{source.building_id}</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-fg-faint">
          #{source.document_id}
        </span>
        <Link
          to={`/building/${source.building_id}`}
          className="ml-auto inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line px-3 font-display text-xs font-semibold text-fg transition duration-150 ease-out hover:border-signal-400/60 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
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
      <p className="text-sm italic leading-relaxed text-fg-muted">
        &ldquo;{source.snippet}&rdquo;
      </p>
    </Card>
  );
}
