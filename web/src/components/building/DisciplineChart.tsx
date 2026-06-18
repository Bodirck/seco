import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, InfoTip } from "../ui";

interface Props {
  data: { discipline: string; count: number }[];
}

export default function DisciplineChart({ data }: Props) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
        {t("building.byDiscipline")}
        <InfoTip text={t("building.tips.byDiscipline")} />
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1B2433" />
          <XAxis
            dataKey="discipline"
            tick={{ fontSize: 11, fill: "#61708A" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#61708A" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(34,211,238,0.06)" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              background: "#0D131F",
              border: "1px solid #2A3650",
              color: "#E7EEF8",
              boxShadow: "none",
            }}
          />
          <Bar dataKey="count" fill="#22D3EE" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
