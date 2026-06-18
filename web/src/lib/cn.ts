/**
 * Tiny class-name joiner. Filters out falsy values so callers can pass
 * conditional classes inline without pulling in an external dependency.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
