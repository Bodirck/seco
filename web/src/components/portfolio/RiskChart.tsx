import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BuildingSummary } from "../../api/types";
import { useTranslation } from "react-i18next";

interface Props {
  buildings: BuildingSummary[];
}

function truncate(name: string, max = 16): string {
  return name.length > max ? name.slice(0, max - 1) + "..." : name;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#ef4444"; // red-500
  if (score >= 40) return "#f59e0b"; // amber-500
  return "#10b981"; // emerald-500, low risk reads as positive
}

export default function RiskChart({ buildings }: Props) {
  const { t } = useTranslation();

  const data = buildings
    .slice(0, 12)
    .map((b) => ({ name: truncate(b.name), score: Math.round(b.risk_score), fullName: b.name }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          formatter={(value: number) => [value, t("common.riskScore")]}
          labelFormatter={(_label, payload) =>
            payload?.[0]?.payload?.fullName ?? _label
          }
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          }}
        />
        <Bar dataKey="score" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={scoreColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
