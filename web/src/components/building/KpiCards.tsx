import { useTranslation } from "react-i18next";
import type { Breakdown } from "../../api/types";
import { InfoTip } from "../ui/Tooltip";

interface Props {
  breakdown: Breakdown;
}

export default function KpiCards({ breakdown }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Risk score */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-700">
          {t("common.riskScore")}
          <InfoTip text={t("building.tips.riskScore")} />
        </p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-brand-700">
          {breakdown.risk_score.toFixed(1)}
        </p>
      </div>

      {/* Critical */}
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-red-600">
          {t("common.critical")}
          <InfoTip text={t("building.tips.critical")} />
        </p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-red-700">
          {breakdown.critical}
        </p>
      </div>

      {/* Major */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-600">
          {t("common.major")}
          <InfoTip text={t("building.tips.major")} />
        </p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-amber-700">
          {breakdown.major}
        </p>
      </div>

      {/* Minor */}
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-600">
          {t("common.minor")}
          <InfoTip text={t("building.tips.minor")} />
        </p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-700">
          {breakdown.minor}
        </p>
      </div>
    </div>
  );
}
