import { useTranslation } from "react-i18next";

export default function PortfolioPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{t("portfolio.title")}</h1>
      <p className="mt-2 text-slate-500">{t("portfolio.subtitle")}</p>
    </div>
  );
}
