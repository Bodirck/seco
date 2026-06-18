import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { BuildingDetail } from "../api/types";
import AskSection from "../components/building/AskSection";
import DefectTable from "../components/building/DefectTable";
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
  LocatorMap,
  Panel,
  ScanFrame,
  Spinner,
  StatusTag,
} from "../components/ui";
import { caseId, sector, CODES } from "../lib/dossier";
import { cn } from "../lib/cn";
import { riskHex, riskTone } from "../lib/risk";

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

/**
 * One data field inside the GEO INTEL dossier: an Oswald amber key label and a
 * mono value, on a single hairline-separated row.
 */
function DataField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">
        {label}
      </span>
      <span className="text-right font-mono text-sm tabular-nums text-fg">
        {value}
      </span>
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

  useEffect(() => {
    if (!id || isNaN(numericId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    api
      .building(numericId)
      .then((data) => {
        setBuilding(data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : t("common.error");
        if (msg.startsWith("404")) {
          setNotFound(true);
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, numericId, t]);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 text-fg-muted">
        <Spinner />
        {t("common.loading")}
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        title={t("building.notFound")}
        description={t("app.tagline")}
      />
    );
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

  const yearBuilt =
    building.year_built != null ? String(building.year_built) : "N/A";
  const height = building.height_m != null ? `${building.height_m} m` : "N/A";
  const hasCoordinates =
    building.latitude != null && building.longitude != null;
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

  return (
    <div className="space-y-8">
      {/* Dossier head: case number + name + risk index, the single home of
          identity for this building. */}
      <Reveal index={0}>
        <Panel
          code={
            <>
              {CODES.casefile} {case_}
            </>
          }
          footer={`REF 0xA7 // ${sector_} // VERIFIED`}
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
                  <StatusTag label={building.source} tone="signal" />
                )}
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

      {/* Scan visual + geo intel, equal size side by side. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal index={1}>
          <Panel
            code="SCAN // VOLUME"
            footer={`REF 0xB4 // ${case_} // POINT CLOUD`}
          >
            <ScanFrame label={case_} className="h-[300px]">
              <div className="absolute right-3 top-3">
                <CodeLabel className="text-[10px]">{sector_}</CodeLabel>
              </div>
            </ScanFrame>
          </Panel>
        </Reveal>

        <Reveal index={2}>
          <Panel
            code={CODES.geo}
            title={t("building.map")}
            footer={`REF 0xC2 // ${coordinates}`}
          >
            <LocatorMap
              lat={building.latitude}
              lon={building.longitude}
              name={building.name}
              emptyLabel={t("building.noCoordinates")}
              zoom={9}
              className="h-[300px]"
            />
          </Panel>
        </Reveal>
      </div>

      {/* Dossier data record: the fields, in their own full-width panel. */}
      <Reveal index={3}>
        <Panel code="DATA // RECORD" footer={`REF 0xD1 // ${case_}`}>
          <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            <div className="flex items-baseline justify-between gap-3 py-2">
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">
                COORD
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-sm tabular-nums text-fg">
                  {coordinates}
                </span>
                <InfoTip text={t("building.tips.map")} />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-amber">
                STATUS
              </span>
              <StatusTag label={statusLabel} tone={scoreTone} />
            </div>
            <DataField label="YEAR" value={yearBuilt} />
            <DataField label="ARCHITECT" value="N/A" />
            <DataField label="HEIGHT" value={height} />
          </dl>
        </Panel>
      </Reveal>

      {/* Severity KPI tiles (risk index lives in the dossier head). */}
      <Reveal index={3}>
        <KpiCards breakdown={building.breakdown} buildingId={building.id} />
      </Reveal>

      {/* Defect charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Reveal index={4}>
          <DisciplineChart data={building.kpis.by_discipline} />
        </Reveal>
        <Reveal index={5}>
          <SeverityChart bySeverity={building.kpis.by_severity} />
        </Reveal>
      </div>

      {/* Client report export */}
      <Reveal index={6}>
        <Panel
          code="REPORT // EXPORT"
          title={t("building.downloads")}
          footer={`REF 0xE1 // ${case_} // CLIENT-READY`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              href={api.reportUrl(numericId, "xlsx")}
              variant="primary"
              leftIcon={<DownloadIcon />}
            >
              {t("building.downloadExcel")}
            </Button>
            <Button
              href={api.reportUrl(numericId, "pdf")}
              variant="secondary"
              leftIcon={<DownloadIcon />}
            >
              {t("building.downloadPdf")}
            </Button>
            <InfoTip text={t("building.tips.downloads")} />
          </div>
        </Panel>
      </Reveal>

      {/* Defect log */}
      <Reveal index={7}>
        <Panel
          code={CODES.defects}
          title={t("building.defectList")}
          footer={`REF 0xF3 // ${building.defects.length} ENTRIES // ${sector_}`}
        >
          <div className="mb-3 flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
            {t("building.defectList")}
            <InfoTip text={t("building.tips.defectList")} />
          </div>
          <DefectTable defects={building.defects} />
        </Panel>
      </Reveal>

      {/* Natural-language query */}
      <Reveal index={8}>
        <AskSection buildingId={numericId} caseId={case_} />
      </Reveal>
    </div>
  );
}
