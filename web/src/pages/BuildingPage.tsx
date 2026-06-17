import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

export default function BuildingPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        {t("common.building")} #{id}
      </h1>
      <p className="mt-2 text-slate-500">{t("building.subtitle")}</p>
    </div>
  );
}
