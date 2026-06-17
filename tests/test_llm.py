from pathlib import Path

import pytest

from buildinglens import llm
from buildinglens.config import Settings


def _keyless_settings(provider: str = "anthropic") -> Settings:
    return Settings(
        llm_provider=provider,
        anthropic_api_key="",
        openai_api_key="",
        mistral_api_key="",
        anthropic_model="claude-opus-4-8",
        openai_model="gpt-4o",
        mistral_model="mistral-large-latest",
        ollama_base_url="http://localhost:11434",
        ollama_model="llama3.1",
        db_path=Path("data/x.db"),
    )


def test_mock_provider_is_deterministic():
    client = llm.get_llm("mock")
    assert isinstance(client, llm.MockClient)
    assert client.complete("hello") == client.complete("hello")


def test_online_provider_without_key_falls_back_to_mock():
    client = llm.get_llm("anthropic", cfg=_keyless_settings("anthropic"))
    assert isinstance(client, llm.MockClient)


def test_extract_json_from_mock():
    data = llm.extract_json(llm.get_llm("mock"), "Return JSON listing defects")
    assert data == {"defects": []}


def test_extract_json_handles_code_fences():
    class Fenced:
        def complete(self, prompt, system=None, max_tokens=4096):
            return '```json\n{"a": 1}\n```'

    assert llm.extract_json(Fenced(), "x") == {"a": 1}


def test_extract_json_raises_on_garbage():
    class Garbage:
        def complete(self, prompt, system=None, max_tokens=4096):
            return "no json here"

    with pytest.raises(ValueError):
        llm.extract_json(Garbage(), "x")


def test_unknown_provider_raises():
    with pytest.raises(ValueError):
        llm.get_llm("nope")
