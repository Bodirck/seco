"""Provider-agnostic LLM wrapper.

One small interface, several backends:

  - anthropic (default), openai, mistral : online providers
  - local                                : a local model via Ollama
  - mock                                 : deterministic fixtures, zero dependencies

The point is reproducibility: extraction, scoring, and RAG call `complete()` or
`extract_json()` and never import a provider SDK directly. With LLM_PROVIDER=mock
the whole pipeline runs offline, so `make eval` gives the same numbers every time.

Provider SDKs are imported lazily, so a missing package only fails if you actually
select that provider. Mock needs nothing installed.
"""

from __future__ import annotations

import json
from typing import Iterator, Protocol

from .config import Settings, settings as default_settings


class LLMClient(Protocol):
    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 4096) -> str: ...

    def stream(
        self, prompt: str, system: str | None = None, max_tokens: int = 4096
    ) -> Iterator[str]:
        """Yield answer text in deltas. Concatenated, the deltas equal complete()."""
        ...


class MockClient:
    """Deterministic offline client. Returns valid JSON for extraction-style prompts.

    Real fixtures for the evaluation set are wired in WP2; this default keeps the
    pipeline runnable end to end with no API key.
    """

    name = "mock"

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 4096) -> str:
        haystack = f"{system or ''}\n{prompt}".lower()
        if "json" in haystack or "defect" in haystack:
            return '{"defects": []}'
        return "[mock] no live model configured; set LLM_PROVIDER and an API key for real output."

    def stream(
        self, prompt: str, system: str | None = None, max_tokens: int = 4096
    ) -> Iterator[str]:
        # Simulate token streaming so the offline path exercises the full
        # streaming pipeline: chunk the canned answer into small word groups.
        text = self.complete(prompt, system=system, max_tokens=max_tokens)
        words = text.split()
        if not words:
            return
        group: list[str] = []
        for word in words:
            group.append(word)
            if len(group) >= 3:
                yield " ".join(group) + " "
                group = []
        if group:
            yield " ".join(group)


class AnthropicClient:
    name = "anthropic"

    def __init__(self, api_key: str, model: str) -> None:
        import anthropic  # lazy

        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 4096) -> str:
        # Note: Opus 4.x rejects temperature/top_p/top_k, so we do not send them.
        kwargs = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system
        resp = self._client.messages.create(**kwargs)
        return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")

    def stream(
        self, prompt: str, system: str | None = None, max_tokens: int = 4096
    ) -> Iterator[str]:
        kwargs: dict = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system
        with self._client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                if text:
                    yield text


class OpenAIClient:
    name = "openai"

    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI  # lazy

        self._client = OpenAI(api_key=api_key)
        self._model = model

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 4096) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = self._client.chat.completions.create(
            model=self._model, messages=messages, max_tokens=max_tokens
        )
        return resp.choices[0].message.content or ""

    def stream(
        self, prompt: str, system: str | None = None, max_tokens: int = 4096
    ) -> Iterator[str]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        chunks = self._client.chat.completions.create(
            model=self._model, messages=messages, max_tokens=max_tokens, stream=True
        )
        for chunk in chunks:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


class MistralClient:
    name = "mistral"

    def __init__(self, api_key: str, model: str) -> None:
        from mistralai import Mistral  # lazy

        self._client = Mistral(api_key=api_key)
        self._model = model

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 4096) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = self._client.chat.complete(
            model=self._model, messages=messages, max_tokens=max_tokens
        )
        return resp.choices[0].message.content or ""

    def stream(
        self, prompt: str, system: str | None = None, max_tokens: int = 4096
    ) -> Iterator[str]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        events = self._client.chat.stream(
            model=self._model, messages=messages, max_tokens=max_tokens
        )
        for event in events:
            delta = event.data.choices[0].delta.content
            if delta:
                yield delta


class OllamaClient:
    """Local model via Ollama's HTTP API. No API key, runs on the user's machine."""

    name = "local"

    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 4096) -> str:
        import requests  # lazy

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = requests.post(
            f"{self._base_url}/api/chat",
            json={"model": self._model, "messages": messages, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "")

    def stream(
        self, prompt: str, system: str | None = None, max_tokens: int = 4096
    ) -> Iterator[str]:
        import requests  # lazy

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        with requests.post(
            f"{self._base_url}/api/chat",
            json={"model": self._model, "messages": messages, "stream": True},
            timeout=120,
            stream=True,
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                obj = json.loads(line)
                piece = obj.get("message", {}).get("content", "")
                if piece:
                    yield piece
                if obj.get("done"):
                    break


def get_llm(provider: str | None = None, cfg: Settings | None = None) -> LLMClient:
    """Build the client for the configured (or requested) provider.

    Defaults to the *live* effective settings (config.get_settings()) so a runtime
    change made via the settings API takes effect immediately, with no restart.
    Falls back to mock when an online provider is selected but its key is missing,
    so the pipeline never hard-fails for lack of a key. The returned client's type
    name (e.g. AnthropicClient, MockClient) reflects the ACTUALLY active backend,
    which lets callers detect a silent mock fallback.
    """
    if cfg is None:
        # Imported lazily to keep using the rebound effective settings and to
        # avoid any import-order surprises (config imports nothing from llm at top level).
        from . import config

        cfg = config.get_settings()
    provider = (provider or cfg.llm_provider).lower()

    if provider == "mock":
        return MockClient()
    if provider == "anthropic":
        if not cfg.anthropic_api_key:
            return MockClient()
        return AnthropicClient(cfg.anthropic_api_key, cfg.anthropic_model)
    if provider == "openai":
        if not cfg.openai_api_key:
            return MockClient()
        return OpenAIClient(cfg.openai_api_key, cfg.openai_model)
    if provider == "mistral":
        if not cfg.mistral_api_key:
            return MockClient()
        return MistralClient(cfg.mistral_api_key, cfg.mistral_model)
    if provider == "local":
        return OllamaClient(cfg.ollama_base_url, cfg.ollama_model)
    raise ValueError(f"Unknown LLM provider: {provider!r}")


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        # remove the opening fence (optionally "```json") and the closing fence
        text = text.split("\n", 1)[-1] if "\n" in text else text
        if text.endswith("```"):
            text = text[: -3]
    return text.strip()


def extract_json(client: LLMClient, prompt: str, system: str | None = None, max_tokens: int = 4096) -> dict:
    """Call the model and parse a JSON object from the reply.

    Tolerant of code fences and leading prose. Raises ValueError if no JSON object
    can be parsed, so callers can decide how to handle a malformed response.
    """
    raw = client.complete(prompt, system=system, max_tokens=max_tokens)
    cleaned = _strip_code_fences(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                pass
    raise ValueError(f"Could not parse JSON from model output: {raw[:200]!r}")
