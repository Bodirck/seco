import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "../../lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  /** URL search-param key, e.g. "tab". Makes tabs deep-linkable: /portfolio?tab=parc */
  paramKey: string;
  /** The tab shown when the param is absent or invalid. Never written to the URL, so the canonical path stays clean. */
  defaultId: string;
  ariaLabel: string;
  className?: string;
}

/**
 * URL-driven tab strip following the WAI-ARIA Tabs pattern. The active tab is read
 * from a ?<paramKey>= search param (deep-linkable, back-button friendly, shareable)
 * and validated against the known ids, falling back to defaultId for junk or a
 * missing value. Switching uses { replace: true } so flipping tabs does not flood
 * history, and merges existing params so a coexisting ?q= survives.
 *
 * Only the active panel is mounted, so heavy panels (recharts, the leaflet map) only
 * initialise when their tab is viewed. Automatic activation (arrow keys move and
 * select) keeps the keyboard model simple; the panel mount cost is small for the two
 * or three tabs here. Tabs are 44px tall and reuse the signal accent of the Panel
 * title bar, so the strip reads as existing chrome rather than a new control.
 */
export function Tabs({ items, paramKey, defaultId, ariaLabel, className }: TabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const ids = items.map((i) => i.id);
  const raw = searchParams.get(paramKey);
  const active = raw && ids.includes(raw) ? raw : defaultId;

  // Strip a present-but-invalid tab param so a stale/shared junk link is normalized
  // to the clean canonical path (the default tab is already shown via `active`).
  useEffect(() => {
    if (raw && !ids.includes(raw)) {
      const next = new URLSearchParams(searchParams);
      next.delete(paramKey);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  function select(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id === defaultId) next.delete(paramKey);
    else next.set(paramKey, id);
    setSearchParams(next, { replace: true });
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    select(items[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  const activeItem = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className={className}>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap items-stretch gap-1 border-b border-line">
        {items.map((item, i) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${paramKey}-${item.id}`}
              aria-selected={selected}
              aria-controls={selected ? `panel-${paramKey}-${item.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative -mb-px inline-flex min-h-11 items-center gap-2 px-3 py-2 font-display text-xs font-medium uppercase tracking-[0.18em] cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70",
                selected
                  ? "border-b-2 border-signal-500 text-tab-active"
                  : "border-b-2 border-transparent text-fg-muted hover:text-signal-300",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`panel-${paramKey}-${activeItem.id}`}
        aria-labelledby={`tab-${paramKey}-${activeItem.id}`}
        tabIndex={0}
        className="pt-6 focus:outline-none"
      >
        {activeItem.content}
      </div>
    </div>
  );
}
