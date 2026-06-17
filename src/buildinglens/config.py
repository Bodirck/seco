"""Central configuration. Reads .env once and exposes typed settings.

Nothing here requires an API key. With LLM_PROVIDER=mock the app runs fully
offline, which keeps `make data && make eval && make run` reproducible.
"""

from __future__ import annotations

import os
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


settings = load_settings()
