import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ScanFrameProps {
  /** Optional small label shown at the bottom-left of the frame. */
  label?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * A stylized "3D scan" of a building. We have no real building photos (only public
 * footprints), so this is an honest decorative stand-in: a wireframe tower in
 * perspective over a faint point grid, with a single scan-in sweep on mount (it
 * settles rather than looping, so it does not read as a perpetual loading bar).
 * Theme-aware via currentColor; the sweep is suppressed under prefers-reduced-motion
 * by the global rule in index.css.
 */
export function ScanFrame({ label, className, children }: ScanFrameProps) {
  return (
    <div
      className={cn(
        "relative h-[220px] overflow-hidden rounded-sm border border-line bg-ink-800",
        className,
      )}
    >
      <svg
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-signal-400/40"
      >
        <defs>
          <pattern id="scanframe-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.4" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="400" height="220" fill="url(#scanframe-dots)" />

        {/* Ground reticle */}
        <g stroke="currentColor" strokeWidth="0.8" opacity="0.45">
          <line x1="36" y1="186" x2="364" y2="186" />
          <line x1="200" y1="182" x2="200" y2="190" />
        </g>

        {/* Wireframe tower: front face, right (receding) face, top, floor lines. */}
        <g stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.95">
          {/* Front face */}
          <path d="M156 56 L156 186 L256 186 L256 56 Z" />
          {/* Right (receding) face */}
          <path d="M256 56 L298 40 L298 170 L256 186" />
          {/* Top face */}
          <path d="M156 56 L198 40 L298 40 L256 56 Z" />
          {/* Floor lines across the front face */}
          <g strokeWidth="0.7" opacity="0.7">
            <line x1="156" y1="78" x2="256" y2="78" />
            <line x1="156" y1="100" x2="256" y2="100" />
            <line x1="156" y1="122" x2="256" y2="122" />
            <line x1="156" y1="144" x2="256" y2="144" />
            <line x1="156" y1="164" x2="256" y2="164" />
            {/* Two window mullions */}
            <line x1="189" y1="56" x2="189" y2="186" />
            <line x1="222" y1="56" x2="222" y2="186" />
          </g>
        </g>
      </svg>

      {/* Single scan-in sweep: a soft band that travels the full height once. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-1/2 animate-scanline bg-gradient-to-b from-transparent via-signal-400/25 to-transparent" />
      </div>

      {children ? <div className="relative h-full w-full">{children}</div> : null}

      {label ? (
        <span className="absolute bottom-2 left-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-faint">
          {label}
        </span>
      ) : null}
    </div>
  );
}
