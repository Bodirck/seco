import { useEffect, useState } from "react";
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
  Card,
  EmptyState,
  InfoTip,
  LocatorMap,
  PageHeader,
  Section,
  Spinner,
} from "../components/ui";
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

/** One quiet row inside the Overview card: a faint label and a mono value. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-fg-faint">
        {label}
      </dt>
      <dd className="text-right font-mono text-sm tabular-nums text-fg">{value}</dd>
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

  const yearBuilt =
    building.year_built != null ? String(building.year_built) : "-";
  const height = building.height_m != null ? `${building.height_m} m` : "-";
  const hasCoordinates =
    building.latitude != null && building.longitude != null;
  const coordinates = hasCoordinates
    ? `${building.latitude?.toFixed(4)}, ${building.longitude?.toFixed(4)}`
    : "-";

  const score = building.breakdown.risk_score;
  const scoreColor = riskHex(score);
  const scoreTone = riskTone(score);

  return (
    <div className="space-y-8">
      {/* Single home of identity: name, one meta line (address + source), and
          the risk score promoted as the headline metric. */}
      <PageHeader
        title={building.name}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{building.address}</span>
            {building.source && (
              <Badge tone="neutral">{building.source}</Badge>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="flex items-center justify-end gap-1.5 font-display text-xs font-medium uppercase tracking-widest text-fg-faint">
                {t("common.riskScore")}
                <InfoTip text={t("building.tips.riskScore")} />
              </p>
              <p
                className="font-mono text-4xl font-bold leading-none tabular-nums sm:text-5xl"
                style={{ color: scoreColor }}
              >
                {score.toFixed(1)}
              </p>
            </div>
            <Badge tone={scoreTone} className="self-start">
              {scoreTone === "critical"
                ? t("common.critical")
                : scoreTone === "major"
                  ? t("common.major")
                  : t("common.minor")}
            </Badge>
          </div>
        }
      />

      {/* Severity KPI cards (risk score now lives in the header). */}
      <KpiCards breakdown={building.breakdown} />

      {/* Overview: info card + locator map. Identity rows removed to avoid
          duplicating the header. */}
      <Section title={t("building.overview")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="p-5">
            <dl className="divide-y divide-line">
              <InfoRow label={t("building.yearBuilt")} value={yearBuilt} />
              <InfoRow label={t("building.height")} value={height} />
              <InfoRow label={t("building.map")} value={coordinates} />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
              {t("building.map")}
              <InfoTip text={t("building.tips.map")} />
            </h3>
            <LocatorMap
              lat={building.latitude}
              lon={building.longitude}
              name={building.name}
              emptyLabel={t("building.noCoordinates")}
            />
          </Card>
        </div>
      </Section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DisciplineChart data={building.kpis.by_discipline} />
        <SeverityChart bySeverity={building.kpis.by_severity} />
      </div>

      {/* Client report downloads */}
      <Section title={t("building.downloads")} tip={t("building.tips.downloads")}>
        <div className="flex flex-wrap gap-3">
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
        </div>
      </Section>

      {/* Defect list */}
      <Section
        title={t("building.defectList")}
        tip={t("building.tips.defectList")}
      >
        <DefectTable defects={building.defects} />
      </Section>

      {/* Ask about this building */}
      <AskSection buildingId={numericId} />
    </div>
  );
}
