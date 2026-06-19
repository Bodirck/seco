import { useTranslation } from "react-i18next";
import type { Breakdown } from "../../api/types";
import { CodeLabel, InfoTip, Panel } from "../ui";
import type { Severity } from "../../lib/risk";
import { SEVERITY_HEX } from "../../lib/risk";
import { caseId } from "../../lib/dossier";

interface Props {
  breakdown: Breakdown;
  buildingId: number;
}

interface KpiDef {
  severity: Severity;
  labelKey: string;
  tipKey: string;
  value: number;
  ref_: string;
}

/**
 * Severity counts as instrument-style dossier tiles. Each count is a small Panel
 * with a code label, a big mono figure colored by severity, and a faint footer.
 * The risk index is intentionally not shown here: it lives in the dossier head
 * as the headline metric, so repeating it would duplicate identity information.
 */
export default function KpiCards({ breakdown, buildingId }: Props) {
  const { t } = useTranslation();
  const case_ = caseId(buildingId);

  const cards: KpiDef[] = [
    {
      severity: "critical",
      labelKey: "common.critical",
      tipKey: "building.tips.critical",
      value: breakdown.critical,
      ref_: `${case_} // PRIORITY: HIGH`,
    },
    {
      severity: "major",
      labelKey: "common.major",
      tipKey: "building.tips.major",
      value: breakdown.major,
      ref_: `${case_} // PLANNED`,
    },
    {
      severity: "minor",
      labelKey: "common.minor",
      tipKey: "building.tips.minor",
      value: breakdown.minor,
      ref_: `${case_} // MONITOR`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Panel
          key={card.severity}
          code={<CodeLabel>{t(card.labelKey)}</CodeLabel>}
          accent={card.severity === "critical" ? "orange" : "amber"}
          footer={card.ref_}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
              {t("common.defects")}
            </p>
            <InfoTip text={t(card.tipKey)} />
          </div>
          <p
            className="mt-2 font-mono text-4xl font-bold tabular-nums"
            style={{ color: SEVERITY_HEX[card.severity] }}
          >
            {card.value}
          </p>
        </Panel>
      ))}
    </div>
  );
}
