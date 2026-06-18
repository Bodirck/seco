import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the hover glow and a hairline accent, for clickable or linked cards. */
  interactive?: boolean;
}

/**
 * The base surface of the First Light system: a flat ink-850 panel with a single
 * hairline border. Pass `interactive` for cards that respond to hover (links,
 * selectable rows) to add the accent border and faint signal glow.
 */
export function Card({ className, interactive, children, ...divProps }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-ink-850",
        interactive &&
          "transition duration-200 ease-out hover:border-signal-400/40 hover:shadow-signal",
        className,
      )}
      {...divProps}
    >
      {children}
    </div>
  );
}
