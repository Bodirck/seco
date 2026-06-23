import { useMemo, type CSSProperties, type ReactNode } from "react";
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
  Tabs,
} from "../components/ui";
import { caseId, sector, CODES } from "../lib/dossier";
import { cn } from "../lib/cn";
import { riskTone } from "../lib/risk";
import { useCachedResource, usePersistentState } from "../lib/pageCache";
import ColumnFilter from "../components/portfolio/ColumnFilter";

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
// PortfolioPage: the "ASSET REGISTER" view, split into a Portfolio overview tab
// (KPIs + risk chart) and a clean Asset Index tab (the register table).
// ---------------------------------------------------------------------------

const RISK_TONES = ["critical", "major", "minor"] as const;
const SEVERITIES = ["critical", "major", "minor"] as const;

interface RegisterFilters {
  name: string;
  address: string;
  riskMin: string;
  riskMax: string;
  statuses: string[];
  severities: string[];
}

const EMPTY_FILTERS: RegisterFilters = {
  name: "",
  address: "",
  riskMin: "",
  riskMax: "",
  statuses: [],
  severities: [],
};

export default function PortfolioPage() {
  const { t } = useTranslation();

  // The register is fetched once and cached app-wide, so returning to this page
  // is instant and never refetches or loses the loaded list.
  const { data, loading, error } = useCachedResource<BuildingSummary[]>(
    "portfolio:buildings",
    () => api.buildings(),
  );
  const buildings = data ?? [];
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : String(error)
    : null;

  // Excel-style per-column filters over the loaded register, kept in the page
  // cache so they survive navigating to a building and back.
  const [filters, setFilters] = usePersistentState<RegisterFilters>(
    "portfolio:filters",
    EMPTY_FILTERS,
  );
  const setField = (key: keyof RegisterFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const toggleIn = (key: "statuses" | "severities", value: string) =>
    setFilters((f) => {
      const list = f[key];
      return {
        ...f,
        [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
      };
    });
  const filtersActive =
    filters.name.trim() !== "" ||
    filters.address.trim() !== "" ||
    filters.riskMin !== "" ||
    filters.riskMax !== "" ||
    filters.statuses.length > 0 ||
    filters.severities.length > 0;

  const filtered = useMemo(() => {
    const name = filters.name.trim().toLowerCase();
    const address = filters.address.trim().toLowerCase();
    const min = filters.riskMin === "" ? null : Number(filters.riskMin);
    const max = filters.riskMax === "" ? null : Number(filters.riskMax);
    return buildings.filter((b) => {
      if (name && !b.name.toLowerCase().includes(name)) return false;
      if (address && !(b.address ?? "").toLowerCase().includes(address)) return false;
      const score = Math.round(b.risk_score);
      if (min !== null && !Number.isNaN(min) && score < min) return false;
      if (max !== null && !Number.isNaN(max) && score > max) return false;
      if (filters.statuses.length && !filters.statuses.includes(riskTone(score)))
        return false;
      if (
        filters.severities.length &&
        !filters.severities.some((s) => b[s as "critical" | "major" | "minor"] > 0)
      )
        return false;
      return true;
    });
  }, [buildings, filters]);

  // Optional sort by the CASE index column. null keeps the default risk-desc order
  // the API returns; clicking the header cycles ascending, descending, then off.
  // Persisted so it survives navigating to a building and back.
  const [caseSort, setCaseSort] = usePersistentState<"asc" | "desc" | null>(
    "portfolio:caseSort",
    null,
  );
  const cycleCaseSort = () =>
    setCaseSort((s) => (s === null ? "asc" : s === "asc" ? "desc" : null));

  const sorted = useMemo(() => {
    if (caseSort === null) return filtered;
    const arr = [...filtered].sort((a, b) => a.id - b.id);
    return caseSort === "desc" ? arr.reverse() : arr;
  }, [filtered, caseSort]);

  // Aggregate KPIs
  const totalDefects = buildings.reduce(
    (sum, b) => sum + b.critical + b.major + b.minor,
    0
  );
  const totalCritical = buildings.reduce((sum, b) => sum + b.critical, 0);

  // Loading / error gates render OUTSIDE the tab shell so they are never hidden.
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-fg-muted">
        <Spinner />
        <span>{t("common.loading")}</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card className="px-5 py-4">
        <EmptyState title={t("common.error")} description={errorMessage} />
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Tab 1: Portfolio overview (KPIs + risk index chart)
  // -------------------------------------------------------------------------
  const overviewTab = (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Reveal index={0}>
          <KpiPanel
            code={<>{CODES.casefile} COUNT</>}
            label={t("portfolio.buildings")}
            value={buildings.length}
            tip={t("portfolio.tips.buildings")}
            ref_="ALL ASSETS"
          />
        </Reveal>
        <Reveal index={1}>
          <KpiPanel
            code={<>{CODES.defects} TOTAL</>}
            label={t("portfolio.totalDefects")}
            value={totalDefects}
            tip={t("portfolio.tips.totalDefects")}
            ref_="ALL SEVERITIES"
          />
        </Reveal>
        <Reveal index={2}>
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

      {buildings.length > 0 && (
        <Reveal index={3} className="mt-4">
          <Panel code={CODES.risk} title={t("common.riskScore")} footer="TOP 12 // DESC">
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
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab 2: Asset Index (the clean register table)
  // -------------------------------------------------------------------------
  const indexTab =
    buildings.length === 0 ? (
      <Reveal index={0}>
        <Panel code={CODES.casefile} title={t("portfolio.title")}>
          <EmptyState
            title={t("ingest.emptyTitle")}
            description={t("ingest.emptyBody")}
            action={<Button to="/ingest">{t("ingest.cta")}</Button>}
          />
        </Panel>
      </Reveal>
    ) : (
      <Reveal index={0}>
        <Panel
          code={t("portfolio.codeIndex")}
          title={t("nav.portfolio")}
          footer={`${filtered.length} / ${buildings.length} ASSETS // VERIFIED`}
        >
          {filtersActive && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-display text-[11px] uppercase tracking-[0.18em] text-fg-faint">
                {t("portfolio.matchCount", {
                  shown: filtered.length,
                  total: buildings.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex h-7 items-center rounded-sm border border-line px-2.5 font-display text-[11px] font-semibold uppercase tracking-wide text-fg-muted transition-colors hover:border-signal-400/60 hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
              >
                {t("portfolio.clearFilters")}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong font-display text-[11px] font-medium uppercase tracking-[0.18em] text-fg-faint">
                  <th className="px-3 py-2.5 font-medium">
                    <button
                      type="button"
                      onClick={cycleCaseSort}
                      aria-label={`${t("building.sort")}: CASE`}
                      className="inline-flex items-center gap-1.5 font-display text-[11px] font-medium uppercase tracking-[0.18em] text-fg-faint transition-colors hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                    >
                      CASE
                      <span
                        aria-hidden="true"
                        className={cn(
                          "text-[10px] leading-none",
                          caseSort ? "text-signal-300" : "text-fg-faint/50",
                        )}
                      >
                        {caseSort === "asc" ? "▲" : caseSort === "desc" ? "▼" : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {t("portfolio.name")}
                      <ColumnFilter
                        label={`${t("building.filter")}: ${t("portfolio.name")}`}
                        active={filters.name.trim() !== ""}
                      >
                        <input
                          type="text"
                          value={filters.name}
                          onChange={(e) => setField("name", e.target.value)}
                          placeholder={t("portfolio.filterText")}
                          className="w-full rounded-sm border border-line bg-ink-900 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-fg placeholder-fg-faint focus:border-signal-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                        />
                      </ColumnFilter>
                    </span>
                  </th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      {t("common.address")}
                      <ColumnFilter
                        label={`${t("building.filter")}: ${t("common.address")}`}
                        active={filters.address.trim() !== ""}
                      >
                        <input
                          type="text"
                          value={filters.address}
                          onChange={(e) => setField("address", e.target.value)}
                          placeholder={t("portfolio.filterText")}
                          className="w-full rounded-sm border border-line bg-ink-900 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-fg placeholder-fg-faint focus:border-signal-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                        />
                      </ColumnFilter>
                    </span>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {CODES.risk}
                      <ColumnFilter
                        label={`${t("building.filter")}: ${CODES.risk}`}
                        active={filters.riskMin !== "" || filters.riskMax !== ""}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={filters.riskMin}
                            onChange={(e) => setField("riskMin", e.target.value)}
                            placeholder={t("portfolio.filterMin")}
                            className="w-1/2 rounded-sm border border-line bg-ink-900 px-2 py-1.5 text-xs font-normal tabular-nums text-fg placeholder-fg-faint focus:border-signal-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                          />
                          <span className="text-fg-faint">-</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={filters.riskMax}
                            onChange={(e) => setField("riskMax", e.target.value)}
                            placeholder={t("portfolio.filterMax")}
                            className="w-1/2 rounded-sm border border-line bg-ink-900 px-2 py-1.5 text-xs font-normal tabular-nums text-fg placeholder-fg-faint focus:border-signal-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                          />
                        </div>
                      </ColumnFilter>
                    </span>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      STATUS
                      <ColumnFilter
                        label={`${t("building.filter")}: STATUS`}
                        active={filters.statuses.length > 0}
                      >
                        <div className="flex flex-col">
                          {RISK_TONES.map((tone) => (
                            <label
                              key={tone}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-normal text-fg hover:bg-ink-700"
                            >
                              <input
                                type="checkbox"
                                checked={filters.statuses.includes(tone)}
                                onChange={() => toggleIn("statuses", tone)}
                                className="h-3.5 w-3.5 accent-signal-500"
                              />
                              <span className="font-mono uppercase tracking-wide">
                                {t(`common.${tone}`)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </ColumnFilter>
                    </span>
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {t("common.defects")}
                      <ColumnFilter
                        label={`${t("building.filter")}: ${t("common.defects")}`}
                        active={filters.severities.length > 0}
                      >
                        <div className="flex flex-col">
                          {SEVERITIES.map((sev) => (
                            <label
                              key={sev}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-normal text-fg hover:bg-ink-700"
                            >
                              <input
                                type="checkbox"
                                checked={filters.severities.includes(sev)}
                                onChange={() => toggleIn("severities", sev)}
                                className="h-3.5 w-3.5 accent-signal-500"
                              />
                              <span className="font-mono uppercase tracking-wide">
                                {t(`common.${sev}`)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </ColumnFilter>
                    </span>
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => {
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
                          state={{
                            back: {
                              to: "/portfolio?tab=parc",
                              labelKey: "building.backToRegister",
                            },
                          }}
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
                          state={{
                            back: {
                              to: "/portfolio?tab=parc",
                              labelKey: "building.backToRegister",
                            },
                          }}
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
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center font-mono text-xs uppercase tracking-wide text-fg-muted"
                    >
                      {t("portfolio.matchCount", { shown: 0, total: buildings.length })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>
    );

  // -------------------------------------------------------------------------
  // Main view: persistent header + tabs
  // -------------------------------------------------------------------------
  return (
    <div>
      <Reveal index={0} className="mb-6">
        <Panel code={t("portfolio.code")} footer="SECTOR 03 // VERIFIED">
          <DecodeText
            as="h1"
            text={t("portfolio.title")}
            className="font-display text-2xl font-semibold uppercase tracking-wide text-fg sm:text-3xl"
          />
          <p className="mt-2 text-sm text-fg-muted">{t("portfolio.subtitle")}</p>
        </Panel>
      </Reveal>

      <Tabs
        paramKey="tab"
        defaultId="portfolio"
        ariaLabel={t("nav.portfolio")}
        items={[
          { id: "portfolio", label: t("portfolio.tabPortfolio"), content: overviewTab },
          { id: "parc", label: t("portfolio.tabParcIndex"), content: indexTab },
        ]}
      />
    </div>
  );
}
