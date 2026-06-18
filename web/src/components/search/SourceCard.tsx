import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/types";
import { Panel } from "../../components/ui";
import { caseId, sector } from "../../lib/dossier";

interface SourceCardProps {
  source: Source;
  index: number;
}

/**
 * One cited passage rendered as a small dossier tile: a "SOURCE //" coded title
 * bar carrying the source index, the building case id and the document id in mono,
 * a View link back to the building dossier, and the quoted snippet as the body.
 * The codes (SOURCE //, DOC, the case id) are chrome and stay in English.
 */
export default function SourceCard({ source, index }: SourceCardProps) {
  const { t } = useTranslation();

  const code = `SOURCE // ${String(index + 1).padStart(2, "0")}`;

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
        <span className="font-mono text-xs tabular-nums text-fg-faint">
          DOC #{source.document_id}
        </span>
        <Link
          to={`/building/${source.building_id}`}
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
      <p className="text-sm italic leading-relaxed text-fg-muted">
        &ldquo;{source.snippet}&rdquo;
      </p>
    </Panel>
  );
}
