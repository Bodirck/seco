/**
 * Single source of truth for severity and risk colors in the First Light dark system.
 *
 * Severity meaning is unchanged: critical = red, major = amber, minor = green
 * (tuned for the dark theme). Risk thresholds: score >= 70 maps to the critical
 * color, >= 40 to the major color, otherwise the minor color.
 *
 * Keep this module free of React so it can be imported anywhere (charts, badges,
 * gauges) without pulling in component code.
 */

export type Severity = "critical" | "major" | "minor";

/** Hex value for each severity, matching the tailwind tokens. */
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "#FB5E6B",
  major: "#F5B544",
  minor: "#34D399",
};

/**
 * Map a severity to the tone consumed by Badge and other tone-aware primitives.
 * It is the identity for severities today, but routing through this helper keeps
 * call sites stable if the tone vocabulary ever widens.
 */
export function severityTone(sev: Severity): Severity {
  return sev;
}

/** Hex color for a numeric risk score, following the documented thresholds. */
export function riskHex(score: number): string {
  if (score >= 70) return SEVERITY_HEX.critical;
  if (score >= 40) return SEVERITY_HEX.major;
  return SEVERITY_HEX.minor;
}

/** Severity tone for a numeric risk score, following the documented thresholds. */
export function riskTone(score: number): Severity {
  if (score >= 70) return "critical";
  if (score >= 40) return "major";
  return "minor";
}
