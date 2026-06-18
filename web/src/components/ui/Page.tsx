import { type ReactNode } from "react";
import { InfoTip } from "./Tooltip";

interface PageHeaderProps {
  title: string;
  /** Small uppercase signal label above the title. */
  kicker?: string;
  /** Muted supporting line under the title. */
  meta?: ReactNode;
  /** Right-aligned actions, typically <Button> elements. */
  actions?: ReactNode;
}

/**
 * Top-of-page header. An optional signal kicker sits above an H1 in the display
 * family, with an optional muted meta line and right-aligned actions. Title and
 * actions share a row so actions stay aligned to the heading baseline area.
 */
export function PageHeader({ title, kicker, meta, actions }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker ? (
            <p className="mb-1 font-display text-xs font-medium uppercase tracking-widest text-signal-300">
              {kicker}
            </p>
          ) : null}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {title}
          </h1>
          {meta ? <p className="mt-2 text-sm text-fg-muted">{meta}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

interface SectionProps {
  title: string;
  /** Optional explanation surfaced through an InfoTip next to the heading. */
  tip?: string;
  /** Right-aligned actions for this section. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A titled block: a small display heading with an optional InfoTip and optional
 * right-aligned actions, then the section content. Structure comes from spacing,
 * not filled bars.
 */
export function Section({ title, tip, actions, children }: SectionProps) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wide text-fg-muted">
          {title}
          {tip ? <InfoTip text={tip} /> : null}
        </h2>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
