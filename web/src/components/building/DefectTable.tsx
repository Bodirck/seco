import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Defect, Severity } from "../../api/types";
import { Badge, Tooltip } from "../ui";
import { cn } from "../../lib/cn";
import { severityTone } from "../../lib/risk";

interface Props {
  defects: Defect[];
}

const SEVERITIES: Severity[] = ["critical", "major", "minor"];

/**
 * Filter chip styling. Active chips use the severity wash and color; idle chips
 * are a quiet hairline outline that warms to the severity color on hover.
 */
function chipClasses(severity: Severity, active: boolean): string {
  if (active) {
    switch (severity) {
      case "critical":
        return "border-critical/40 bg-critical/15 text-critical";
      case "major":
        return "border-major/40 bg-major/15 text-major";
      case "minor":
        return "border-minor/40 bg-minor/15 text-minor";
    }
  }
  switch (severity) {
    case "critical":
      return "border-line bg-ink-800 text-fg-faint hover:border-critical/40 hover:text-critical";
    case "major":
      return "border-line bg-ink-800 text-fg-faint hover:border-major/40 hover:text-major";
    case "minor":
      return "border-line bg-ink-800 text-fg-faint hover:border-minor/40 hover:text-minor";
  }
}

export default function DefectTable({ defects }: Props) {
  const { t } = useTranslation();
  const [activeFilters, setActiveFilters] = useState<Set<Severity>>(
    new Set(SEVERITIES),
  );

  function toggleFilter(s: Severity) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        // Keep at least one filter active
        if (next.size > 1) next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  }

  const visible = defects.filter((d) => activeFilters.has(d.severity));

  return (
    <div>
      {/* Filter controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
          {t("building.filterSeverity")}
        </span>
        {SEVERITIES.map((s) => {
          const active = activeFilters.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleFilter(s)}
              aria-pressed={active}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs font-medium transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70",
                chipClasses(s, active),
              )}
            >
              {t(`common.${s}`)}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-ink-800">
            <tr>
              {(
                [
                  "building.discipline",
                  "building.element",
                  "building.description",
                  "building.location",
                  "building.severity",
                ] as const
              ).map((key) => (
                <th
                  key={key}
                  className="px-3 py-2.5 text-left font-display text-xs font-medium uppercase tracking-wide text-fg-faint"
                >
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-fg-muted"
                >
                  {t("common.defects")}: 0
                </td>
              </tr>
            ) : (
              visible.map((defect, idx) => (
                <tr
                  key={idx}
                  className="transition-colors duration-150 hover:bg-ink-800"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-fg">
                    {defect.discipline}
                  </td>
                  <td className="px-3 py-2.5 text-fg">{defect.element}</td>
                  <td className="px-3 py-2.5 text-fg-muted">
                    {defect.description}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-fg-muted">
                    {defect.location}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Tooltip label={t(`building.tips.${defect.severity}`)}>
                      <Badge tone={severityTone(defect.severity)}>
                        {t(`common.${defect.severity}`)}
                      </Badge>
                    </Tooltip>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
