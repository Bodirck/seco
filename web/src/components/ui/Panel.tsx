import { type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { CodeLabel } from "./CodeLabel";

interface PanelProps {
  /** Left-aligned code label in the title bar (e.g. "CASEFILE // B-047"). */
  code?: ReactNode;
  /** Human-readable title, shown after the code in the title bar. */
  title?: ReactNode;
  /** Accent family for the title-bar rule and code. Defaults to orange. */
  accent?: "orange" | "amber";
  /** Show the decorative window buttons (minus / square / X). Defaults to true. */
  windowButtons?: boolean;
  /** Optional faint technical micro-text footer (e.g. "REF 0xA7 // SECTOR 03"). */
  footer?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * The signature module of the "CLASSIFIED" system: a rectangular panel with an
 * accent title bar carrying a left code label and decorative window controls on
 * the right, a bordered ink-850 body, and an optional faint micro-text footer.
 * Composes on Card so the surface tokens stay shared. The window buttons are
 * non-interactive decoration (aria-hidden).
 */
export function Panel({
  code,
  title,
  accent = "orange",
  windowButtons = true,
  footer,
  className,
  children,
}: PanelProps) {
  const ruleColor = accent === "amber" ? "bg-amber" : "bg-signal-500";
  const hasTitleBar = code != null || title != null || windowButtons;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border border-line bg-ink-850",
        className,
      )}
    >
      {hasTitleBar ? (
        <div className="flex items-center gap-3 border-b border-line bg-ink-800 px-3 py-2">
          {/* Accent rule on the left edge of the title bar. */}
          <span aria-hidden="true" className={cn("h-3.5 w-1 shrink-0 rounded-sm", ruleColor)} />
          <div className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
            {code != null ? <CodeLabel accent={accent}>{code}</CodeLabel> : null}
            {title != null ? (
              <span className="truncate font-display text-xs font-medium uppercase tracking-wide text-fg-muted">
                {title}
              </span>
            ) : null}
          </div>
          {windowButtons ? <WindowButtons /> : null}
        </div>
      ) : null}

      <div className="p-4 sm:p-5">{children}</div>

      {footer ? (
        <div className="border-t border-line px-3 py-1.5">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
            {footer}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The three decorative title-bar glyphs: minus, square, X. Pure chrome. */
function WindowButtons() {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-2 text-fg-faint">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
        <line x1="2" y1="5.5" x2="9" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
        <rect x="2.1" y="2.1" width="6.8" height="6.8" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
        <line x1="2.5" y1="2.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="8.5" y1="2.5" x2="2.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
