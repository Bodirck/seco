import { useTranslation } from "react-i18next";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, InfoTip } from "../ui";
import { SEVERITY_HEX } from "../../lib/risk";

interface Props {
  bySeverity: { critical: number; major: number; minor: number };
}

export default function SeverityChart({ bySeverity }: Props) {
  const { t } = useTranslation();

  const data = [
    {
      name: t("common.critical"),
      value: bySeverity.critical,
      color: SEVERITY_HEX.critical,
    },
    {
      name: t("common.major"),
      value: bySeverity.major,
      color: SEVERITY_HEX.major,
    },
    {
      name: t("common.minor"),
      value: bySeverity.minor,
      color: SEVERITY_HEX.minor,
    },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
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
            stroke="#0D131F"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              background: "#0D131F",
              border: "1px solid #2A3650",
              color: "#E7EEF8",
              boxShadow: "none",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#9AA7BD" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
