import { useTranslation } from "react-i18next";

export default function MockNoticeBanner() {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {t("common.mockNotice")}
    </div>
  );
}
