import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CodeLabelProps {
  children: ReactNode;
  /** Accent family for the label color. Defaults to orange. */
  accent?: "orange" | "amber";
  className?: string;
}

/**
 * An inline decorative code label: Oswald, uppercase, strongly tracked, in the
 * accent color. Used for the title-bar code text ("CASEFILE // B-047", "GEO
 * INTEL") and for short inline codes inside panels.
 */
export function CodeLabel({ children, accent = "orange", className }: CodeLabelProps) {
  return (
    <span
      className={cn(
        "font-display text-xs font-semibold uppercase tracking-[0.18em]",
        accent === "amber" ? "text-amber" : "text-signal-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
