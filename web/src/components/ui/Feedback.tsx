import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SpinnerProps {
  size?: "sm" | "md";
}

/**
 * Signal-colored loading spinner. A thin ring with a brighter arc, sized to sit
 * inline (sm) or as a standalone indicator (md). Animation is paused under
 * prefers-reduced-motion via the global rule in index.css.
 */
export function Spinner({ size = "md" }: SpinnerProps) {
  const dim = size === "sm" ? "h-4 w-4 border-2" : "h-6 w-6 border-2";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-block animate-spin rounded-full border-line-strong border-t-signal-400",
        dim,
      )}
    />
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  /** Optional action node, typically a <Button>. */
  action?: ReactNode;
}

/**
 * Centered empty / no-results state with a faint inline-SVG glyph, a display
 * title, a muted description, and an optional action below.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mb-4 h-10 w-10 text-fg-faint"
      >
        <path d="M2.25 12c0-4.59 0-6.885 1.318-8.341C4.886 2.25 7.007 2.25 11.25 2.25h1.5c4.243 0 6.364 0 7.682 1.409C21.75 5.115 21.75 7.41 21.75 12s0 6.885-1.318 8.341c-1.318 1.409-3.439 1.409-7.682 1.409h-1.5c-4.243 0-6.364 0-7.682-1.409C2.25 18.885 2.25 16.59 2.25 12Z" />
        <path d="M8 12h8M8 8.5h8M8 15.5h5" />
      </svg>
      <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
