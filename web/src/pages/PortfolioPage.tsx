import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { BuildingSummary } from "../api/types";
import RiskChart from "../components/portfolio/RiskChart";
import SeverityCell from "../components/portfolio/SeverityCell";
import { InfoTip } from "../components/ui/Tooltip";

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number | string;
  tip: string;
  accent?: "default" | "red";
}

function KpiCard({ label, value, tip, accent = "default" }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        <InfoTip text={tip} />
      </p>
      <p
        className={
          "mt-1 font-mono text-3xl font-semibold tabular-nums " +
          (accent === "red" ? "text-red-600" : "text-slate-900")
        }
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk score pill
// ---------------------------------------------------------------------------

function RiskPill({ score }: { score: number }) {
  const rounded = Math.round(score);
  let cls =
    "inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ";
  if (rounded >= 70) cls += "bg-red-100 text-red-700";
  else if (rounded >= 40) cls += "bg-amber-100 text-amber-700";
  else cls += "bg-emerald-100 text-emerald-700";
  return <span className={cls}>{rounded}</span>;
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
      <div className="flex min-h-64 items-center justify-center text-slate-500">
        <span>{t("common.loading")}</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-red-700">
        <p className="font-medium">{t("common.error")}</p>
        <p className="mt-1 text-sm text-red-500">{error}</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main view
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("portfolio.title")}</h1>
        <p className="mt-1 text-slate-500">{t("portfolio.subtitle")}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          accent="red"
        />
      </div>

      {/* Risk score bar chart */}
      {buildings.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("common.riskScore")}
            <InfoTip text={t("portfolio.tips.riskChart")} />
          </h2>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <RiskChart buildings={buildings} />
            <p className="mt-3 text-xs text-slate-400">{t("portfolio.chartNote")}</p>
          </div>
        </section>
      )}

      {/* Buildings table */}
      {buildings.length === 0 ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <section>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">{t("portfolio.name")}</th>
                  <th className="hidden px-4 py-3 md:table-cell">{t("common.address")}</th>
                  <th className="px-4 py-3">{t("common.riskScore")}</th>
                  <th className="px-4 py-3">{t("common.defects")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {buildings.map((b, idx) => (
                  <tr
                    key={b.id}
                    className={
                      "group border-b border-slate-100 transition-colors last:border-b-0 " +
                      (idx % 2 === 0 ? "bg-white" : "bg-slate-50/50") +
                      " hover:bg-brand-50/60"
                    }
                  >
                    {/* Name cell links to detail */}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        to={`/building/${b.id}`}
                        className="cursor-pointer rounded-sm text-slate-900 transition-colors hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                      >
                        {b.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
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
                        className="inline-flex cursor-pointer items-center rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                      >
                        {t("portfolio.viewDetail")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
