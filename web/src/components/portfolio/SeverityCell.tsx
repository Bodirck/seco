import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { cn } from "../../lib/cn";
import type { Severity } from "../../lib/risk";

interface Props {
  critical: number;
  major: number;
  minor: number;
}

// Mono count pills mirroring the Badge severity tones, with a small colored dot.
const pill =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums";

const tones: Record<Severity, { chip: string; dot: string }> = {
  critical: { chip: "bg-critical/15 text-critical", dot: "bg-critical" },
  major: { chip: "bg-major/15 text-major", dot: "bg-major" },
  minor: { chip: "bg-minor/15 text-minor", dot: "bg-minor" },
};

export default function SeverityCell({ critical, major, minor }: Props) {
  const { t } = useTranslation();

  const counts: Array<{ sev: Severity; value: number; label: string }> = [
    { sev: "critical", value: critical, label: t("common.critical") },
    { sev: "major", value: major, label: t("common.major") },
    { sev: "minor", value: minor, label: t("common.minor") },
  ];

  return (
    <div className="flex items-center gap-2">
      {counts.map(({ sev, value, label }) => (
        <Tooltip key={sev} label={label}>
          <span className={cn(pill, tones[sev].chip)}>
            <span
              className={cn("h-1.5 w-1.5 rounded-full", tones[sev].dot)}
              aria-hidden="true"
            />
            {value}
          </span>
        </Tooltip>
      ))}
    </div>
  );
}
