import { createElement, useEffect, useRef, useState, type ElementType } from "react";

interface DecodeTextProps {
  /** The final text. The animation always settles on exactly this string. */
  text: string;
  className?: string;
  /** Element to render. Defaults to "span". */
  as?: ElementType;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-_#";
const TICK_MS = 22;
const TARGET_TICKS = 16; // total reveal lasts ~TARGET_TICKS * TICK_MS (about 350ms)

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scramble(target: string, revealed: number): string {
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (i < revealed || ch === " ") {
      out += ch;
    } else {
      out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
  }
  return out;
}

/**
 * On mount, briefly scrambles the characters then resolves left-to-right onto the
 * real text (a quick decode effect, bounded to roughly 350ms regardless of length
 * so long headings do not crawl). Under prefers-reduced-motion it renders the final
 * text instantly. The interval is cleared on unmount and the output always ends on
 * exactly `text`. No external dependency.
 */
export function DecodeText({ text, className, as = "span" }: DecodeTextProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? text : ""));
  const idRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }

    // Reveal in chunks so the whole string resolves in a bounded number of ticks.
    const step = Math.max(1, Math.ceil(text.length / TARGET_TICKS));
    let revealed = 0;
    setDisplay(scramble(text, 0));

    idRef.current = window.setInterval(() => {
      revealed += step;
      if (revealed >= text.length) {
        setDisplay(text);
        window.clearInterval(idRef.current);
        return;
      }
      setDisplay(scramble(text, revealed));
    }, TICK_MS);

    return () => {
      window.clearInterval(idRef.current);
    };
  }, [text]);

  return createElement(as, { className }, display);
}
