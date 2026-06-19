import { useLayoutEffect, useState, type RefObject } from "react";

export interface FloatPos {
  top: number;
  left: number;
}

/**
 * Compute a fixed-position point for a floating element (tooltip, popover) anchored
 * to a trigger, so it can be rendered through a portal at the document body and
 * escape every `overflow-hidden` / `overflow-x-auto` ancestor (our Panel and the
 * defect table). The returned `left` is the trigger's horizontal centre; the caller
 * applies a `-translate-x-1/2` so the box is centred on it.
 *
 * Behaviour: opens on the requested side, flips to the other side when there is not
 * enough room (fixes the risk-headline tip clipping at the top of the viewport),
 * and clamps horizontally so the box never bleeds off-screen. Recomputes on scroll
 * and resize while open so the float tracks its trigger inside scrolled panels.
 *
 * Returns null until the first measurement, so the caller can keep the float
 * invisible for one frame and avoid a flash at the wrong spot.
 */
export function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatRef: RefObject<HTMLElement | null>,
  placement: "top" | "bottom" = "top",
): FloatPos | null {
  const [pos, setPos] = useState<FloatPos | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }

    function compute() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const f = floatRef.current?.getBoundingClientRect();
      const fw = f?.width ?? 0;
      const fh = f?.height ?? 0;
      const gap = 8;
      const margin = 8;

      let top: number;
      if (placement === "top") {
        const fitsAbove = a.top - fh - gap >= margin;
        top = fitsAbove ? a.top - fh - gap : a.bottom + gap;
      } else {
        const fitsBelow = a.bottom + fh + gap <= window.innerHeight - margin;
        top = fitsBelow ? a.bottom + gap : Math.max(margin, a.top - fh - gap);
      }

      let center = a.left + a.width / 2;
      if (fw > 0) {
        const half = fw / 2;
        center = Math.min(
          Math.max(center, margin + half),
          window.innerWidth - margin - half,
        );
      }

      setPos({ top, left: center });
    }

    compute();
    // Second pass once the float has rendered and its size is known.
    const raf = requestAnimationFrame(compute);
    // Coalesce bursts of scroll/resize events into one measurement per frame.
    let scheduled: number | null = null;
    const onScrollOrResize = () => {
      if (scheduled != null) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = null;
        compute();
      });
    };
    // Capture-phase + passive scroll so nested scroll containers (tab panels, tables) fire.
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      cancelAnimationFrame(raf);
      if (scheduled != null) cancelAnimationFrame(scheduled);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, anchorRef, floatRef, placement]);

  return pos;
}
