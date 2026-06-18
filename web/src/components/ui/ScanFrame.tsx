import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ScanFrameProps {
  /** Optional small label shown at the bottom-left of the frame. */
  label?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * A stylized "3D scan" visual placeholder. We have no real building photos (only
 * public footprints), so this is an honest decorative stand-in: a framed box with
 * a faint blue-white perspective wireframe / point grid and a slow scan-line sweep
 * overlay. Theme-aware via tokens; the wireframe stroke uses currentColor so it
 * stays legible in both light and dark. The scan sweep is suppressed under
 * prefers-reduced-motion by the global rule in index.css.
 */
export function ScanFrame({ label, className, children }: ScanFrameProps) {
  return (
    <div
      className={cn(
        "relative h-[220px] overflow-hidden rounded-sm border border-line bg-ink-800",
        className,
      )}
    >
      {/* Perspective wireframe + point cloud, faint signal-tinted text color. */}
      <svg
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-signal-400/35"
      >
        <defs>
          <pattern id="scanframe-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.45" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="400" height="220" fill="url(#scanframe-dots)" />
        {/* A stylized wireframe volume (extruded footprint). */}
        <g stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.9">
          {/* Front face */}
          <path d="M150 150 L150 80 L250 80 L250 150 Z" />
          {/* Top face, receding to a vanishing point */}
          <path d="M150 80 L188 52 L288 52 L250 80" />
          {/* Right side */}
          <path d="M250 80 L288 52 L288 122 L250 150" />
          {/* Vertical guides */}
          <line x1="150" y1="150" x2="150" y2="80" />
          <line x1="250" y1="150" x2="250" y2="80" />
        </g>
        {/* Base reticle */}
        <g stroke="currentColor" strokeWidth="0.8" opacity="0.5">
          <line x1="40" y1="178" x2="360" y2="178" />
          <line x1="200" y1="30" x2="200" y2="40" />
        </g>
      </svg>

      {/* Slow vertical scan sweep. A thin highlighted band that travels down. */}
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
