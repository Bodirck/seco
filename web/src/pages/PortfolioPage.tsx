import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { BuildingSummary } from "../api/types";
import RiskChart from "../components/portfolio/RiskChart";
import SeverityCell from "../components/portfolio/SeverityCell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InfoTip,
  PageHeader,
  Section,
  Spinner,
} from "../components/ui";
import { cn } from "../lib/cn";
import { riskTone } from "../lib/risk";

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number | string;
  tip: string;
  accent?: "default" | "critical";
}

function KpiCard({ label, value, tip, accent = "default" }: KpiCardProps) {
  return (
    <Card className="px-5 py-4">
      <p className="flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
        {label}
        <InfoTip text={tip} />
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-3xl font-semibold tabular-nums",
          accent === "critical" ? "text-critical" : "text-fg",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Risk score pill
// ---------------------------------------------------------------------------

function RiskPill({ score }: { score: number }) {
  const rounded = Math.round(score);
  return <Badge tone={riskTone(rounded)}>{rounded}</Badge>;
}

// ---------------------------------------------------------------------------
// PortfolioPage
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
      <PageHeader title={t("portfolio.title")} meta={t("portfolio.subtitle")} />

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={t("portfolio.buildings")}
          value={buildings.length}
          tip={t("portfolio.tips.buildings")}
        />
        <KpiCard
          label={t("portfolio.totalDefects")}
          value={totalDefects}
          tip={t("portfolio.tips.totalDefects")}
        />
        <KpiCard
          label={t("portfolio.criticalDefects")}
          value={totalCritical}
          tip={t("portfolio.tips.criticalDefects")}
          accent="critical"
        />
      </div>

      {/* Risk score bar chart */}
      {buildings.length > 0 && (
        <Section title={t("common.riskScore")} tip={t("portfolio.tips.riskChart")}>
          <Card className="p-4">
            <RiskChart buildings={buildings} />
            <p className="mt-3 text-xs text-fg-faint">{t("portfolio.chartNote")}</p>
          </Card>
        </Section>
      )}

      {/* Buildings table */}
      {buildings.length === 0 ? (
        <Card className="px-5 py-4">
          <EmptyState
            title={t("ingest.emptyTitle")}
            description={t("ingest.emptyBody")}
            action={<Button to="/ingest">{t("ingest.cta")}</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-medium uppercase tracking-wide text-fg-faint">
                <th className="px-4 py-3 font-display font-medium">{t("portfolio.name")}</th>
                <th className="hidden px-4 py-3 font-display font-medium md:table-cell">
                  {t("common.address")}
                </th>
                <th className="px-4 py-3 font-display font-medium">{t("common.riskScore")}</th>
                <th className="px-4 py-3 font-display font-medium">{t("common.defects")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr
                  key={b.id}
                  className="group border-b border-line transition-colors last:border-b-0 hover:bg-ink-800/60"
                >
                  {/* Name cell links to detail */}
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/building/${b.id}`}
                      className="rounded-sm text-fg transition-colors hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-fg-muted md:table-cell">
                    {b.address}
                  </td>
                  <td className="px-4 py-3">
                    <RiskPill score={b.risk_score} />
                  </td>
                  <td className="px-4 py-3">
                    <SeverityCell
                      critical={b.critical}
                      major={b.major}
                      minor={b.minor}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/building/${b.id}`}
                      className="inline-flex items-center rounded-lg border border-line px-3 py-1 font-display text-xs font-medium text-fg-muted transition-colors hover:border-signal-400/60 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                    >
                      {t("portfolio.viewDetail")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
