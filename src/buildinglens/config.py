"""Central configuration. Reads .env once and exposes typed settings.

Nothing here requires an API key. With LLM_PROVIDER=mock the app runs fully
offline, which keeps `make data && make eval && make run` reproducible.
"""

from __future__ import annotations

import dataclasses
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Repo root = two levels up from this file (src/buildinglens/config.py).
ROOT = Path(__file__).resolve().parents[2]

load_dotenv(ROOT / ".env")


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    anthropic_api_key: str
    openai_api_key: str
    mistral_api_key: str
    anthropic_model: str
    openai_model: str
    mistral_model: str
    ollama_base_url: str
    ollama_model: str
    db_path: Path

    @property
    def has_any_key(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key or self.mistral_api_key)


def load_settings() -> Settings:
    db = _get("BUILDINGLENS_DB", "data/buildinglens.db")
    db_path = (ROOT / db) if not os.path.isabs(db) else Path(db)
    return Settings(
        llm_provider=_get("LLM_PROVIDER", "anthropic").lower(),
        anthropic_api_key=_get("ANTHROPIC_API_KEY"),
        openai_api_key=_get("OPENAI_API_KEY"),
        mistral_api_key=_get("MISTRAL_API_KEY"),
        anthropic_model=_get("ANTHROPIC_MODEL", "claude-opus-4-8"),
        openai_model=_get("OPENAI_MODEL", "gpt-4o"),
        mistral_model=_get("MISTRAL_MODEL", "mistral-large-latest"),
        ollama_base_url=_get("OLLAMA_BASE_URL", "http://localhost:11434"),
        ollama_model=_get("OLLAMA_MODEL", "llama3.1"),
        db_path=db_path,
    )


# ---------------------------------------------------------------------------
# Runtime overlay
# ---------------------------------------------------------------------------
# `Settings` is frozen so it can be shared safely, but the API needs to change
# the provider and keys at runtime without a restart. We never mutate the frozen
# object: we build a NEW instance from the .env defaults plus the persisted
# overrides, then atomically rebind the module globals (and llm.default_settings,
# which captured a reference at import time).
#
# `settings` is kept as the import-time .env snapshot for backward compatibility
# (e.g. deps.get_conn reads settings.db_path, which the overlay never changes).
# Live code paths should call get_settings() to honour runtime changes.

settings = load_settings()

# The effective configuration: .env defaults + persisted runtime overrides.
_effective = load_settings()

# Fields the runtime overlay is allowed to override (db_path stays fixed).
_OVERRIDABLE_FIELDS = (
    "llm_provider",
    "anthropic_api_key",
    "openai_api_key",
    "mistral_api_key",
    "anthropic_model",
    "openai_model",
    "mistral_model",
    "ollama_base_url",
    "ollama_model",
)


def get_settings() -> Settings:
    """Return the live effective settings (defaults + runtime overrides)."""
    return _effective


def _coerced_overrides(raw: dict[str, str]) -> dict[str, str]:
    """Keep only known fields and normalise the provider, like load_settings()."""
    overrides: dict[str, str] = {}
    for field in _OVERRIDABLE_FIELDS:
        if field in raw and raw[field] != "":
            value = raw[field]
            if field == "llm_provider":
                value = value.strip().lower()
            overrides[field] = value
    return overrides


def _rebuild(overrides: dict[str, str]) -> Settings:
    """Build a fresh Settings from .env defaults + overrides and rebind globals.

    Rebinds both this module's `_effective` and `llm.default_settings` so that
    `get_llm()` and any code holding the module reference see the change at once.
    """
    global _effective
    base = load_settings()
    _effective = dataclasses.replace(base, **overrides)

    # Rebind the reference llm.py captured at import time. Imported lazily to
    # avoid a circular import (llm imports config).
    from . import llm

    llm.default_settings = _effective
    return _effective


def load_persisted(conn: sqlite3.Connection) -> Settings:
    """Apply the overrides stored in the database to the effective settings.

    Called at app startup so saved configuration survives a restart.
    """
    from . import db

    overrides = _coerced_overrides(db.read_settings(conn))
    return _rebuild(overrides)


def apply_overrides(conn: sqlite3.Connection, overrides: dict[str, str]) -> Settings:
    """Persist non-empty overrides, then rebuild and rebind the effective settings.

    An empty-string value means "leave unchanged": it is neither persisted nor
    applied, so an existing key is never clobbered with a blank.
    """
    from . import db

    to_persist = _coerced_overrides(overrides)
    if to_persist:
        db.write_settings(conn, to_persist)
    # Rebuild from the full persisted set so this call composes with earlier ones.
    return load_persisted(conn)
