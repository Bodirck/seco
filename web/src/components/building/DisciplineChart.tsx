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
import { InfoTip, Panel } from "../ui";
import { useTheme } from "../../theme/ThemeProvider";
import { chartColors } from "../../lib/chartTheme";

interface Props {
  data: { discipline: string; count: number }[];
}

export default function DisciplineChart({ data }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = chartColors(theme);
  // Orange bars, slightly darkened in light mode for contrast.
  const barFill = theme === "light" ? "#E66E00" : "#FF7A00";

  if (data.length === 0) {
    return null;
  }

  return (
    <Panel code="DEFECTS // DISCIPLINE" title={t("building.byDiscipline")}>
      <div className="mb-2 flex items-center justify-end">
        <InfoTip text={t("building.tips.byDiscipline")} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
          <XAxis
            dataKey="discipline"
            tick={{ fontSize: 11, fill: c.tick }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: c.tick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: c.cursor }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              color: c.tooltipText,
              boxShadow: "none",
            }}
            labelStyle={{ color: c.tooltipLabel }}
            itemStyle={{ color: c.tooltipText }}
          />
          <Bar dataKey="count" fill={barFill} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}
