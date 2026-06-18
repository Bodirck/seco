import { useTranslation } from "react-i18next";

/**
 * Mock-mode warning, styled as a major/amber alert strip in the HUD. The icon is
 * inline SVG (aria-hidden) and the copy stays in i18n. The "MOCK MODE" tag on the
 * left is decorative chrome (English), the readable notice comes from t().
 */
export default function MockNoticeBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-sm border border-major/40 bg-major/10 px-4 py-3"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 h-4 w-4 shrink-0 text-major"
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div className="min-w-0">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-major">
          MOCK MODE
        </span>
        <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">
          {t("common.mockNotice")}
        </p>
      </div>
    </div>
  );
}
