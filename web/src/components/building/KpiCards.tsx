import { useTranslation } from "react-i18next";
import type { Breakdown } from "../../api/types";
import { CodeLabel, InfoTip, Panel } from "../ui";
import type { Severity } from "../../lib/risk";
import { SEVERITY_HEX, riskHex } from "../../lib/risk";
import { caseId, CODES } from "../../lib/dossier";

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
 * The KPI tab tiles: the risk index recalled as the first tile, then the critical /
 * major / minor defect counts. Each is a small Panel with a code label, a big mono
 * figure colored by its tone, and a faint footer.
 */
export default function KpiCards({ breakdown, buildingId }: Props) {
  const { t } = useTranslation();
  const case_ = caseId(buildingId);
  const score = breakdown.risk_score;

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Risk index recalled as the headline tile, before the severity counts. */}
      <Panel code={CODES.risk} accent="orange" footer={`${case_} // RISK`}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
            {t("common.riskScore")}
          </p>
          <InfoTip text={t("building.tips.riskScore")} />
        </div>
        <p
          className="mt-2 font-mono text-4xl font-bold tabular-nums"
          style={{ color: riskHex(score) }}
        >
          {score.toFixed(1)}
        </p>
      </Panel>

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
