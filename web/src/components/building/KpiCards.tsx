import { useTranslation } from "react-i18next";
import type { Breakdown } from "../../api/types";

interface Props {
  breakdown: Breakdown;
}

export default function KpiCards({ breakdown }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Risk score */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("common.riskScore")}
        </p>
        <p className="mt-1 text-3xl font-bold text-slate-900">
          {breakdown.risk_score.toFixed(1)}
        </p>
      </div>

      {/* Critical */}
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-red-600">
          {t("common.critical")}
        </p>
        <p className="mt-1 text-3xl font-bold text-red-700">{breakdown.critical}</p>
      </div>

      {/* Major */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
          {t("common.major")}
        </p>
        <p className="mt-1 text-3xl font-bold text-amber-700">{breakdown.major}</p>
      </div>

      {/* Minor */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("common.minor")}
        </p>
        <p className="mt-1 text-3xl font-bold text-slate-700">{breakdown.minor}</p>
      </div>
    </div>
  );
}
