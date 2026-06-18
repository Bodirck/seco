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
      cursor: "rgba(230,110,0,0.10)",
      surface: "#FFFFFF",
    };
  }
  return {
    grid: "#2A3052",
    tick: "#626C8A",
    tooltipBg: "#1E2240",
    tooltipBorder: "#3D4570",
    tooltipText: "#E8ECF5",
    tooltipLabel: "#9AA3BD",
    cursor: "rgba(255,122,0,0.10)",
    surface: "#161A33",
  };
}
