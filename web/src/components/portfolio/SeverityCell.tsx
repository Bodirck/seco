import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";

interface Props {
  critical: number;
  major: number;
  minor: number;
}

export default function SeverityCell({ critical, major, minor }: Props) {
  const { t } = useTranslation();

  const pill =
    "inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-semibold tabular-nums";

  return (
    <div className="flex items-center gap-2">
      <Tooltip label={t("common.critical")}>
        <span className={`${pill} bg-red-100 text-red-700`}>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
          {critical}
        </span>
      </Tooltip>
      <Tooltip label={t("common.major")}>
        <span className={`${pill} bg-amber-100 text-amber-700`}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {major}
        </span>
      </Tooltip>
      <Tooltip label={t("common.minor")}>
        <span className={`${pill} bg-emerald-100 text-emerald-700`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {minor}
        </span>
      </Tooltip>
    </div>
  );
}
