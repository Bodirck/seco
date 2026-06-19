import {
  Suspense,
  lazy,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
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

  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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

  useEffect(() => {
    if (!id || isNaN(numericId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);

    api
      .building(numericId)
      .then((data) => {
        if (!cancelled) setBuilding(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, numericId]);

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

  if (error) {
    return (
      <div className="flex min-h-48 items-center justify-center text-critical">
        {t("common.error")} {error}
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
                {building.source && <StatusTag label={building.source} tone="signal" />}
              </div>
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
          onCycleSort={(key) => setDefectSort((prev) => nextSort(prev, key))}
          onToggleFilter={(s) => setDefectFilters((prev) => nextFilters(prev, s))}
        />
      </Panel>
    </Reveal>
  );

  // -------------------------------------------------------------------------
  // Main view: persistent ask bar + tabs
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
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
