import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "critical" | "major" | "minor" | "signal" | "neutral";

interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/**
 * Static tone lookup. Tailwind needs literal class names at build time, so each
 * tone is spelled out rather than interpolated. Severity and signal tones use a
 * 15% accent wash; neutral is a quiet ink chip.
 */
const tones: Record<Tone, string> = {
  critical: "bg-critical/15 text-critical",
  major: "bg-major/15 text-major",
  minor: "bg-minor/15 text-minor",
  signal: "bg-signal-500/15 text-signal-300",
  neutral: "bg-ink-700 text-fg-muted",
};

/**
 * Small status pill. Uses the mono family with tabular-nums so numeric badges
 * (counts, scores) align cleanly. Wrap a number to get the instrument feel.
 */
export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
