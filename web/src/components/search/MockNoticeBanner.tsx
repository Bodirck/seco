import { useTranslation } from "react-i18next";

export default function MockNoticeBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-major/30 bg-major/10 px-4 py-3 text-sm leading-relaxed text-major"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span>{t("common.mockNotice")}</span>
    </div>
  );
}
