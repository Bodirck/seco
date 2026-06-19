import { useTranslation } from "react-i18next";
import { Button, DossierNumber, Panel } from "../components/ui";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center">
      <Panel
        code="SIGNAL LOST"
        accent="amber"
        footer="STATUS: 404 // TRACE TERMINATED"
        className="w-full animate-panel-in"
      >
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <DossierNumber value="404" className="text-amber" />
          <div>
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-fg">
              {t("notFound.title")}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
              {t("notFound.body")}
            </p>
          </div>
          <div className="mt-2">
            <Button to="/">{t("notFound.cta")}</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
