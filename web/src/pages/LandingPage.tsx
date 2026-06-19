import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Meta } from "../api/types";
import {
  Button,
  CodeLabel,
  DecodeText,
  EmptyState,
  Panel,
  ScanFrame,
  Spinner,
  StatusTag,
} from "../components/ui";
import { CODES } from "../lib/dossier";

type MetaState =
  | { status: "loading" }
  | { status: "ready"; meta: Meta }
  | { status: "error" };

/** The three "what it does" feature icons, inline SVG only. */
const extractIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-6 w-6 text-signal-400"
  >
    <path d="M14 2.25H8.5C6.43 2.25 5.4 2.25 4.7 2.95C4 3.65 4 4.68 4 6.75v10.5c0 2.07 0 3.1.7 3.8.7.7 1.73.7 3.8.7h7c2.07 0 3.1 0 3.8-.7.7-.7.7-1.73.7-3.8V8.25L14 2.25Z" />
    <path d="M14 2.25v3c0 1.42 0 2.12.44 2.56.44.44 1.14.44 2.56.44h3" />
    <path d="M8 13h6M8 16.5h4" />
  </svg>
);

const scoreIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-6 w-6 text-signal-400"
  >
    <path d="M12 21a9 9 0 1 0-9-9" />
    <path d="M3 12h2.5M12 3v2.5M19 5l-1.8 1.8" />
    <path d="M12 12l4-4" />
  </svg>
);

const askIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-6 w-6 text-signal-400"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 9 9 0 0 1-3.9-.85L3 21l1.9-5.1A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5M12 16h.01" />
  </svg>
);

/** A single proof-of-data figure: a big mono count over an Oswald label. */
function StatFigure({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-3xl font-semibold tabular-nums text-fg sm:text-4xl">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 font-display text-[10px] font-medium uppercase tracking-[0.18em] text-fg-faint">
        {label}
      </p>
    </div>
  );
}

/**
 * Sequential entrance wrapper: applies the panel-in animation with a small
 * per-index stagger. Reduced motion is handled globally in index.css, where the
 * panel-in animation collapses to its final state instantly.
 */
function Reveal({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`animate-panel-in${className ? ` ${className}` : ""}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<MetaState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    api
      .meta()
      .then((meta) => {
        if (active) setState({ status: "ready", meta });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  const features = [
    {
      code: "MODULE 01",
      icon: extractIcon,
      title: t("landing.featureExtractTitle"),
      body: t("landing.featureExtractBody"),
    },
    {
      code: "MODULE 02",
      icon: scoreIcon,
      title: t("landing.featureScoreTitle"),
      body: t("landing.featureScoreBody"),
    },
    {
      code: "MODULE 03",
      icon: askIcon,
      title: t("landing.featureAskTitle"),
      body: t("landing.featureAskBody"),
    },
  ];

  const hasCounts =
    state.status === "ready" &&
    state.meta.buildings + state.meta.documents + state.meta.defects > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      {/* HERO: the master casefile panel. */}
      <Reveal index={0}>
      <Panel
        code={
          <>
            {CODES.casefile} <span className="text-signal-500">BUILDINGLENS</span>
          </>
        }
        footer="CLASSIFICATION: PUBLIC // REGION: LUXEMBOURG"
      >
        <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <CodeLabel accent="amber" className="block">
              {t("landing.kicker")}
            </CodeLabel>
            <DecodeText
              as="h1"
              text={t("landing.title")}
              className="mt-3 block font-display text-3xl font-semibold uppercase leading-tight tracking-wide text-fg sm:text-4xl"
            />
            <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-muted">
              {t("landing.subtitle")}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button to="/search">{t("landing.ctaSearch")}</Button>
              <Button to="/portfolio" variant="secondary">
                {t("landing.ctaPortfolio")}
              </Button>
            </div>
          </div>
          {/* Honest stylized scan placeholder, decorative. */}
          <ScanFrame label="SCAN // B-001" className="h-[200px]">
            <StatusTag
              label="ACTIVE"
              tone="signal"
              className="absolute right-2 top-2"
            />
          </ScanFrame>
        </div>
      </Panel>
      </Reveal>

      {/* PROBLEM: a plain dossier note panel. */}
      <Reveal index={1}>
      <Panel
        code="BRIEF //"
        title={t("landing.problemTitle")}
        accent="amber"
      >
        <p className="max-w-2xl text-base leading-relaxed text-fg-muted">
          {t("landing.problemBody")}
        </p>
      </Panel>
      </Reveal>

      {/* WHAT IT DOES: three capability modules. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {features.map((feature, i) => (
          <Reveal key={feature.title} index={i + 2} className="h-full">
            <Panel code={feature.code} className="h-full">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="font-display text-base font-semibold uppercase tracking-wide text-fg">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                {feature.body}
              </p>
            </Panel>
          </Reveal>
        ))}
      </div>

      {/* PROOF OF DATA: integrity readout with the live /api/meta counts. */}
      <Reveal index={5}>
      <Panel
        code="DATA INTEGRITY"
        footer="SOURCE: EUBUCCO // STATEC // SYNTHETIC REPORTS"
      >
        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-fg-muted">
            <Spinner size="sm" />
            {t("common.loading")}
          </div>
        )}

        {state.status !== "loading" &&
          (hasCounts && state.status === "ready" ? (
            <div className="grid gap-8 py-4 sm:grid-cols-3">
              <StatFigure
                value={state.meta.buildings}
                label={t("landing.statBuildings")}
              />
              <StatFigure
                value={state.meta.documents}
                label={t("landing.statDocuments")}
              />
              <StatFigure
                value={state.meta.defects}
                label={t("landing.statDefects")}
              />
            </div>
          ) : (
            <EmptyState
              title={t("landing.noData")}
              description={t("landing.howItWorks")}
              action={<Button to="/ingest">{t("landing.ctaIngest")}</Button>}
            />
          ))}
      </Panel>
      </Reveal>

      {/* HOW IT WORKS: faint technical sign-off line. */}
      <section className="border-t border-line pt-6">
        <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">
          {t("landing.howItWorks")}{" "}
          <a
            href="https://github.com/Bodirck/seco"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-display text-signal-300 transition-colors duration-150 hover:text-signal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
          >
            {t("footer.repo")}
          </a>
        </p>
      </section>
    </div>
  );
}
