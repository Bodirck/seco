import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useAnchoredPosition } from "./Floating";

/**
 * Small, dependency-free tooltip primitives for the CLASSIFIED dark theme.
 *
 * The bubble is rendered through a portal at document.body with position:fixed, so
 * it escapes the `overflow-hidden` on Panel and the `overflow-x-auto` on the defect
 * table that used to clip it. It opens above the trigger, flips below when near the
 * top edge, clamps to the viewport, and wraps long text instead of truncating.
 *
 * Visibility is a small open flag set by hover, keyboard focus, and a tap toggle (so
 * the content is reachable on touch, where hover does not exist). While open, an
 * outside pointer-down or Escape dismisses it. The bubble keeps pointer-events-none
 * so it never steals hover, and is wired to the trigger via aria-describedby.
 *
 * Use `InfoTip` for an explanatory "i" icon next to a label, and `Tooltip` to wrap a
 * small inline element (a badge, a number). For purely decorative inline tooltips
 * (e.g. a severity badge that already shows its label), pass `focusable={false}` so
 * the wrapper does not add a keyboard tab stop per row.
 */

/** While open, dismiss on Escape or an outside pointer-down. */
function useDismiss(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!triggerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, triggerRef]);
}

function Bubble({
  open,
  anchorRef,
  id,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  children: ReactNode;
}) {
  const floatRef = useRef<HTMLSpanElement>(null);
  const pos = useAnchoredPosition(open, anchorRef, floatRef, "top");

  if (!open) return null;

  return createPortal(
    <span
      ref={floatRef}
      role="tooltip"
      id={id}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
      }}
      className={cn(
        "pointer-events-none z-[60] w-max max-w-xs -translate-x-1/2 rounded-md border border-line-strong bg-ink-800 px-3 py-2 text-xs font-normal leading-snug text-fg shadow-lg shadow-black/40 transition-opacity duration-150",
        pos ? "opacity-100" : "opacity-0",
      )}
    >
      {children}
    </span>,
    document.body,
  );
}

interface InfoTipProps {
  text: string;
  label?: string;
}

/** A focusable "i" icon that reveals an explanation on hover, focus, or tap. */
export function InfoTip({ text, label = "More information" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const id = useId();
  useDismiss(open, setOpen, ref);

  return (
    <span className="inline-flex align-middle">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") setOpen(false);
        }}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line text-fg-faint transition-colors hover:border-signal-400/60 hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
      >
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4.75A.75.75 0 017.75 4h.5a.75.75 0 010 1.5h-.5A.75.75 0 017 4.75zM6.75 7h1.5a.75.75 0 01.75.75v3.25h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25V8.5h-.75a.75.75 0 010-1.5z" />
        </svg>
      </button>
      <Bubble open={open} anchorRef={ref} id={id}>
        {text}
      </Bubble>
    </span>
  );
}

interface TooltipProps {
  label: string;
  children: ReactNode;
  /** When false the wrapper is not a keyboard tab stop (for decorative inline tips). */
  focusable?: boolean;
}

/** Wrap a small inline element to show a tooltip on hover, focus, or tap. */
export function Tooltip({ label, children, focusable = true }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useDismiss(open, setOpen, ref);

  return (
    <span
      ref={ref}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={open ? id : undefined}
      title={focusable ? undefined : label}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") setOpen(false);
      }}
      onClick={() => setOpen((o) => !o)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className="inline-flex rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
    >
      {children}
      <Bubble open={open} anchorRef={ref} id={id}>
        {label}
      </Bubble>
    </span>
  );
}
