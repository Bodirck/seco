import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeProvider";

/** Primary navigation, data driven so active state works for nested routes. */
const NAV_ITEMS: { to: string; key: string }[] = [
  { to: "/", key: "nav.home" },
  { to: "/search", key: "nav.search" },
  { to: "/portfolio", key: "nav.portfolio" },
  { to: "/ingest", key: "nav.ingest" },
  { to: "/settings", key: "nav.settings" },
];

/**
 * Terminal-tab nav item: Oswald uppercase, strongly tracked. Active gets the
 * signal accent with a boxed ink-800 highlight and an underline rule; idle stays
 * muted and warms to fg on hover.
 */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  "relative rounded-sm px-2 py-1 font-display text-xs font-medium uppercase tracking-[0.18em] " +
  "cursor-pointer transition-colors duration-150 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 " +
  (isActive
    ? "bg-ink-800 text-signal-300 ring-1 ring-inset ring-signal-500/40 border-b-2 border-signal-500"
    : "border-b-2 border-transparent text-fg-muted hover:text-fg");

/** Light/dark theme toggle. Shows the icon of the theme you would switch TO. */
function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("common.theme")}
      title={t("common.theme")}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg-faint transition-colors duration-150 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}

/** Each top-level section maps to a sector number for the header status strip. */
const SECTOR_BY_PATH: Record<string, string> = {
  "/": "01",
  "/search": "02",
  "/portfolio": "03",
  "/ingest": "04",
  "/settings": "05",
};

function sectorForPath(pathname: string): string {
  if (SECTOR_BY_PATH[pathname]) return SECTOR_BY_PATH[pathname];
  if (pathname.startsWith("/building")) return "03";
  return "01";
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const sectorCode = sectorForPath(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      {/* HUD command bar: wordmark, status strip, terminal-tab nav. */}
      <header className="sticky top-0 z-20 border-b border-line-strong bg-ink-900/85 backdrop-blur">
        {/* Thin accent rule along the very top edge, pure chrome. */}
        <span aria-hidden="true" className="block h-px w-full bg-signal-500/60" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="group flex items-center gap-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
            >
              {/* Decorative dossier glyph next to the wordmark. */}
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-sm border border-signal-500/50 bg-signal-500/10 text-signal-300"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                  <rect x="2.5" y="1.5" width="9" height="11" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="4.6" y1="4.4" x2="9.4" y2="4.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="4.6" y1="7" x2="9.4" y2="7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="4.6" y1="9.6" x2="7.4" y2="9.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              </span>
              <span className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-fg transition-colors duration-150 group-hover:text-signal-300">
                Building<span className="text-signal-500">Lens</span>
              </span>
            </Link>
          </div>
          <nav className="flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
                {t(item.key)}
              </NavLink>
            ))}
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-line-strong" />
            <ThemeToggle />
          </nav>
        </div>
        {/* Faint technical sub-bar: decorative codes, chrome only. */}
        <div className="mx-auto hidden max-w-6xl items-center gap-3 border-t border-line px-4 py-1 sm:flex">
          <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-signal-300/80">
            BuildingLens Terminal
          </span>
          <span aria-hidden="true" className="font-mono text-[10px] tracking-[0.18em] text-fg-faint">
            // SESSION: USER // SECTOR {sectorCode}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      {/* Faint technical micro-text footer. */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-4 sm:flex-row sm:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
            {t("footer.tagline")}
          </p>
          <a
            href="https://github.com/Bodirck/seco"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-display text-[10px] font-medium uppercase tracking-[0.18em] text-fg-faint cursor-pointer transition-colors duration-150 hover:text-signal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
          >
            {t("footer.repo")}
          </a>
        </div>
      </footer>
    </div>
  );
}
