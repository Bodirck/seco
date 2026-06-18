import { useTranslation } from "react-i18next";
import type { Breakdown } from "../../api/types";
import { Card, InfoTip } from "../ui";
import type { Severity } from "../../lib/risk";
import { SEVERITY_HEX } from "../../lib/risk";

interface Props {
  breakdown: Breakdown;
}

interface KpiDef {
  severity: Severity;
  labelKey: string;
  tipKey: string;
  value: number;
}

/**
 * Severity counts as instrument-style KPI cards. The risk score is intentionally
 * not shown here: it lives in the page header as the headline metric, so showing
 * it again would duplicate identity information.
 */
export default function KpiCards({ breakdown }: Props) {
  const { t } = useTranslation();

  const cards: KpiDef[] = [
    {
      severity: "critical",
      labelKey: "common.critical",
      tipKey: "building.tips.critical",
      value: breakdown.critical,
    },
    {
      severity: "major",
      labelKey: "common.major",
      tipKey: "building.tips.major",
      value: breakdown.major,
    },
    {
      severity: "minor",
      labelKey: "common.minor",
      tipKey: "building.tips.minor",
      value: breakdown.minor,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.severity} className="p-5">
          <p className="flex items-center gap-1.5 font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
            {t(card.labelKey)}
            <InfoTip text={t(card.tipKey)} />
          </p>
          <p
            className="mt-2 font-mono text-3xl font-bold tabular-nums"
            style={{ color: SEVERITY_HEX[card.severity] }}
          >
            {card.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
