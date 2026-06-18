import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import i18n from "../i18n";
import { api } from "../api/client";
import { Badge, Tooltip } from "./ui";

function setLang(lng: string) {
  i18n.changeLanguage(lng);
  localStorage.setItem("lang", lng);
}

/** Primary navigation, data driven so active state works for nested routes. */
const NAV_ITEMS: { to: string; key: string }[] = [
  { to: "/", key: "nav.home" },
  { to: "/search", key: "nav.search" },
  { to: "/portfolio", key: "nav.portfolio" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  "rounded-md px-1 py-0.5 cursor-pointer transition-colors duration-150 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 " +
  (isActive ? "text-signal-300" : "text-fg-muted hover:text-fg");

/**
 * Small header chip showing the effective AI provider. When the backend reports
 * the "mock" provider it carries a major-toned dot to flag that answers are not
 * coming from a real key. Fetched once on mount via the existing api.meta.
 */
function ProviderChip() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .meta()
      .then((meta) => {
        if (active) setProvider(meta.provider);
      })
      .catch(() => {
        // Stay silent: the chip simply does not render if meta is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!provider) return null;

  const isMock = provider === "mock";
  const tooltip = isMock
    ? t("provider.mockTooltip")
    : t("provider.tooltip", { provider });

  return (
    <Tooltip label={tooltip}>
      <span aria-label={`${t("provider.label")}: ${provider}`}>
        <Badge tone={isMock ? "major" : "signal"}>
          <span className="flex items-center gap-1.5">
            {isMock ? (
              <span
                className="h-1.5 w-1.5 rounded-full bg-major"
                aria-hidden="true"
              />
            ) : null}
            {provider}
          </span>
        </Badge>
      </span>
    </Tooltip>
  );
}

function LangSwitcher() {
  const { t } = useTranslation();
  const currentLang = i18n.resolvedLanguage ?? i18n.language;

  const langClass = (lng: string) =>
    "rounded-md px-1.5 py-0.5 font-mono uppercase cursor-pointer transition-colors duration-150 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 " +
    (currentLang === lng
      ? "font-semibold text-signal-300"
      : "text-fg-faint hover:text-fg");

  return (
    <div
      className="flex items-center gap-1 border-l border-line pl-4 text-xs"
      aria-label={t("common.language")}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={currentLang === "en"}
        className={langClass("en")}
      >
        EN
      </button>
      <span className="text-line-strong" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        onClick={() => setLang("fr")}
        aria-pressed={currentLang === "fr"}
        className={langClass("fr")}
      >
        FR
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="rounded-md font-display text-lg font-semibold tracking-tight text-fg transition-colors duration-150 hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
            >
              {t("app.name")}
            </Link>
            <ProviderChip />
          </div>
          <nav className="flex items-center gap-6 font-display text-sm">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
                {t(item.key)}
              </NavLink>
            ))}
            <LangSwitcher />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-fg-faint sm:flex-row sm:items-center">
          <span className="text-fg-muted">{t("footer.tagline")}</span>
          <a
            href="https://github.com/mmilanesi/buildinglens"
            target="_blank"
            rel="noreferrer"
            className="rounded-md font-display cursor-pointer transition-colors duration-150 hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
          >
            {t("footer.repo")}
          </a>
        </div>
      </footer>
    </div>
  );
}
