import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { BuildingSummary, IngestResult } from "../api/types";
import {
  Button,
  CodeLabel,
  DecodeText,
  DossierNumber,
  Input,
  Panel,
  Spinner,
  StatusTag,
} from "../components/ui";
import { caseId, CODES, sector } from "../lib/dossier";
import { riskTone } from "../lib/risk";

type Target = "existing" | "new";

/**
 * Ingest page: upload an inspection PDF and attach it either to an existing
 * building or to a new one. Mirrors POST /api/ingest: when a building is picked
 * we send its id; otherwise a non-empty name creates a new building. On success
 * we surface the extracted defect count and the recomputed risk score, with a
 * mock-mode note when the active client extracted nothing. Reskinned as the
 * "INTAKE // INGEST" dossier panel; codes are chrome, labels stay in i18n.
 */
export default function IngestPage() {
  const { t } = useTranslation();
  const selectId = useId();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buildings list for the "existing building" target.
  const [buildings, setBuildings] = useState<BuildingSummary[] | null>(null);

  // Form state.
  const [target, setTarget] = useState<Target>("new");
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Submission state.
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .buildings()
      .then((list) => {
        if (!active) return;
        setBuildings(list);
        // Default to the first building when the list is not empty.
        if (list.length > 0) {
          setBuildingId(list[0].id);
          setTarget("existing");
        }
      })
      .catch(() => {
        // Treat a failed load as an empty list: "new building" still works.
        if (active) setBuildings([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  function onTargetChange(next: Target) {
    setTarget(next);
    setResult(null);
    setError(null);
  }

  const trimmedName = name.trim();
  const newBuildingInvalid = target === "new" && trimmedName.length === 0;
  const noExistingTarget = target === "existing" && buildingId === null;
  const canSubmit =
    !submitting && file !== null && !newBuildingInvalid && !noExistingTarget;

  async function handleSubmit() {
    if (!file || !canSubmit) return;
    setSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.ingest(
        target === "existing"
          ? { file, buildingId: buildingId ?? undefined }
          : { file, name: trimmedName, address: address.trim() || undefined },
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const buildingsLoading = buildings === null;
  const hasBuildings = (buildings?.length ?? 0) > 0;

  const radioClass = (active: boolean) =>
    "flex-1 cursor-pointer rounded-sm border px-4 py-3 text-left transition duration-150 ease-out " +
    "focus-within:outline-none focus-within:ring-2 focus-within:ring-signal-400/70 " +
    (active
      ? "border-signal-400/60 bg-ink-800 text-fg"
      : "border-line bg-ink-850 text-fg-muted hover:border-line-strong hover:text-fg");

  const resultScore = result ? Math.round(result.new_risk_score) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Panel
        code={CODES.intake}
        title={t("ingest.title")}
        accent="orange"
        windowButtons
        footer="SECTOR 04 // INTAKE QUEUE"
        className="animate-panel-in"
      >
        <DecodeText
          as="h1"
          text={t("ingest.title")}
          className="block font-display text-2xl font-bold uppercase tracking-wide text-fg"
        />
        <p className="mt-2 mb-6 text-sm leading-relaxed text-fg-muted">
          {t("ingest.subtitle")}
        </p>

        {buildingsLoading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-fg-muted">
            <Spinner size="sm" />
            {t("common.loading")}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Target choice: existing vs new building. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              {hasBuildings && (
                <label className={radioClass(target === "existing")}>
                  <input
                    type="radio"
                    name="ingest-target"
                    value="existing"
                    checked={target === "existing"}
                    onChange={() => onTargetChange("existing")}
                    className="sr-only"
                  />
                  <span className="block font-display text-sm font-semibold uppercase tracking-wide">
                    {t("ingest.targetExisting")}
                  </span>
                </label>
              )}
              <label className={radioClass(target === "new")}>
                <input
                  type="radio"
                  name="ingest-target"
                  value="new"
                  checked={target === "new"}
                  onChange={() => onTargetChange("new")}
                  className="sr-only"
                />
                <span className="block font-display text-sm font-semibold uppercase tracking-wide">
                  {t("ingest.targetNew")}
                </span>
              </label>
            </div>

            {/* Existing building selector. */}
            {target === "existing" && hasBuildings && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={selectId}
                  className="block font-display text-xs font-medium uppercase tracking-wide text-fg-faint"
                >
                  {t("ingest.selectBuilding")}
                </label>
                <select
                  id={selectId}
                  value={buildingId ?? ""}
                  onChange={(e) => {
                    setBuildingId(Number(e.target.value));
                    setResult(null);
                    setError(null);
                  }}
                  className="w-full cursor-pointer rounded-sm border border-line bg-ink-800 px-3 py-2 text-sm text-fg transition duration-150 ease-out focus-visible:border-signal-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
                >
                  {(buildings ?? []).map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-ink-800 text-fg"
                    >
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* New building fields. */}
            {target === "new" && (
              <div className="flex flex-col gap-4">
                <Input
                  type="text"
                  label={t("ingest.newName")}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setResult(null);
                    setError(null);
                  }}
                />
                <Input
                  type="text"
                  label={t("ingest.newAddress")}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setResult(null);
                    setError(null);
                  }}
                />
              </div>
            )}

            {/* PDF file control: a styled label wrapping a visually hidden input. */}
            <div className="flex flex-col gap-1.5">
              <span className="block font-display text-xs font-medium uppercase tracking-wide text-fg-faint">
                {t("ingest.file")}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={fileInputId}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-line px-4 font-display text-sm font-semibold uppercase tracking-wide text-fg transition duration-150 ease-out hover:border-signal-400/60 hover:text-signal-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-signal-400/70"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path d="M12 16.5V3m0 0L7.5 7.5M12 3l4.5 4.5" />
                    <path d="M3.75 16.5v1.5a2.25 2.25 0 0 0 2.25 2.25h12a2.25 2.25 0 0 0 2.25-2.25v-1.5" />
                  </svg>
                  {t("ingest.chooseFile")}
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={onFileChange}
                    className="sr-only"
                  />
                </label>
                <span className="font-mono text-sm text-fg-muted">
                  {file ? file.name : t("ingest.noFile")}
                </span>
              </div>
            </div>

            {/* Submit. */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-sm uppercase tracking-wide"
              >
                {submitting ? t("ingest.submitting") : t("ingest.submit")}
              </Button>
              {submitting && (
                <span className="flex items-center gap-2 text-sm text-fg-muted">
                  <Spinner size="sm" />
                  {t("ingest.processingNote")}
                </span>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* Error alert. */}
      {error && (
        <div
          role="alert"
          className="rounded-sm border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      )}

      {/* Success result panel. */}
      {result && (
        <Panel
          code={`${CODES.casefile} ${caseId(result.building_id)}`}
          title={t("ingest.resultTitle")}
          accent="orange"
          windowButtons
          footer={`${caseId(result.building_id)} // ${sector(result.building_id)} // INGESTED`}
          className="animate-panel-in"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-sans text-sm text-fg">
              {result.building_name}
            </p>
            <StatusTag label={resultScore} tone={riskTone(resultScore)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-sm border border-line bg-ink-800 px-4 py-3">
              <CodeLabel accent="amber">
                {t("ingest.defectsExtracted")}
              </CodeLabel>
              <p className="mt-1.5">
                <DossierNumber
                  value={result.defects_extracted}
                  className="text-3xl text-fg sm:text-4xl"
                />
              </p>
            </div>
            <div className="rounded-sm border border-line bg-ink-800 px-4 py-3">
              <CodeLabel accent="amber">{t("ingest.newRiskScore")}</CodeLabel>
              <p className="mt-1.5">
                <DossierNumber
                  value={resultScore}
                  className="text-3xl sm:text-4xl"
                />
              </p>
            </div>
          </div>

          {result.mock && (
            <div
              role="note"
              className="mt-5 rounded-sm border border-major/40 bg-major/10 px-4 py-3 text-sm text-major"
            >
              {t("ingest.mockNote")}{" "}
              <Button variant="ghost" size="sm" to="/settings" className="px-0">
                {t("nav.settings")}
              </Button>
            </div>
          )}

          <div className="mt-6">
            <Button
              to={`/building/${result.building_id}`}
              className="rounded-sm uppercase tracking-wide"
            >
              {t("ingest.viewBuilding")}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
