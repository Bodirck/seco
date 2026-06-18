import type { Theme } from "../theme/ThemeProvider";

/**
 * Recharts takes concrete color values, not CSS classes, so the chart chrome
 * (grid, axis ticks, tooltip) needs theme-aware colors. The bar and slice fills
 * stay on the fixed severity/risk hex from lib/risk (vivid on both themes).
 */
export interface ChartColors {
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
  cursor: string;
  /** Card surface, used as the stroke that separates donut slices. */
  surface: string;
}

export function chartColors(theme: Theme): ChartColors {
  if (theme === "light") {
    return {
      grid: "#E2E8F0",
      tick: "#64748B",
      tooltipBg: "#FFFFFF",
      tooltipBorder: "#CBD5E1",
      tooltipText: "#0F172A",
      tooltipLabel: "#475569",
      cursor: "rgba(8,145,178,0.08)",
      surface: "#FFFFFF",
    };
  }
  return {
    grid: "#1B2433",
    tick: "#61708A",
    tooltipBg: "#0D131F",
    tooltipBorder: "#2A3650",
    tooltipText: "#E7EEF8",
    tooltipLabel: "#9AA7BD",
    cursor: "rgba(34,211,238,0.06)",
    surface: "#0D131F",
  };
}
