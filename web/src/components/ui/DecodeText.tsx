import { createElement, useEffect, useRef, useState, type ElementType } from "react";

interface DecodeTextProps {
  /** The final text. The animation always settles on exactly this string. */
  text: string;
  className?: string;
  /** Element to render. Defaults to "span". */
  as?: ElementType;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-_#";

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
 * On mount, briefly scrambles the characters then resolves left-to-right onto
 * the real text (a light decode effect). Under prefers-reduced-motion it renders
 * the final text instantly. The interval is cleared on unmount, and the output
 * always ends on exactly `text`. No external dependency.
 */
export function DecodeText({ text, className, as = "span" }: DecodeTextProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? text : ""));
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }

    let revealed = 0;
    setDisplay(scramble(text, 0));
    // Reveal one more character every few ticks; settle on the exact text.
    const id = window.setInterval(() => {
      frameRef.current += 1;
      if (frameRef.current % 2 === 0) {
        revealed += 1;
      }
      if (revealed >= text.length) {
        setDisplay(text);
        window.clearInterval(id);
        return;
      }
      setDisplay(scramble(text, revealed));
    }, 28);

    return () => {
      window.clearInterval(id);
    };
  }, [text]);

  return createElement(as, { className }, display);
}
