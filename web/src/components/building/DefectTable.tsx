import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Defect, Severity } from "../../api/types";
import { Tooltip } from "../ui/Tooltip";

interface Props {
  defects: Defect[];
}

const SEVERITIES: Severity[] = ["critical", "major", "minor"];

function severityClasses(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-700";
    case "major":
      return "bg-amber-100 text-amber-700";
    case "minor":
      return "bg-emerald-100 text-emerald-700";
  }
}

/** Filter chip styling for the active (selected) and inactive states. */
function chipClasses(severity: Severity, active: boolean): string {
  switch (severity) {
    case "critical":
      return active
        ? "border-red-300 bg-red-100 text-red-700"
        : "border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:text-red-600";
    case "major":
      return active
        ? "border-amber-300 bg-amber-100 text-amber-700"
        : "border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-600";
    case "minor":
      return active
        ? "border-emerald-300 bg-emerald-100 text-emerald-700"
        : "border-slate-200 bg-white text-slate-400 hover:border-emerald-200 hover:text-emerald-600";
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
        <span className="text-xs font-medium text-slate-500">
          {t("building.filterSeverity")}
        </span>
        {SEVERITIES.map((s) => {
          const active = activeFilters.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleFilter(s)}
              aria-pressed={active}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${chipClasses(
                s,
                active,
              )}`}
            >
              {t(`common.${s}`)}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
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
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  {t("common.defects")}: 0
                </td>
              </tr>
            ) : (
              visible.map((defect, idx) => (
                <tr key={idx} className="transition-colors hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {defect.discipline}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{defect.element}</td>
                  <td className="px-3 py-2 text-slate-600">{defect.description}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {defect.location}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Tooltip label={t(`building.tips.${defect.severity}`)}>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${severityClasses(
                          defect.severity,
                        )}`}
                      >
                        {t(`common.${defect.severity}`)}
                      </span>
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
