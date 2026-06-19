import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { BuildingSummary } from "../api/types";
import RiskChart from "../components/portfolio/RiskChart";
import SeverityCell from "../components/portfolio/SeverityCell";
import {
  Button,
  Card,
  DecodeText,
  DossierNumber,
  EmptyState,
  InfoTip,
  Panel,
  Spinner,
  StatusTag,
} from "../components/ui";
import { caseId, sector, CODES } from "../lib/dossier";
import { cn } from "../lib/cn";
import { riskTone } from "../lib/risk";

// ---------------------------------------------------------------------------
// Sequential panel entrance: a thin wrapper that staggers the panel-in
// animation by index. Reduced-motion is handled by the keyframe itself.
// ---------------------------------------------------------------------------

function Reveal({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = { animationDelay: `${index * 50}ms` };
  return (
    <div className={cn("animate-panel-in", className)} style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI panel: a compact dossier module with a code label and a big mono figure.
// ---------------------------------------------------------------------------

interface KpiPanelProps {
  code: ReactNode;
  label: string;
  value: number | string;
  tip: string;
  ref_: string;
  accent?: "orange" | "amber";
  critical?: boolean;
}

function KpiPanel({ code, label, value, tip, ref_, accent = "orange", critical }: KpiPanelProps) {
  return (
    <Panel code={code} accent={accent} footer={ref_}>
      <p className="flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
        {label}
        <InfoTip text={tip} />
      </p>
      <DossierNumber
        value={value}
        className={cn("mt-2 block", critical ? "text-critical" : "text-fg")}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// PortfolioPage: the "ASSET REGISTER" view.
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const { t } = useTranslation();

  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .buildings()
      .then((data) => {
        if (!cancelled) {
          setBuildings(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Aggregate KPIs
  const totalDefects = buildings.reduce(
    (sum, b) => sum + b.critical + b.major + b.minor,
    0
  );
  const totalCritical = buildings.reduce((sum, b) => sum + b.critical, 0);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-fg-muted">
        <Spinner />
        <span>{t("common.loading")}</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <Card className="px-5 py-4">
        <EmptyState title={t("common.error")} description={error} />
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Main view
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Header dossier */}
      <Reveal index={0} className="mb-8">
        <Panel code={t("portfolio.code")} footer="SECTOR 03 // VERIFIED">
          <DecodeText
            as="h1"
            text={t("portfolio.title")}
            className="font-display text-2xl font-semibold uppercase tracking-wide text-fg sm:text-3xl"
          />
          <p className="mt-2 text-sm text-fg-muted">{t("portfolio.subtitle")}</p>
        </Panel>
      </Reveal>

      {/* KPI panels */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Reveal index={1}>
          <KpiPanel
            code={<>{CODES.casefile} COUNT</>}
            label={t("portfolio.buildings")}
            value={buildings.length}
            tip={t("portfolio.tips.buildings")}
            ref_="ALL ASSETS"
          />
        </Reveal>
        <Reveal index={2}>
          <KpiPanel
            code={<>{CODES.defects} TOTAL</>}
            label={t("portfolio.totalDefects")}
            value={totalDefects}
            tip={t("portfolio.tips.totalDefects")}
            ref_="ALL SEVERITIES"
          />
        </Reveal>
        <Reveal index={3}>
          <KpiPanel
            code={<>{CODES.defects} CRITICAL</>}
            label={t("portfolio.criticalDefects")}
            value={totalCritical}
            tip={t("portfolio.tips.criticalDefects")}
            ref_="PRIORITY: HIGH"
            accent="amber"
            critical
          />
        </Reveal>
      </div>

      {/* Risk index chart */}
      {buildings.length > 0 && (
        <Reveal index={4} className="mb-8">
          <Panel
            code={CODES.risk}
            title={t("common.riskScore")}
            footer="TOP 12 // DESC"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
                {t("common.riskScore")}
              </span>
              <InfoTip text={t("portfolio.tips.riskChart")} />
            </div>
            <div className="mt-3">
              <RiskChart buildings={buildings} />
            </div>
            <p className="mt-3 text-xs text-fg-faint">{t("portfolio.chartNote")}</p>
          </Panel>
        </Reveal>
      )}

      {/* Case log */}
      {buildings.length === 0 ? (
        <Reveal index={5}>
          <Panel code={CODES.casefile} title={t("portfolio.title")}>
            <EmptyState
              title={t("ingest.emptyTitle")}
              description={t("ingest.emptyBody")}
              action={<Button to="/ingest">{t("ingest.cta")}</Button>}
            />
          </Panel>
        </Reveal>
      ) : (
        <Reveal index={5}>
          <Panel
            code={t("portfolio.codeIndex")}
            title={t("nav.portfolio")}
            footer={`${buildings.length} ASSETS // VERIFIED`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong font-display text-[11px] font-medium uppercase tracking-[0.18em] text-fg-faint">
                    <th className="px-3 py-2.5 font-medium">CASE</th>
                    <th className="px-3 py-2.5 font-medium">{t("portfolio.name")}</th>
                    <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                      {t("common.address")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">{CODES.risk}</th>
                    <th className="px-3 py-2.5 font-medium">STATUS</th>
                    <th className="px-3 py-2.5 font-medium">{t("common.defects")}</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b) => {
                    const tone = riskTone(Math.round(b.risk_score));
                    const statusLabel = t(`common.${tone}`);
                    return (
                      <tr
                        key={b.id}
                        className="group border-b border-line transition-colors last:border-b-0 hover:bg-ink-800/60"
                      >
                        {/* Case id */}
                        <td className="px-3 py-3 align-middle">
                          <span className="font-mono text-xs font-medium tabular-nums text-signal-300">
                            {caseId(b.id)}
                          </span>
                          <span className="mt-0.5 block font-display text-[10px] uppercase tracking-[0.18em] text-fg-faint">
                            {sector(b.id)}
                          </span>
                        </td>
                        {/* Name links to detail */}
                        <td className="px-3 py-3 align-middle font-medium">
                          <Link
                            to={`/building/${b.id}`}
                            className="rounded-sm text-fg transition-colors hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                          >
                            {b.name}
                          </Link>
                        </td>
                        <td className="hidden px-3 py-3 align-middle text-fg-muted md:table-cell">
                          {b.address}
                        </td>
                        {/* Risk index value */}
                        <td className="px-3 py-3 align-middle">
                          <span
                            className={cn(
                              "font-mono text-base font-semibold tabular-nums",
                              tone === "critical" && "text-critical",
                              tone === "major" && "text-major",
                              tone === "minor" && "text-minor",
                            )}
                          >
                            {Math.round(b.risk_score)}
                          </span>
                        </td>
                        {/* Status tag */}
                        <td className="px-3 py-3 align-middle">
                          <StatusTag label={statusLabel} tone={tone} />
                        </td>
                        {/* Severity counts */}
                        <td className="px-3 py-3 align-middle">
                          <SeverityCell
                            critical={b.critical}
                            major={b.major}
                            minor={b.minor}
                          />
                        </td>
                        {/* View action */}
                        <td className="px-3 py-3 text-right align-middle">
                          <Link
                            to={`/building/${b.id}`}
                            aria-label={`${t("portfolio.viewDetail")} ${caseId(b.id)}`}
                            className="inline-flex items-center gap-1.5 rounded-sm border border-line px-3 py-1 font-display text-xs font-medium uppercase tracking-wide text-fg-muted transition-colors hover:border-signal-400/60 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                          >
                            {t("portfolio.viewDetail")}
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 11 11"
                              fill="none"
                              aria-hidden="true"
                              className="shrink-0"
                            >
                              <line
                                x1="2"
                                y1="5.5"
                                x2="8.5"
                                y2="5.5"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M5.8 3 8.5 5.5 5.8 8"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}
