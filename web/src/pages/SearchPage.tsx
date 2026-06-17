import { useTranslation } from "react-i18next";

export default function SearchPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{t("search.title")}</h1>
      <p className="mt-2 text-slate-500">{t("search.subtitle")}</p>
    </div>
  );
}
