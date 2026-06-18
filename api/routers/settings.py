"""Runtime LLM configuration endpoints.

Lets an operator change the LLM provider, models and API keys at runtime from the
UI. Changes are persisted in SQLite (app_settings) and applied without a server
restart. The raw API key is NEVER returned by any endpoint: callers only see
whether a key is set and its last four characters.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from buildinglens import config
from buildinglens.llm import get_llm

from ..deps import get_conn

router = APIRouter(tags=["settings"])

_VALID_PROVIDERS = {"anthropic", "openai", "mistral", "local", "mock"}


class SettingsUpdate(BaseModel):
    provider: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    mistral_api_key: str | None = None
    anthropic_model: str | None = None
    openai_model: str | None = None
    mistral_model: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None


class TestBody(BaseModel):
    provider: str | None = None


def _scrub(message: str, cfg: config.Settings) -> str:
    """Remove any configured API key from an error message before returning it."""
    for key in (cfg.anthropic_api_key, cfg.openai_api_key, cfg.mistral_api_key):
        if key:
            message = message.replace(key, "***")
    return message


def _tail(key: str) -> str | None:
    return key[-4:] if key else None


def _effective_name() -> str:
    """Type name of the client get_llm() would actually build for the live config.

    Building a client can raise if the provider's SDK is not installed (clients
    import their SDK lazily). The settings snapshot must never 500 over that, so
    we report "MockClient" (the safe runtime fallback) instead of propagating.
    """
    try:
        return type(get_llm()).__name__
    except Exception:  # noqa: BLE001 - reporting must not crash the endpoint
        return "MockClient"


def _snapshot() -> dict:
    """Build the public settings object (never includes a raw key)."""
    cfg = config.get_settings()
    effective = _effective_name()
    return {
        "provider": cfg.llm_provider,
        "effective": effective,
        "anthropic_model": cfg.anthropic_model,
        "openai_model": cfg.openai_model,
        "mistral_model": cfg.mistral_model,
        "ollama_base_url": cfg.ollama_base_url,
        "ollama_model": cfg.ollama_model,
        "has_key": {
            "anthropic": bool(cfg.anthropic_api_key),
            "openai": bool(cfg.openai_api_key),
            "mistral": bool(cfg.mistral_api_key),
        },
        "key_tail": {
            "anthropic": _tail(cfg.anthropic_api_key),
            "openai": _tail(cfg.openai_api_key),
            "mistral": _tail(cfg.mistral_api_key),
        },
    }


@router.get("/settings")
def get_settings_endpoint():
    """Return the current configuration. The raw API key is never exposed."""
    return _snapshot()


@router.put("/settings")
def update_settings(body: SettingsUpdate, conn=Depends(get_conn)):
    """Apply and persist configuration overrides, then return the new state.

    An empty-string key means "leave unchanged"; only a non-empty value updates a
    field. `provider` maps to the core's llm_provider field.
    """
    overrides: dict[str, str] = {}
    if body.provider is not None:
        provider = body.provider.strip().lower()
        if provider not in _VALID_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unknown provider '{body.provider}'. Choose one of: "
                    f"{', '.join(sorted(_VALID_PROVIDERS))}."
                ),
            )
        overrides["llm_provider"] = provider
    for field in (
        "anthropic_api_key",
        "openai_api_key",
        "mistral_api_key",
        "anthropic_model",
        "openai_model",
        "mistral_model",
        "ollama_base_url",
        "ollama_model",
    ):
        value = getattr(body, field)
        if value is not None:
            overrides[field] = value

    config.apply_overrides(conn, overrides)
    return _snapshot()


@router.post("/settings/test")
def test_settings(body: TestBody):
    """Run a real liveness check against the chosen (or current) provider."""
    cfg = config.get_settings()
    provider = (body.provider or cfg.llm_provider).strip().lower()

    if provider == "mock":
        return {
            "ok": True,
            "provider": provider,
            "effective": "MockClient",
            "message": "Mock provider is always available (offline, deterministic).",
        }

    try:
        client = get_llm(provider, cfg)
        effective = type(client).__name__

        # A mock fallback means the selected online provider has no key configured.
        if effective == "MockClient":
            return {
                "ok": False,
                "provider": provider,
                "effective": effective,
                "message": f"No API key configured for provider '{provider}'; falling back to mock.",
            }

        if provider == "local":
            # Ollama: a cheap reachability check is enough.
            import requests

            base = cfg.ollama_base_url.rstrip("/")
            requests.get(f"{base}/api/tags", timeout=5).raise_for_status()
            message = f"Ollama reachable at {base}."
        else:
            reply = client.complete("ping")
            preview = (reply or "").strip().replace("\n", " ")[:80]
            message = f"Live response received: {preview!r}" if preview else "Live response received."
        return {"ok": True, "provider": provider, "effective": effective, "message": message}
    except Exception as exc:  # noqa: BLE001 - we surface a scrubbed message to the UI
        return {
            "ok": False,
            "provider": provider,
            "effective": "MockClient",
            "message": _scrub(f"{type(exc).__name__}: {exc}", cfg),
        }
