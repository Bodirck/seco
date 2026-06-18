import { type ReactNode } from "react";

/**
 * Small, dependency-free tooltip primitives.
 *
 * Visibility is driven purely by CSS (hover and keyboard focus), so nothing here
 * opens a dialog or blocks the page. Use `InfoTip` for an explanatory "i" icon next
 * to a heading or label, and `Tooltip` to wrap a small inline element (a badge, a
 * number) that should explain itself on hover.
 */

function Bubble({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
    >
      {children}
    </span>
  );
}

interface InfoTipProps {
  text: string;
  label?: string;
}

/** A focusable "i" icon that reveals an explanation on hover or focus. */
export function InfoTip({ text, label = "More information" }: InfoTipProps) {
  return (
    <span className="group/info relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4.75A.75.75 0 017.75 4h.5a.75.75 0 010 1.5h-.5A.75.75 0 017 4.75zM6.75 7h1.5a.75.75 0 01.75.75v3.25h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25V8.5h-.75a.75.75 0 010-1.5z" />
        </svg>
      </button>
      <Bubble>{text}</Bubble>
    </span>
  );
}

interface TooltipProps {
  label: string;
  children: ReactNode;
}

/** Wrap a small inline element to show a tooltip on hover or focus. */
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="group/info relative inline-flex">
      {children}
      <Bubble>{label}</Bubble>
    </span>
  );
}
