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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{building.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("common.address")}: {building.address}
          {building.source && (
            <span className="ml-3 text-slate-400">{building.source}</span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-slate-400">{t("building.subtitle")}</p>
      </div>

      {/* KPI cards */}
      <KpiCards breakdown={building.breakdown} />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DisciplineChart data={building.kpis.by_discipline} />
        <SeverityChart bySeverity={building.kpis.by_severity} />
      </div>

      {/* Download buttons */}
      <div className="flex flex-wrap gap-3">
        <a
          href={api.reportUrl(numericId, "xlsx")}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("building.downloadExcel")}
        </a>
        <a
          href={api.reportUrl(numericId, "pdf")}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("building.downloadPdf")}
        </a>
      </div>

      {/* Defect list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {t("building.defectList")}
        </h2>
        <DefectTable defects={building.defects} />
      </div>

      {/* Ask about this building */}
      <AskSection buildingId={numericId} />
    </div>
  );
}
