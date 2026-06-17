import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Defect, Severity } from "../../api/types";

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
      return "bg-slate-100 text-slate-600";
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
          const baseClass =
            s === "critical"
              ? "border-red-300 text-red-700"
              : s === "major"
                ? "border-amber-300 text-amber-700"
                : "border-slate-300 text-slate-600";
          return (
            <button
              key={s}
              onClick={() => toggleFilter(s)}
              className={`rounded border px-2 py-0.5 text-xs font-medium transition-opacity ${baseClass} ${
                active ? "opacity-100" : "opacity-40"
              }`}
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
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {defect.discipline}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{defect.element}</td>
                  <td className="px-3 py-2 text-slate-600">{defect.description}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {defect.location}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${severityClasses(defect.severity)}`}
                    >
                      {t(`common.${defect.severity}`)}
                    </span>
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
