import { useTranslation } from "react-i18next";
import { Button, EmptyState } from "../components/ui";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <EmptyState
        title={t("notFound.title")}
        description={t("notFound.body")}
        action={<Button to="/">{t("notFound.cta")}</Button>}
      />
    </div>
  );
}
