import { cn } from "../../lib/cn";

interface DossierNumberProps {
  /** The case sequence or id to display large. */
  value: string | number;
  className?: string;
}

/**
 * A big Oswald display number for the case sequence / building id. Tabular-nums
 * so digits stay aligned. Defaults to the accent color; pass a text-* class via
 * className to override (e.g. text-fg for a neutral number).
 */
export function DossierNumber({ value, className }: DossierNumberProps) {
  return (
    <span
      className={cn(
        "font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-signal-500 sm:text-5xl",
        className,
      )}
    >
      {value}
    </span>
  );
}
