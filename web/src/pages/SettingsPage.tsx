import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type {
  SettingsProvider,
  SettingsState,
  SettingsTestResult,
  SettingsUpdate,
} from "../api/types";
import {
  Badge,
  Button,
  CodeLabel,
  DecodeText,
  EmptyState,
  Input,
  Panel,
  Spinner,
  StatusTag,
} from "../components/ui";
import { CODES } from "../lib/dossier";

/** Providers that authenticate with an online API key. */
const ONLINE_PROVIDERS: SettingsProvider[] = ["anthropic", "openai", "mistral"];

type KeyField = "anthropic" | "openai" | "mistral";

const PROVIDER_OPTIONS: SettingsProvider[] = [
  "anthropic",
  "openai",
  "mistral",
  "local",
  "mock",
];

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: SettingsTestResult };

/**
 * Settings page: pick the AI provider, set its API key (write-only) and model,
 * run a real liveness check, and save. The raw key is never shown; when a key is
 * already stored we surface only its last 4 characters. The effective client is
 * always visible so a silent fallback to mock is obvious. Reskinned as the
 * "OPS // SETTINGS" dossier panel; the codes are chrome, the labels stay in i18n.
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const selectId = useId();

  const [state, setState] = useState<SettingsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Working copy of the editable fields, hydrated from the loaded state.
  const [provider, setProvider] = useState<SettingsProvider>("mock");
  const [keys, setKeys] = useState<Record<KeyField, string>>({
    anthropic: "",
    openai: "",
    mistral: "",
  });
  const [anthropicModel, setAnthropicModel] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [mistralModel, setMistralModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");

  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function hydrate(s: SettingsState) {
    setState(s);
    setProvider(s.provider);
    setKeys({ anthropic: "", openai: "", mistral: "" });
    setAnthropicModel(s.anthropic_model);
    setOpenaiModel(s.openai_model);
    setMistralModel(s.mistral_model);
    setOllamaUrl(s.ollama_base_url);
    setOllamaModel(s.ollama_model);
  }

  useEffect(() => {
    let active = true;
    api
      .getSettings()
      .then((s) => {
        if (active) hydrate(s);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Any edit invalidates the previous test/saved confirmation.
  function markDirty() {
    setSaved(false);
    setSaveError(null);
    setTestState({ status: "idle" });
  }

  function onProviderChange(next: SettingsProvider) {
    setProvider(next);
    markDirty();
  }

  function onKeyChange(field: KeyField, value: string) {
    setKeys((prev) => ({ ...prev, [field]: value }));
    markDirty();
  }

  function buildUpdate(): SettingsUpdate {
    const body: SettingsUpdate = {
      provider,
      anthropic_model: anthropicModel,
      openai_model: openaiModel,
      mistral_model: mistralModel,
      ollama_base_url: ollamaUrl,
      ollama_model: ollamaModel,
    };
    // Only send non-empty keys; an empty field leaves the stored key unchanged.
    if (keys.anthropic) body.anthropic_api_key = keys.anthropic;
    if (keys.openai) body.openai_api_key = keys.openai;
    if (keys.mistral) body.mistral_api_key = keys.mistral;
    return body;
  }

  async function handleTest() {
    setTestState({ status: "running" });
    try {
      const result = await api.testSettings(provider);
      setTestState({ status: "done", result });
    } catch (err) {
      setTestState({
        status: "done",
        result: {
          ok: false,
          provider,
          effective: "",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const next = await api.saveSettings(buildUpdate());
      hydrate(next);
      setSaved(true);
      setTestState({ status: "idle" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Loading / error gates.
  if (loadError && !state) {
    return (
      <div className="mx-auto max-w-2xl">
        <Panel code={CODES.ops} title={t("settings.title")} windowButtons>
          <EmptyState
            title={t("common.error")}
            description={loadError}
            action={
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                {t("notFound.cta")}
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-2xl">
        <Panel code={CODES.ops} title={t("settings.title")} windowButtons>
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-fg-muted">
            <Spinner size="sm" />
            {t("common.loading")}
          </div>
        </Panel>
      </div>
    );
  }

  const isOnline = ONLINE_PROVIDERS.includes(provider);
  const isLocal = provider === "local";
  const keyField = isOnline ? (provider as KeyField) : null;

  const hasStoredKey = keyField ? state.has_key[keyField] : false;
  const storedTail = keyField ? state.key_tail[keyField] : null;
  const keyPlaceholder =
    hasStoredKey && storedTail
      ? t("settings.keySet", { tail: storedTail })
      : t("settings.apiKeyPlaceholder");

  const modelValue =
    provider === "anthropic"
      ? anthropicModel
      : provider === "openai"
        ? openaiModel
        : mistralModel;

  function setModelValue(value: string) {
    if (provider === "anthropic") setAnthropicModel(value);
    else if (provider === "openai") setOpenaiModel(value);
    else setMistralModel(value);
    markDirty();
  }

  // The effective client falls back to mock silently when a key is missing; flag it.
  const effectiveIsMock = state.effective === "MockClient";
  const showMockWarning = effectiveIsMock && provider !== "mock";

  const testResult = testState.status === "done" ? testState.result : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Panel
        code={CODES.ops}
        title={t("settings.title")}
        accent="orange"
        windowButtons
        footer="REF 0x0C // SECTOR 01 // CLEARANCE: OPS"
        className="animate-panel-in"
      >
        <DecodeText
          as="h1"
          text={t("settings.title")}
          className="block font-display text-2xl font-bold uppercase tracking-wide text-fg"
        />
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {t("settings.subtitle")}
        </p>

        {/* Effective client line: always visible, as a status tag for the instrument feel. */}
        <div className="mt-4">
          <StatusTag
            label={state.effective}
            tone={effectiveIsMock ? "major" : "signal"}
          />
        </div>

        {showMockWarning && (
          <div
            role="alert"
            className="mt-4 rounded-sm border border-major/40 bg-major/10 px-4 py-3 text-sm text-major"
          >
            {t("settings.mockWarning")}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={selectId}
              className="block font-display text-xs font-medium uppercase tracking-wide text-fg-faint"
            >
              {t("settings.provider")}
            </label>
            <select
              id={selectId}
              value={provider}
              onChange={(e) =>
                onProviderChange(e.target.value as SettingsProvider)
              }
              className="w-full cursor-pointer rounded-sm border border-line bg-ink-800 px-3 py-2 text-sm text-fg transition duration-150 ease-out focus-visible:border-signal-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-ink-800 text-fg">
                  {t(`settings.providerOptions.${opt}`)}
                </option>
              ))}
            </select>
          </div>

          {isOnline && (
            <>
              <Input
                type="password"
                autoComplete="off"
                label={t("settings.apiKey")}
                hint={t("settings.apiKeyHint")}
                placeholder={keyPlaceholder}
                value={keyField ? keys[keyField] : ""}
                onChange={(e) =>
                  keyField && onKeyChange(keyField, e.target.value)
                }
              />
              <Input
                type="text"
                label={t("settings.model")}
                value={modelValue}
                onChange={(e) => setModelValue(e.target.value)}
              />
            </>
          )}

          {isLocal && (
            <>
              <Input
                type="text"
                label={t("settings.ollamaUrl")}
                value={ollamaUrl}
                onChange={(e) => {
                  setOllamaUrl(e.target.value);
                  markDirty();
                }}
              />
              <Input
                type="text"
                label={t("settings.ollamaModel")}
                value={ollamaModel}
                onChange={(e) => {
                  setOllamaModel(e.target.value);
                  markDirty();
                }}
              />
            </>
          )}
        </div>

        {/* Test connection result */}
        {testResult && (
          <p
            role="status"
            className={
              "mt-5 text-sm " + (testResult.ok ? "text-minor" : "text-critical")
            }
          >
            {testResult.ok
              ? t("settings.testOk", { effective: testResult.effective })
              : t("settings.testFail", { message: testResult.message })}
          </p>
        )}

        {saved && (
          <p role="status" className="mt-5 text-sm text-signal-300">
            {t("settings.saved")}
          </p>
        )}

        {saveError && (
          <p role="alert" className="mt-5 text-sm text-critical">
            {t("common.error")} {saveError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-sm uppercase tracking-wide"
          >
            {saving ? t("settings.saving") : t("settings.save")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testState.status === "running"}
            className="rounded-sm uppercase tracking-wide"
          >
            {testState.status === "running"
              ? t("settings.testing")
              : t("settings.test")}
          </Button>
          {(saving || testState.status === "running") && <Spinner size="sm" />}
        </div>
      </Panel>

      {/* Documentation-only: future Azure Entra ID auth, visually disabled. */}
      <Panel
        code="AUTH // SSO"
        title={t("settings.authTitle")}
        accent="amber"
        windowButtons
        className="animate-panel-in [animation-delay:60ms]"
      >
        <div aria-disabled="true">
          <div className="flex items-center justify-between gap-3">
            <CodeLabel accent="amber">{t("settings.authTitle")}</CodeLabel>
            <Badge tone="neutral">{t("settings.comingSoon")}</Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            {t("settings.authBody")}
          </p>
          <div className="mt-5 flex flex-col gap-4 opacity-60">
            <Input
              type="text"
              label={t("settings.tenantId")}
              placeholder="00000000-0000-0000-0000-000000000000"
              disabled
              readOnly
            />
            <Input
              type="text"
              label={t("settings.clientId")}
              placeholder="00000000-0000-0000-0000-000000000000"
              disabled
              readOnly
            />
            <div className="pointer-events-none">
              <Button
                variant="secondary"
                disabled
                className="rounded-sm uppercase tracking-wide"
              >
                {t("settings.connectSso")}
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
