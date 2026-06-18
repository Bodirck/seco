import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Meta } from "../api/types";
import { Button, Card, EmptyState, Spinner } from "../components/ui";

type MetaState =
  | { status: "loading" }
  | { status: "ready"; meta: Meta }
  | { status: "error" };

/** Small L-shaped corner ticks for the hero. Inline SVG, signal hairline. */
function CornerTicks() {
  const arm = "absolute h-4 w-4 text-signal-400/40";
  return (
    <span aria-hidden="true" className="pointer-events-none">
      <svg viewBox="0 0 16 16" fill="none" className={`${arm} left-0 top-0`}>
        <path d="M1 6V1h5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 16 16" fill="none" className={`${arm} right-0 top-0`}>
        <path d="M15 6V1h-5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 16 16" fill="none" className={`${arm} bottom-0 left-0`}>
        <path d="M1 10v5h5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 16 16" fill="none" className={`${arm} bottom-0 right-0`}>
        <path d="M15 10v5h-5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

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

function StatFigure({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-3xl font-semibold tabular-nums text-fg sm:text-4xl">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 font-display text-xs font-medium uppercase tracking-widest text-fg-faint">
        {label}
      </p>
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
      icon: extractIcon,
      title: t("landing.featureExtractTitle"),
      body: t("landing.featureExtractBody"),
    },
    {
      icon: scoreIcon,
      title: t("landing.featureScoreTitle"),
      body: t("landing.featureScoreBody"),
    },
    {
      icon: askIcon,
      title: t("landing.featureAskTitle"),
      body: t("landing.featureAskBody"),
    },
  ];

  const hasCounts =
    state.status === "ready" &&
    state.meta.buildings + state.meta.documents + state.meta.defects > 0;

  return (
    <div className="mx-auto max-w-4xl">
      {/* HERO */}
      <Card className="relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(38rem_24rem_at_50%_-10%,rgba(34,211,238,0.06),transparent_70%)]"
        />
        <CornerTicks />
        <div className="relative">
          <p className="font-display text-xs font-medium uppercase tracking-widest text-signal-300">
            {t("landing.kicker")}
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-5xl">
            {t("landing.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted">
            {t("landing.subtitle")}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/search">{t("landing.ctaSearch")}</Button>
            <Button to="/portfolio" variant="secondary">
              {t("landing.ctaPortfolio")}
            </Button>
          </div>
        </div>
      </Card>

      {/* PROBLEM */}
      <section className="mt-20">
        <h2 className="font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          {t("landing.problemTitle")}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          {t("landing.problemBody")}
        </p>
      </section>

      {/* WHAT IT DOES */}
      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="p-6">
            <div className="mb-4">{feature.icon}</div>
            <h3 className="font-display text-base font-semibold text-fg">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              {feature.body}
            </p>
          </Card>
        ))}
      </section>

      {/* PROOF OF DATA */}
      <section className="mt-20">
        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-fg-muted">
            <Spinner size="sm" />
            {t("common.loading")}
          </div>
        )}

        {state.status !== "loading" &&
          (hasCounts && state.status === "ready" ? (
            <Card className="grid gap-8 px-6 py-10 sm:grid-cols-3 sm:px-12">
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
            </Card>
          ) : (
            <Card className="px-6 py-4">
              <EmptyState
                title={t("landing.noData")}
                description={t("landing.howItWorks")}
                action={<Button to="/ingest">{t("landing.ctaIngest")}</Button>}
              />
            </Card>
          ))}
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-16 border-t border-line pt-8">
        <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">
          {t("landing.howItWorks")}{" "}
          <a
            href="https://github.com/mmilanesi/buildinglens"
            target="_blank"
            rel="noreferrer"
            className="rounded-md font-display text-signal-300 transition-colors duration-150 hover:text-signal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
          >
            {t("footer.repo")}
          </a>
        </p>
      </section>
    </div>
  );
}
