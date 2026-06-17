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
  const linkClass = (path: string) =>
    loc.pathname === path
      ? "text-slate-900 font-semibold"
      : "text-slate-500 hover:text-slate-900";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            {t("app.name")}
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/" className={linkClass("/")}>
              {t("nav.search")}
            </Link>
            <Link to="/portfolio" className={linkClass("/portfolio")}>
              {t("nav.portfolio")}
            </Link>
            <div className="flex gap-1 text-xs text-slate-400">
              <button onClick={() => setLang("en")} className="px-1 hover:text-slate-900">
                EN
              </button>
              <span>/</span>
              <button onClick={() => setLang("fr")} className="px-1 hover:text-slate-900">
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
