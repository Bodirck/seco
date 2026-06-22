import {
  Suspense,
  lazy,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { AskResponse, BuildingDetail, Severity } from "../api/types";
import AskBar from "../components/building/AskBar";
import DefectTable, {
  DEFAULT_SORT,
  SEVERITY_KEYS,
  nextFilters,
  nextSort,
  type SortState,
} from "../components/building/DefectTable";
import DisciplineChart from "../components/building/DisciplineChart";
import KpiCards from "../components/building/KpiCards";
import SeverityChart from "../components/building/SeverityChart";
import {
  Badge,
  Button,
  CodeLabel,
  DecodeText,
  DossierNumber,
  EmptyState,
  InfoTip,
  Panel,
  ScanFrame,
  Spinner,
  StatusTag,
  Tabs,
} from "../components/ui";
import { caseId, sector, CODES } from "../lib/dossier";
import { cn } from "../lib/cn";
import { riskHex, riskTone } from "../lib/risk";
import { useCachedResource } from "../lib/pageCache";

// Lazy so leaflet and its CSS only download when the Case File tab renders the map.
const LocatorMap = lazy(() => import("../components/ui/LocatorMap"));

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5" />
      <path d="M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sequential panel entrance: a thin wrapper that staggers the panel-in
// animation by index, reset per tab. Reduced-motion is handled by the keyframe.
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

export default function BuildingPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);

  // When we arrive from another page (a source-card or a register-row deep link
  // sets a `back` target in location.state), offer a labelled way back there.
  // Snapshot it once at mount: switching tabs rewrites the ?tab= param via
  // setSearchParams, which drops location.state, so reading it live would make
  // the button vanish on the KPI and Case File tabs. The page does not unmount
  // on a tab change, so the snapshot persists across all tabs.
  const location = useLocation();
  const [back] = useState<{ to: string; labelKey: string } | null>(() => {
    const s = location.state as
      | { back?: { to: string; labelKey: string }; fromSearch?: boolean }
      | null;
    if (s?.back) return s.back;
    if (s?.fromSearch) return { to: "/search", labelKey: "building.backToSearch" };
    return null;
  });

  // The dossier is fetched once per building id and cached app-wide, so going
  // back to a building you already opened is instant and keeps its data.
  const {
    data: building,
    loading,
    error,
  } = useCachedResource<BuildingDetail>(`building:${id ?? "none"}`, () => {
    if (!id || Number.isNaN(numericId)) {
      return Promise.reject(new ApiError(404, "invalid building id"));
    }
    return api.building(numericId);
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const errorMessage =
    error && !notFound
      ? error instanceof Error
        ? error.message
        : String(error)
      : null;

  // RAG state lives here, above the tabs, so a tab switch never wipes a question
  // or a returned answer.
  const [question, setQuestion] = useState("");
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // Defect-table sort/filter live here too, so they survive a tab switch (the
  // defect panel unmounts when another tab is active).
  const [defectSort, setDefectSort] = useState<SortState>(DEFAULT_SORT);
  const [defectFilters, setDefectFilters] = useState<Set<Severity>>(
    () => new Set(SEVERITY_KEYS),
  );
  // Discipline filter for the defect log: null means all disciplines are shown.
  const [defectDisciplines, setDefectDisciplines] = useState<Set<string> | null>(null);

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAskError(null);
    setAskResponse(null);
    try {
      const res = await api.ask(q, numericId);
      setAskResponse(res);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setAsking(false);
    }
  }

  // Loading / not-found / error gates render OUTSIDE the tab shell.
  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 text-fg-muted">
        <Spinner />
        {t("common.loading")}
      </div>
    );
  }

  if (notFound) {
    return <EmptyState title={t("building.notFound")} description={t("app.tagline")} />;
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-48 items-center justify-center text-critical">
        {t("common.error")} {errorMessage}
      </div>
    );
  }

  if (!building) return null;

  const case_ = caseId(building.id);
  const sector_ = sector(building.id);

  const hasCoordinates = building.latitude != null && building.longitude != null;
  const coordinates = hasCoordinates
    ? `${building.latitude?.toFixed(4)}, ${building.longitude?.toFixed(4)}`
    : "N/A";

  const score = building.breakdown.risk_score;
  const scoreColor = riskHex(score);
  const scoreTone = riskTone(score);
  const statusLabel =
    scoreTone === "critical"
      ? t("common.critical")
      : scoreTone === "major"
        ? t("common.major")
        : t("common.minor");

  // Real EUBUCCO attributes for the Case File strip. Null fields are omitted so we
  // never print "N/A"; footprint area is real, use/floors are ML-estimated (the
  // InfoTip says so). Replaces the deleted Data Record block with non-redundant facts.
  const cap = (u: string) => u.charAt(0).toUpperCase() + u.slice(1);
  const buildingAttrs: ({ label: string; value: string; tip?: string } | null)[] = [
    building.use_type
      ? {
          label: t("building.use"),
          value: cap(building.use_type) + (building.use_subtype ? ` (${building.use_subtype})` : ""),
          tip: t("building.tips.use"),
        }
      : null,
    building.floors != null
      ? { label: t("building.floors"), value: String(building.floors), tip: t("building.tips.floors") }
      : null,
    building.height_m != null
      ? { label: t("building.height"), value: `${building.height_m} m`, tip: t("building.tips.height") }
      : null,
    building.footprint_area_m2 != null
      ? { label: t("building.footprint"), value: `${building.footprint_area_m2} m²`, tip: t("building.tips.footprint") }
      : null,
    building.year_built != null
      ? { label: t("building.yearBuilt"), value: String(building.year_built) }
      : null,
  ];
  const visibleAttrs = buildingAttrs.filter(
    (x): x is { label: string; value: string; tip?: string } => x !== null,
  );

  // -------------------------------------------------------------------------
  // Tab 1: Case File (identity head + scan + geo)
  // -------------------------------------------------------------------------
  const caseFileTab = (
    <div className="space-y-6">
      <Reveal index={0}>
        <Panel
          code={
            <>
              {CODES.casefile} {case_}
            </>
          }
          footer={`${sector_} // VERIFIED`}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Identity block */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-3">
                <DossierNumber value={case_} />
                <CodeLabel accent="amber" className="text-[11px]">
                  {sector_}
                </CodeLabel>
              </div>
              <DecodeText
                as="h1"
                text={building.name}
                className="mt-3 block font-display text-2xl font-semibold uppercase tracking-wide text-fg sm:text-3xl"
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
                <span>{building.address}</span>
                {building.source && (
                  <StatusTag label={building.source} code={CODES.source} tone="signal" />
                )}
              </div>

              {visibleAttrs.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {visibleAttrs.map((a) => (
                    <span key={a.label} className="inline-flex items-baseline gap-1.5">
                      <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-fg-faint">
                        {a.label}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-fg">{a.value}</span>
                      {a.tip && <InfoTip text={a.tip} />}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Risk index headline metric */}
            <div className="shrink-0 border-line lg:border-l lg:pl-6">
              <p className="flex items-center justify-start gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-faint lg:justify-end">
                {CODES.risk}
                <InfoTip text={t("building.tips.riskScore")} />
              </p>
              <div className="mt-1 flex items-center gap-3 lg:justify-end">
                <span
                  className="font-mono text-5xl font-bold leading-none tabular-nums sm:text-6xl"
                  style={{ color: scoreColor }}
                >
                  {score.toFixed(1)}
                </span>
                <Badge tone={scoreTone}>{statusLabel}</Badge>
              </div>
            </div>
          </div>
        </Panel>
      </Reveal>

      <Reveal index={1}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel code="SCAN // VOLUME" footer={`${case_} // POINT CLOUD`}>
            <ScanFrame label={case_} className="h-[300px]">
              <div className="absolute right-3 top-3">
                <CodeLabel className="text-[10px]">{sector_}</CodeLabel>
              </div>
            </ScanFrame>
          </Panel>

          <Panel code={CODES.geo} title={t("building.map")} footer={coordinates}>
            <Suspense
              fallback={
                <div className="flex h-[300px] items-center justify-center rounded-sm border border-line bg-ink-800">
                  <Spinner />
                </div>
              }
            >
              <LocatorMap
                lat={building.latitude}
                lon={building.longitude}
                name={building.name}
                emptyLabel={t("building.noCoordinates")}
                zoom={9}
                className="h-[300px]"
              />
            </Suspense>
          </Panel>
        </div>
      </Reveal>
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab 2: KPI (severity tiles + discipline/severity charts)
  // -------------------------------------------------------------------------
  const kpiTab = (
    <div className="space-y-6">
      <Reveal index={0}>
        <KpiCards breakdown={building.breakdown} buildingId={building.id} />
      </Reveal>
      <Reveal index={1}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DisciplineChart data={building.kpis.by_discipline} />
          <SeverityChart bySeverity={building.kpis.by_severity} />
        </div>
      </Reveal>
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab 3: Defect Log (export toolbar + defect table)
  // -------------------------------------------------------------------------
  const defectsTab = (
    <Reveal index={0}>
      <Panel code={CODES.defects} footer={`${building.defects.length} ENTRIES // ${sector_}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wide text-fg">
            {t("building.defectList")}
            <InfoTip text={t("building.tips.defectList")} />
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button href={api.reportUrl(numericId, "xlsx")} variant="primary" leftIcon={<DownloadIcon />}>
              {t("building.downloadExcel")}
            </Button>
            <Button href={api.reportUrl(numericId, "pdf")} variant="secondary" leftIcon={<DownloadIcon />}>
              {t("building.downloadPdf")}
            </Button>
            <InfoTip text={t("building.tips.downloads")} />
          </div>
        </div>
        <DefectTable
          defects={building.defects}
          sort={defectSort}
          filters={defectFilters}
          disciplines={defectDisciplines}
          onCycleSort={(key) => setDefectSort((prev) => nextSort(prev, key))}
          onToggleFilter={(s) => setDefectFilters((prev) => nextFilters(prev, s))}
          onSetDisciplines={setDefectDisciplines}
        />
      </Panel>
    </Reveal>
  );

  // -------------------------------------------------------------------------
  // Main view: persistent ask bar + tabs
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {back && (
        <Link
          to={back.to}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line px-3 font-display text-xs font-semibold uppercase tracking-wide text-fg-muted transition duration-150 ease-out hover:border-signal-400/60 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
        >
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
            <path d="M15 19l-7-7 7-7" />
          </svg>
          {t(back.labelKey)}
        </Link>
      )}

      <AskBar
        caseId={case_}
        question={question}
        onQuestionChange={setQuestion}
        onAsk={handleAsk}
        loading={asking}
        error={askError}
        response={askResponse}
      />

      <Tabs
        paramKey="tab"
        defaultId="casefile"
        ariaLabel={building.name}
        items={[
          { id: "casefile", label: t("building.tabCaseFile"), content: caseFileTab },
          { id: "kpi", label: t("building.tabKpi"), content: kpiTab },
          { id: "defects", label: t("building.tabDefectLog"), content: defectsTab },
        ]}
      />
    </div>
  );
}
