/**
 * Stable decorative codes for the "CLASSIFIED" dossier chrome. These derive
 * deterministic alphanumeric labels from a building id so each building reads
 * like a classified file (case number, sector). Pure functions, no deps.
 *
 * These strings are UI chrome (English, not translated). Any human-readable
 * label shown next to them goes through i18n; the codes themselves are fixed.
 */

/** Case number for a building, e.g. caseId(47) -> "B-047" (zero-padded to 3). */
export function caseId(id: number): string {
  const n = Math.abs(Math.trunc(id));
  return `B-${String(n).padStart(3, "0")}`;
}

/** Sector label, e.g. sector(2) -> "SECTOR 03" (id modulo 6 plus 1, two digits). */
export function sector(id: number): string {
  const n = Math.abs(Math.trunc(id));
  const s = (n % 6) + 1;
  return `SECTOR ${String(s).padStart(2, "0")}`;
}

/** Constant code labels used as title-bar / chrome text across the dossier UI. */
export const CODES = {
  casefile: "CASEFILE //",
  geo: "GEO INTEL",
  risk: "RISK INDEX",
  defects: "DEFECT LOG",
  query: "QUERY //",
  ops: "OPS // SETTINGS",
  intake: "INTAKE // IMPORT",
  status: "STATUS:",
} as const;

export type CodeKey = keyof typeof CODES;
