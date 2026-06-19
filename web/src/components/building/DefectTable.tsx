import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Defect, Severity } from "../../api/types";
import { Badge, Tooltip } from "../ui";
import { useAnchoredPosition } from "../ui/Floating";
import { cn } from "../../lib/cn";
import { severityTone } from "../../lib/risk";

export type ColumnKey = "discipline" | "element" | "description" | "location" | "severity";

interface ColumnDef {
  key: ColumnKey;
  i18n: string;
  /** Hide on small screens to avoid a horizontal-scroll trap; description always shows and wraps. */
  hideSmall?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "discipline", i18n: "building.discipline" },
  { key: "element", i18n: "building.element", hideSmall: true },
  { key: "description", i18n: "building.description" },
  { key: "location", i18n: "building.location", hideSmall: true },
  { key: "severity", i18n: "building.severity" },
];

export const SEVERITY_KEYS: Severity[] = ["critical", "major", "minor"];
const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 3, major: 2, minor: 1 };

export type SortDir = "asc" | "desc";
export interface SortState {
  key: ColumnKey;
  dir: SortDir;
}

// Default view: sorted by severity with the worst defects first, so a triager sees
// the criticals on top without any interaction.
export const DEFAULT_SORT: SortState = { key: "severity", dir: "asc" };

/** Cycle a column's sort: a new column starts asc, then asc -> desc -> back to default. */
export function nextSort(prev: SortState, key: ColumnKey): SortState {
  if (prev.key !== key) return { key, dir: "asc" };
  if (prev.dir === "asc") return { key, dir: "desc" };
  return DEFAULT_SORT;
}

/** Toggle a severity in the filter set, always keeping at least one active. */
export function nextFilters(prev: Set<Severity>, s: Severity): Set<Severity> {
  const next = new Set(prev);
  if (next.has(s)) {
    if (next.size > 1) next.delete(s);
  } else {
    next.add(s);
  }
  return next;
}

interface Props {
  defects: Defect[];
  sort: SortState;
  filters: Set<Severity>;
  onCycleSort: (key: ColumnKey) => void;
  onToggleFilter: (s: Severity) => void;
}

function comparator(a: Defect, b: Defect, sort: SortState): number {
  let base: number;
  if (sort.key === "severity") {
    base = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
  } else {
    base = String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "fr", {
      sensitivity: "base",
    });
  }
  return sort.dir === "asc" ? base : -base;
}

/** Stacked up/down chevrons that highlight the active sort direction. */
function SortGlyph({ state }: { state: "none" | "asc" | "desc" }) {
  return (
    <span className="ml-1 inline-flex flex-col leading-none" aria-hidden="true">
      <svg width="7" height="4" viewBox="0 0 7 4" className={state === "asc" ? "text-signal-300" : "text-fg-muted"}>
        <path d="M3.5 0 7 4H0z" fill="currentColor" />
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" className={cn("mt-px", state === "desc" ? "text-signal-300" : "text-fg-muted")}>
        <path d="M3.5 4 0 0h7z" fill="currentColor" />
      </svg>
    </span>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 3h12l-4.6 5.4v4.1l-2.8 1.4V8.4L2 3z" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Severity filter popover anchored to the Severity header. Renders through a portal
 * (same fixed-position helper as the tooltip) so it escapes the table's
 * overflow-x-auto instead of being clipped. Focus moves into the popover on open, so
 * the next Tab lands on the first checkbox; Escape and outside-click close it. Keeps
 * at least one severity active.
 */
function SeverityFilter({
  filters,
  onToggle,
}: {
  filters: Set<Severity>;
  onToggle: (s: Severity) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const pos = useAnchoredPosition(open, triggerRef, popRef, "bottom");
  const isFiltering = filters.size < SEVERITY_KEYS.length;

  useEffect(() => {
    if (!open) return;
    popRef.current?.focus();
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("building.filter")}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70",
          isFiltering
            ? "border-signal-400/60 text-signal-300"
            : "border-line text-fg-faint hover:border-signal-400/60 hover:text-signal-300",
        )}
      >
        <FilterIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={popoverId}
            role="group"
            aria-label={t("building.filter")}
            tabIndex={-1}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={cn(
              "z-[60] w-44 -translate-x-1/2 rounded-md border border-line-strong bg-ink-800 p-1.5 shadow-lg shadow-black/40 transition-opacity duration-150 focus:outline-none",
              pos ? "opacity-100" : "opacity-0",
            )}
          >
            {SEVERITY_KEYS.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-fg hover:bg-ink-700"
              >
                <input
                  type="checkbox"
                  checked={filters.has(s)}
                  onChange={() => onToggle(s)}
                  className="h-3.5 w-3.5 accent-signal-500"
                />
                <span className="font-mono uppercase tracking-wide">{t(`common.${s}`)}</span>
              </label>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function DefectTable({ defects, sort, filters, onCycleSort, onToggleFilter }: Props) {
  const { t } = useTranslation();

  const visible = useMemo(() => {
    const filtered = defects.filter((d) => filters.has(d.severity));
    return [...filtered].sort((a, b) => comparator(a, b, sort));
  }, [defects, filters, sort]);

  function ariaSort(key: ColumnKey): "ascending" | "descending" | "none" {
    if (sort.key !== key) return "none";
    return sort.dir === "asc" ? "ascending" : "descending";
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-ink-800">
          <tr className="font-display text-[11px] font-medium uppercase tracking-[0.18em] text-fg-faint">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                aria-sort={ariaSort(col.key)}
                className={cn("px-3 py-2 text-left font-medium", col.hideSmall && "hidden md:table-cell")}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCycleSort(col.key)}
                    aria-label={`${t("building.sort")}: ${t(col.i18n)}`}
                    className="inline-flex items-center rounded-sm py-1 font-display uppercase tracking-[0.18em] transition-colors hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                  >
                    {t(col.i18n)}
                    <SortGlyph state={sort.key === col.key ? sort.dir : "none"} />
                  </button>
                  {col.key === "severity" && (
                    <SeverityFilter filters={filters} onToggle={onToggleFilter} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visible.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-3 py-6 text-center font-mono text-xs uppercase tracking-wide text-fg-muted"
              >
                {t("common.defects")}: 0
              </td>
            </tr>
          ) : (
            visible.map((defect, idx) => (
              <tr key={idx} className="transition-colors duration-150 hover:bg-ink-800/60">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs uppercase tracking-wide text-fg">
                  {defect.discipline}
                </td>
                <td className="hidden px-3 py-2.5 text-fg md:table-cell">{defect.element}</td>
                <td className="px-3 py-2.5 text-fg-muted">{defect.description}</td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-fg-muted md:table-cell">
                  {defect.location}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Tooltip label={t(`building.tips.${defect.severity}`)} focusable={false}>
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
  );
}
