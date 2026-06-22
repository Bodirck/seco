import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "../ui/Floating";
import { cn } from "../../lib/cn";

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M2 3h12l-4.6 5.4v4.1l-2.8 1.4V8.4L2 3z" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A reusable column-header filter, Excel style. The button toggles a portaled
 * popover (same fixed-position helper as the tooltip, so it escapes the table's
 * overflow-x-auto instead of being clipped) holding whatever control the column
 * needs: a text input, a numeric range, or a checklist. The button is
 * highlighted while the column has an active filter. Focus moves to the first
 * input on open; Escape and outside-click close it.
 */
export default function ColumnFilter({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const pos = useAnchoredPosition(open, triggerRef, popRef, "bottom");

  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector<HTMLElement>("input")?.focus();
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
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70",
          active
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
            aria-label={label}
            tabIndex={-1}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={cn(
              "z-[60] w-52 -translate-x-1/2 rounded-md border border-line-strong bg-ink-800 p-2 text-left shadow-lg shadow-black/40 transition-opacity duration-150 focus:outline-none",
              pos ? "opacity-100" : "opacity-0",
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
