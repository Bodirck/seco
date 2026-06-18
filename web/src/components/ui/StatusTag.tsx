import { type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { CODES } from "../../lib/dossier";

type Tone = "critical" | "major" | "minor" | "signal" | "neutral";

interface StatusTagProps {
  /** The status value shown after the fixed "STATUS:" prefix. */
  label: ReactNode;
  tone?: Tone;
  className?: string;
}

/**
 * A "STATUS:" style tag: the fixed "STATUS:" chrome prefix (Oswald, faint) then
 * a tone-colored value in mono. Tones reuse the severity / signal palette so a
 * tag reads the same as the matching Badge. Tailwind needs literal class names,
 * so each tone is spelled out.
 */
const tones: Record<Tone, string> = {
  critical: "text-critical",
  major: "text-major",
  minor: "text-minor",
  signal: "text-signal-300",
  neutral: "text-fg-muted",
};

export function StatusTag({ label, tone = "neutral", className }: StatusTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-line bg-ink-800 px-2 py-0.5 rounded-sm",
        className,
      )}
    >
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-faint">
        {CODES.status}
      </span>
      <span className={cn("font-mono text-xs font-medium uppercase tabular-nums", tones[tone])}>
        {label}
      </span>
    </span>
  );
}
