import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/types";
import { Panel } from "../../components/ui";
import { caseId, sector } from "../../lib/dossier";
import { cn } from "../../lib/cn";

interface SourceCardProps {
  source: Source;
  index: number;
}

/**
 * One cited passage as a dossier tile. The header carries the case id, the real
 * building name and commune, and the document id; a relevance bar shows how well
 * the passage matched; the body shows the snippet and expands to the full
 * retrieved chunk; the View link opens the building dossier on its defect log.
 * The codes (SOURCE //, DOC, the case id) are chrome and stay in English.
 */
export default function SourceCard({ source, index }: SourceCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const code = `SOURCE // ${String(index + 1).padStart(2, "0")}`;
  const hasMore =
    !!source.full_text && source.full_text.trim().length > source.snippet.trim().length;
  const body = expanded && source.full_text ? source.full_text : source.snippet;
  const pct =
    source.score !== null
      ? Math.round(Math.min(Math.max(source.score, 0), 1) * 100)
      : null;

  return (
    <Panel
      code={code}
      windowButtons={false}
      footer={`${caseId(source.building_id)} // ${sector(source.building_id)}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-sm font-semibold tabular-nums text-signal-300">
          {caseId(source.building_id)}
        </span>
        {source.building_name && (
          <span className="min-w-0 truncate text-sm font-medium text-fg">
            {source.building_name}
          </span>
        )}
        {source.commune && (
          <span className="font-mono text-xs text-fg-faint">{source.commune}</span>
        )}
        <span className="font-mono text-xs tabular-nums text-fg-faint">
          DOC #{source.document_id}
        </span>
        <Link
          to={`/building/${source.building_id}?tab=defects`}
          state={{ back: { to: "/search", labelKey: "building.backToSearch" } }}
          aria-label={`${t("portfolio.viewDetail")} ${caseId(source.building_id)}`}
          className="ml-auto inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-line px-3 font-display text-xs font-semibold uppercase tracking-wide text-fg transition duration-150 ease-out hover:border-signal-400/60 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
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

      {pct !== null && (
        <div
          className="mb-3 flex items-center gap-2"
          aria-label={`${t("search.relevance")}: ${pct}%`}
        >
          <span className="font-display text-[10px] uppercase tracking-[0.16em] text-fg-faint">
            {t("search.relevance")}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
            <span
              className="block h-full rounded-full bg-signal-500"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="font-mono text-[11px] tabular-nums text-fg-muted">{pct}%</span>
        </div>
      )}

      <p
        className={cn(
          "whitespace-pre-wrap text-sm italic leading-relaxed text-fg-muted",
          expanded && "max-h-60 overflow-y-auto",
        )}
      >
        &ldquo;{body}&rdquo;
      </p>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-signal-300 transition-colors duration-150 hover:text-signal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
        >
          {expanded ? t("search.showLess") : t("search.showFullPassage")}
        </button>
      )}
    </Panel>
  );
}
