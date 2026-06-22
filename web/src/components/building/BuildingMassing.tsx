import { useId } from "react";
import { cn } from "../../lib/cn";
import { riskHex, riskTone } from "../../lib/risk";

interface VolumeScanProps {
  /** Real footprint area in m2 (drives the base size). Null -> neutral base. */
  footprintArea: number | null;
  /** Real total height in m (drives the extrusion height). Null -> neutral height. */
  heightM: number | null;
  /** Real floor count (drives the number of floor bands). Null -> derived bands. */
  floors: number | null;
  /** 0-100 risk score; tints the volume via riskHex. */
  score: number;
  className?: string;
}

/**
 * SCAN // VOLUME: a schematic axonometric massing of one building, drawn from the
 * few real numbers we hold (footprint area, total height, floor count) and tinted
 * by the risk score. It is deliberately approximate: we do not store the real
 * footprint polygon, only its area, so the base is a square of equal area. Reads
 * as an instrument drawing (faint blueprint grid, ground reticle, dimension ticks,
 * mono labels, one scan sweep), not a map and not a toy.
 *
 * Robust to missing data: each dimension falls back to a neutral default and its
 * label is omitted when the value is null, so the block always renders honestly.
 */
export default function VolumeScan({
  footprintArea,
  heightM,
  floors,
  score,
  className,
}: VolumeScanProps) {
  const uid = useId().replace(/[:]/g, "");
  // Guard a NaN or out-of-range score: the readout never prints "NaN" or "150",
  // and the tint stays valid.
  const safeScore = Number.isFinite(score) ? clamp(score, 0, 100) : 0;
  const tint = riskHex(safeScore);
  const tone = riskTone(safeScore);

  // ---- Canvas (SVG user units). A wide, short panel (~300px tall in the page). ----
  const W = 460;
  const H = 300;

  // Ground anchor: the front-bottom corner of the block sits here.
  const groundY = 232;
  const cx = 196; // horizontal center of the footprint front edge

  // ---- Data -> geometry. Everything clamps to a legible range so the schematic
  // never collapses to a sliver or overflows the frame, while still moving with
  // the data. We keep the math explicit so it is defensible at a review. ----

  // Base size from footprint AREA. We only know the area, so we render a square of
  // the same area (side = sqrt(area)) and say so in the caption. ~40..3500 m2 ->
  // a comfortable on-screen side. sqrt(area) is the honest "characteristic length".
  const hasFootprint =
    footprintArea != null && Number.isFinite(footprintArea) && footprintArea > 0;
  const side = hasFootprint ? Math.sqrt(footprintArea as number) : 11; // m, ~120 m2 default
  const baseW = clamp(remap(side, 5, 70, 96, 232), 96, 232);
  // Depth reads a touch shallower than width so the prism looks like a building,
  // not a cube; it still scales with the same characteristic length.
  const depth = baseW * 0.46;

  // Extrusion from HEIGHT. ~3..120 m -> on-screen pixels, clamped so a 3 m shed and
  // a tower both stay inside the frame.
  const hasHeight = heightM != null && Number.isFinite(heightM) && heightM > 0;
  const blockH = hasHeight
    ? clamp(remap(heightM as number, 3, 90, 28, 170), 24, 170)
    : 96; // neutral mid-rise when unknown

  // Floor bands from FLOORS. When unknown, derive a plausible count from height so
  // the face is never blank, but mark the whole drawing ESTIMATED.
  const hasFloors = floors != null && Number.isFinite(floors) && floors > 0;
  const floorCount = hasFloors
    ? Math.min(Math.round(floors as number), 40)
    : hasHeight
    ? Math.max(1, Math.round((heightM as number) / 3))
    : 3;

  // Axonometric offset (the receding direction). A fixed, gentle angle reads as a
  // measured 3/4 view rather than a dramatic perspective.
  const dx = depth * 0.72;
  const dy = depth * 0.4;

  // Footprint front edge endpoints (the lit "front" base line).
  const fl = { x: cx - baseW / 2, y: groundY }; // front-left
  const fr = { x: cx + baseW / 2, y: groundY }; // front-right

  // Top of the front face.
  const tl = { x: fl.x, y: fl.y - blockH };
  const tr = { x: fr.x, y: fr.y - blockH };

  // Receding (back) corners, on the top.
  const trb = { x: tr.x + dx, y: tr.y - dy }; // top-right-back
  const tlb = { x: tl.x + dx, y: tl.y - dy }; // top-left-back
  // Back-right corner at ground level (for the right/side face).
  const frb = { x: fr.x + dx, y: fr.y - dy };

  // Face fills: top brightest, front mid, side darkest -> the block reads as solid
  // and lit. Opacities are tuned to sit on ink-850 in both themes.
  // Per-face shading from the one tint so the solid reads as lit (top lightest,
  // side darkest) in BOTH themes: we mix the colour itself, not just opacity.
  const topFill = shade(tint, 0.42);
  const frontFill = tint;
  const sideFill = shade(tint, -0.45);

  // Floor band Y positions across the front face (interior lines only).
  const bands = floorCount > 1
    ? Array.from({ length: floorCount - 1 }, (_, i) => tl.y + (blockH * (i + 1)) / floorCount)
    : [];

  // Honest labels of the REAL values only. Nulls are omitted (never "N/A").
  const areaLabel = hasFootprint ? `${formatNum(footprintArea as number)} m2` : null;
  const heightLabel = hasHeight ? `${formatNum(heightM as number)} m` : null;
  const floorsLabel = hasFloors
    ? `${floors} ${(floors as number) === 1 ? "FLOOR" : "FLOORS"}`
    : null;

  const estimated = !hasFootprint || !hasHeight || !hasFloors;

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-sm border border-line bg-ink-850",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={
          "Schematic 3D massing" +
          (areaLabel ? `, footprint ${areaLabel}` : "") +
          (heightLabel ? `, height ${heightLabel}` : "") +
          (floorsLabel ? `, ${floorsLabel.toLowerCase()}` : "") +
          `, risk score ${Math.round(safeScore)}.`
        }
        className="block h-full w-full"
      >
        <defs>
          {/* Faint blueprint grid. */}
          <pattern
            id={`${uid}-grid`}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M24 0 H0 V24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
          {/* Subtle vertical light falloff on the front face. */}
          <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={frontFill} stopOpacity="0.34" />
            <stop offset="100%" stopColor={frontFill} stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={sideFill} stopOpacity="0.24" />
            <stop offset="100%" stopColor={sideFill} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Blueprint backdrop. */}
        <g className="text-fg-faint" opacity="0.18">
          <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-grid)`} />
        </g>

        {/* Ground reticle: a measured baseline with a center tick. */}
        <g className="text-fg-faint" stroke="currentColor" opacity="0.5">
          <line x1="28" y1={groundY} x2={W - 28} y2={groundY} strokeWidth="0.8" />
          <line x1={cx} y1={groundY - 4} x2={cx} y2={groundY + 4} strokeWidth="0.8" />
        </g>

        {/* Cast shadow of the footprint on the ground plane (very faint). */}
        <polygon
          points={pts(fl, fr, frb, { x: fl.x + dx, y: fl.y - dy })}
          fill="currentColor"
          className="text-ink-950"
          opacity="0.35"
        />

        {/* The extruded volume, risk-tinted. Order: side, front, top so the lit top
            sits on top. Edges use the tint at full strength for a wireframe read. */}
        <g>
          {/* Right (receding) face */}
          <polygon points={pts(fr, frb, trb, tr)} fill={`url(#${uid}-side)`} />
          {/* Front face */}
          <polygon points={pts(fl, fr, tr, tl)} fill={`url(#${uid}-front)`} />
          {/* Top face */}
          <polygon
            points={pts(tl, tr, trb, tlb)}
            fill={topFill}
            fillOpacity="0.58"
          />

          {/* Floor bands across the front face, continuing onto the side face so
              the volume reads as storeys, not a printed texture. */}
          <g stroke={tint} strokeOpacity="0.55" strokeWidth="0.8">
            {bands.map((y, i) => (
              <g key={i}>
                <line x1={fl.x} y1={y} x2={fr.x} y2={y} />
                <line x1={fr.x} y1={y} x2={fr.x + dx} y2={y - dy} />
              </g>
            ))}
          </g>

          {/* Crisp volume edges (the "scan" wireframe over the solid). */}
          <g
            fill="none"
            stroke={tint}
            strokeOpacity="0.95"
            strokeWidth="1.4"
            strokeLinejoin="round"
          >
            {/* Front face outline */}
            <polygon points={pts(fl, fr, tr, tl)} />
            {/* Top face outline */}
            <polygon points={pts(tl, tr, trb, tlb)} />
            {/* Receding vertical + roof edges on the right */}
            <path
              d={`M${fr.x} ${fr.y} L${frb.x} ${frb.y} L${trb.x} ${trb.y}`}
            />
          </g>
        </g>

        {/* ---- Measured-drawing dimension annotations (real values only) ---- */}
        <g
          className="font-mono"
          stroke="currentColor"
          opacity="0.85"
        >
          {/* HEIGHT: vertical dimension on the left of the front face. */}
          {heightLabel ? (
            <g className="text-fg-muted">
              <line x1={fl.x - 14} y1={tl.y} x2={fl.x - 14} y2={fl.y} strokeWidth="0.8" />
              <line x1={fl.x - 18} y1={tl.y} x2={fl.x - 10} y2={tl.y} strokeWidth="0.8" />
              <line x1={fl.x - 18} y1={fl.y} x2={fl.x - 10} y2={fl.y} strokeWidth="0.8" />
              <text
                x={fl.x - 20}
                y={(tl.y + fl.y) / 2}
                fill="currentColor"
                stroke="none"
                fontSize="11"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(-90 ${fl.x - 20} ${(tl.y + fl.y) / 2})`}
                className="tabular-nums"
              >
                {heightLabel}
              </text>
            </g>
          ) : null}

          {/* FOOTPRINT: horizontal dimension under the front base edge. */}
          {areaLabel ? (
            <g className="text-fg-muted">
              <line x1={fl.x} y1={groundY + 16} x2={fr.x} y2={groundY + 16} strokeWidth="0.8" />
              <line x1={fl.x} y1={groundY + 12} x2={fl.x} y2={groundY + 20} strokeWidth="0.8" />
              <line x1={fr.x} y1={groundY + 12} x2={fr.x} y2={groundY + 20} strokeWidth="0.8" />
              <text
                x={cx}
                y={groundY + 30}
                fill="currentColor"
                stroke="none"
                fontSize="11"
                textAnchor="middle"
                className="tabular-nums"
              >
                {areaLabel}
              </text>
            </g>
          ) : null}

          {/* FLOORS: leader from the top-right edge with the real count. */}
          {floorsLabel ? (
            <g className="text-signal-300">
              <line
                x1={trb.x + 6}
                y1={trb.y}
                x2={trb.x + 30}
                y2={trb.y}
                strokeWidth="0.8"
              />
              <circle cx={trb.x + 6} cy={trb.y} r="1.6" fill="currentColor" stroke="none" />
              <text
                x={trb.x + 34}
                y={trb.y}
                fill="currentColor"
                stroke="none"
                fontSize="11"
                dominantBaseline="central"
                className="tabular-nums"
              >
                {floorsLabel}
              </text>
            </g>
          ) : null}
        </g>
      </svg>

      {/* Single scan-in sweep on mount (settles, does not loop). Suppressed under
          prefers-reduced-motion by the global rule in index.css. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-1/3 animate-scanline"
          style={{
            background: `linear-gradient(to bottom, transparent, ${tint}1f, transparent)`,
          }}
        />
      </div>

      {/* Corner readout: risk score, color-keyed to the tint via severity tokens. */}
      <div className="pointer-events-none absolute right-3 top-2.5 flex items-baseline gap-1.5">
        <span className="font-display text-[10px] uppercase tracking-[0.18em] text-fg-faint">
          RISK
        </span>
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            tone === "critical" && "text-critical",
            tone === "major" && "text-major",
            tone === "minor" && "text-minor",
          )}
        >
          {Math.round(safeScore)}
        </span>
      </div>

      {/* Honest caption: what this drawing is, and that it is approximate. */}
      <figcaption className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between gap-2">
        <span className="font-display text-[9px] uppercase leading-tight tracking-[0.18em] text-fg-faint">
          Schematic massing &middot; square base of equal footprint area, not the exact shape
        </span>
        {estimated ? (
          <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 font-display text-[8px] uppercase tracking-[0.18em] text-fg-faint">
            EST
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** Join points into an SVG "x,y x,y ..." string. */
function pts(...points: Array<{ x: number; y: number }>): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

/** Linear remap of v from [inLo,inHi] onto [outLo,outHi] (not clamped here). */
function remap(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  if (inHi === inLo) return outLo;
  const t = (v - inLo) / (inHi - inLo);
  return outLo + t * (outHi - outLo);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Compact integer-ish formatting for the small dimension labels. */
function formatNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (m == null) return [255, 122, 0];
  const h = m[1].length === 3 ? m[1].replace(/(.)/g, "$1$1") : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a hex colour toward white (t>0) or black (t<0) by |t| in [0,1]. */
function shade(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = t >= 0 ? 255 : 0;
  const k = Math.min(Math.abs(t), 1);
  const mix = (c: number) => Math.round(c + (target - c) * k);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
