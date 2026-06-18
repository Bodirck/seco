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
import { riskHex } from "../../lib/risk";
import { useTheme } from "../../theme/ThemeProvider";
import { chartColors } from "../../lib/chartTheme";

interface Props {
  buildings: BuildingSummary[];
}

function truncate(name: string, max = 16): string {
  return name.length > max ? name.slice(0, max - 1) + "..." : name;
}

export default function RiskChart({ buildings }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = chartColors(theme);

  const data = buildings
    .slice(0, 12)
    .map((b) => ({ name: truncate(b.name), score: Math.round(b.risk_score), fullName: b.name }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: c.cursor }}
          formatter={(value: number) => [value, t("common.riskScore")]}
          labelFormatter={(_label, payload) =>
            payload?.[0]?.payload?.fullName ?? _label
          }
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            background: c.tooltipBg,
            border: `1px solid ${c.tooltipBorder}`,
            color: c.tooltipText,
          }}
          labelStyle={{ color: c.tooltipLabel }}
          itemStyle={{ color: c.tooltipText }}
        />
        <Bar dataKey="score" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={riskHex(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
