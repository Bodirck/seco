import { useTranslation } from "react-i18next";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { InfoTip } from "../ui/Tooltip";

interface Props {
  bySeverity: { critical: number; major: number; minor: number };
}

const COLORS = {
  critical: "#ef4444",
  major: "#f59e0b",
  minor: "#10b981",
};

export default function SeverityChart({ bySeverity }: Props) {
  const { t } = useTranslation();

  const data = [
    { name: t("common.critical"), value: bySeverity.critical, color: COLORS.critical },
    { name: t("common.major"), value: bySeverity.major, color: COLORS.major },
    { name: t("common.minor"), value: bySeverity.minor, color: COLORS.minor },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {t("building.bySeverity")}
        <InfoTip text={t("building.tips.bySeverity")} />
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "none",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#64748b" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
