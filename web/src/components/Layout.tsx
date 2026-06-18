import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import i18n from "../i18n";

function setLang(lng: string) {
  i18n.changeLanguage(lng);
  localStorage.setItem("lang", lng);
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const currentLang = i18n.resolvedLanguage ?? i18n.language;

  const linkClass = (path: string) =>
    "rounded-md px-1 py-0.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 " +
    (loc.pathname === path
      ? "font-semibold text-brand-700"
      : "text-slate-500 hover:text-brand-700");

  const langClass = (lng: string) =>
    "rounded-md px-1.5 py-0.5 font-mono uppercase transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 " +
    (currentLang === lng
      ? "font-semibold text-brand-700"
      : "text-slate-400 hover:text-brand-700");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="rounded-md font-mono text-lg font-semibold tracking-tight text-slate-900 transition-colors duration-150 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            {t("app.name")}
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/" className={linkClass("/")}>
              {t("nav.search")}
            </Link>
            <Link to="/portfolio" className={linkClass("/portfolio")}>
              {t("nav.portfolio")}
            </Link>
            <div
              className="flex items-center gap-1 border-l border-slate-200 pl-4 text-xs"
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
              <span className="text-slate-300" aria-hidden="true">
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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
