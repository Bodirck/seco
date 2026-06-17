import { useTranslation } from "react-i18next";

interface Props {
  critical: number;
  major: number;
  minor: number;
}

export default function SeverityCell({ critical, major, minor }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 font-medium text-red-700"
        title={t("common.critical")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {critical}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-700"
        title={t("common.major")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {major}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600"
        title={t("common.minor")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        {minor}
      </span>
    </div>
  );
}
