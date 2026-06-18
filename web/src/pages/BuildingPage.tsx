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
import LocatorMap from "../components/ui/LocatorMap";
import { InfoTip } from "../components/ui/Tooltip";

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

function InfoRow({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="flex items-center gap-1.5 text-sm text-slate-500">
        {label}
        {tip && <InfoTip text={tip} />}
      </dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value}</dd>
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
      <div className="flex min-h-48 items-center justify-center text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-48 items-center justify-center text-slate-500">
        {t("building.notFound")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-48 items-center justify-center text-red-600">
        {t("common.error")} {error}
      </div>
    );
  }

  if (!building) return null;

  const yearBuilt = building.year_built != null ? String(building.year_built) : "-";
  const height =
    building.height_m != null ? `${building.height_m} m` : "-";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {building.name}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>
            <span className="text-slate-400">{t("common.address")}:</span>{" "}
            {building.address}
          </span>
          {building.source && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {building.source}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-slate-400">{t("building.subtitle")}</p>
      </div>

      {/* KPI cards */}
      <KpiCards breakdown={building.breakdown} />

      {/* Overview: info card + locator map */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">
          {t("building.overview")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <dl className="divide-y divide-slate-100">
              <InfoRow label={t("common.address")} value={building.address} />
              <InfoRow
                label={t("building.yearBuilt")}
                value={yearBuilt}
              />
              <InfoRow label={t("building.height")} value={height} />
              <InfoRow label={t("common.source")} value={building.source || "-"} />
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
              {t("building.map")}
              <InfoTip text={t("building.tips.map")} />
            </h3>
            <LocatorMap
              lat={building.latitude}
              lon={building.longitude}
              name={building.name}
              emptyLabel={t("building.noCoordinates")}
            />
          </div>
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DisciplineChart data={building.kpis.by_discipline} />
        <SeverityChart bySeverity={building.kpis.by_severity} />
      </div>

      {/* Client report downloads */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">
          {t("building.downloads")}
          <InfoTip text={t("building.tips.downloads")} />
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={api.reportUrl(numericId, "xlsx")}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <DownloadIcon />
            {t("building.downloadExcel")}
          </a>
          <a
            href={api.reportUrl(numericId, "pdf")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <DownloadIcon />
            {t("building.downloadPdf")}
          </a>
        </div>
      </section>

      {/* Defect list */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">
          {t("building.defectList")}
          <InfoTip text={t("building.tips.defectList")} />
        </h2>
        <DefectTable defects={building.defects} />
      </section>

      {/* Ask about this building */}
      <AskSection buildingId={numericId} />
    </div>
  );
}
