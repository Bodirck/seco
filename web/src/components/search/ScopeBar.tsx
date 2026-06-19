import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { FacetOption, SearchOptions, Severity } from "../../api/types";
import { CodeLabel } from "../ui";
import { useAnchoredPosition } from "../ui/Floating";
import { cn } from "../../lib/cn";

export interface ScopeState {
  communes: Set<string>;
  uses: Set<string>;
  severities: Set<Severity>;
}

export type FacetKey = "communes" | "uses" | "severities";

export function emptyScope(): ScopeState {
  return { communes: new Set(), uses: new Set(), severities: new Set() };
}

export function scopeIsEmpty(scope: ScopeState): boolean {
  return (
    scope.communes.size === 0 &&
    scope.uses.size === 0 &&
    scope.severities.size === 0
  );
}

interface Props {
  options: SearchOptions | null;
  scope: ScopeState;
  total: number;
  /** Resolved in-scope building count; null while unfiltered or still resolving. */
  resolvedCount: number | null;
  onToggle: (facet: FacetKey, value: string) => void;
  onClearAll: () => void;
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One facet dropdown (commune / use / severity). Renders its checkbox list
 * through a portal anchored to the trigger, reusing the DefectTable severity
 * filter pattern verbatim so it escapes the QUERY Panel's overflow-hidden and
 * keeps keyboard focus correct: focus moves into the popover on open, Escape and
 * an outside click close it.
 */
function FacetMenu({
  label,
  facetKey,
  options,
  selected,
  onToggle,
  renderValue,
}: {
  label: string;
  facetKey: FacetKey;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (facet: FacetKey, value: string) => void;
  renderValue: (value: string) => string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const pos = useAnchoredPosition(open, triggerRef, popRef, "bottom");
  const activeCount = selected.size;

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
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70",
          activeCount > 0
            ? "border-signal-400/60 bg-ink-800 text-signal-300"
            : "border-line bg-ink-800 text-fg-muted hover:border-signal-400/40 hover:text-signal-300",
        )}
      >
        <span className="font-display uppercase tracking-[0.16em]">{label}</span>
        {activeCount > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-signal-500/20 px-1 font-mono text-[10px] font-semibold tabular-nums text-signal-300">
            {activeCount}
          </span>
        )}
        <ChevronIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={popoverId}
            role="group"
            aria-label={label}
            tabIndex={-1}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={cn(
              "z-[60] max-h-72 w-60 -translate-x-1/2 overflow-y-auto rounded-md border border-line-strong bg-ink-800 p-1.5 shadow-lg shadow-black/40 transition-opacity duration-150 focus:outline-none",
              pos ? "opacity-100" : "opacity-0",
            )}
          >
            {options.length === 0 ? (
              <p className="px-2 py-1.5 font-mono text-[11px] uppercase tracking-wide text-fg-faint">
                {t("search.scope.noOptions")}
              </p>
            ) : (
              options.map((opt) => {
                const checked = selected.has(opt.value);
                const disabled = opt.count === 0 && !checked;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs",
                      disabled
                        ? "cursor-not-allowed text-fg-faint opacity-50"
                        : "cursor-pointer text-fg hover:bg-ink-700",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onToggle(facetKey, opt.value)}
                      className="h-3.5 w-3.5 accent-signal-500"
                    />
                    <span className="min-w-0 flex-1 truncate capitalize">
                      {renderValue(opt.value)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-fg-faint">
                      {opt.count}
                    </span>
                  </label>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * The Search scope bar: three facet dropdowns (commune, use, severity) that
 * constrain the question to a subset of the portfolio, plus a live "N of M
 * buildings" summary and a Clear all action. Scope is held by the page and is
 * sticky across the conversation.
 */
export default function ScopeBar({
  options,
  scope,
  total,
  resolvedCount,
  onToggle,
  onClearAll,
}: Props) {
  const { t } = useTranslation();
  if (!options) return null;

  const empty = scopeIsEmpty(scope);
  const severityValue = (value: string) => t(`common.${value}`);
  const identity = (value: string) => value;

  let summary: string;
  if (empty) {
    summary = t("search.scope.allBuildings");
  } else if (resolvedCount === 0) {
    summary = t("search.scope.empty");
  } else if (resolvedCount === null) {
    // Non-empty scope whose count has not arrived yet (the empty case is handled
    // above), so show a neutral resolving state, not "All buildings".
    summary = t("search.scope.resolving");
  } else {
    summary = t("search.scope.summary", { n: resolvedCount, total });
  }

  return (
    <div className="mb-5 rounded-sm border border-line bg-ink-850/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <CodeLabel accent="amber">{t("search.scope.code")}</CodeLabel>
        {!empty && (
          <button
            type="button"
            onClick={onClearAll}
            className="font-display text-[11px] uppercase tracking-[0.16em] text-fg-muted transition-colors duration-150 hover:text-signal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
          >
            {t("search.scope.clearAll")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FacetMenu
          label={t("search.scope.commune")}
          facetKey="communes"
          options={options.communes}
          selected={scope.communes}
          onToggle={onToggle}
          renderValue={identity}
        />
        <FacetMenu
          label={t("search.scope.use")}
          facetKey="uses"
          options={options.uses}
          selected={scope.uses}
          onToggle={onToggle}
          renderValue={identity}
        />
        <FacetMenu
          label={t("search.scope.severity")}
          facetKey="severities"
          options={options.severities}
          selected={scope.severities as Set<string>}
          onToggle={onToggle}
          renderValue={severityValue}
        />
        <span
          className={cn(
            "ml-auto font-mono text-[11px] tabular-nums",
            resolvedCount === 0 ? "text-critical" : "text-fg-faint",
          )}
        >
          {summary}
        </span>
      </div>
    </div>
  );
}
