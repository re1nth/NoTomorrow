"""Shared pytest fixtures.

We stub the LLM client at the module level for every test. Tests that need a
specific response monkeypatch ``coach.llm.set_client_for_tests`` themselves.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

# Ensure dev defaults exist before any module imports settings.
os.environ.setdefault("COACH_SERVICE_TOKEN", "test-token")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-stub-key")

from coach.llm import LLMClient, set_client_for_tests  # noqa: E402
from coach.llm.client import LLMResponse, PromptCacheUsage  # noqa: E402
from coach.llm.persona import get_persona_blocks  # noqa: E402
from coach.main import create_app  # noqa: E402
from coach.prompts import PromptDef  # noqa: E402
from coach.settings import get_settings  # noqa: E402


class StubLLMClient(LLMClient):
    """Records calls; returns canned responses keyed by prompt id.

    Tests configure ``stub.responses[prompt_id] = ...`` (a string for the raw
    text, or a dict that gets JSON-encoded). The streaming helper yields the
    same text in 16-char slices so SSE flow paths are exercised.
    """

    def __init__(self) -> None:
        super().__init__(api_key="test-stub-key")
        self.responses: dict[str, Any] = {}
        self.calls: list[dict[str, Any]] = []

    def _text_for(self, prompt: PromptDef) -> str:
        canned = self.responses.get(prompt.id)
        if canned is None:
            return "{}"  # safe default; routers should still coerce
        if isinstance(canned, (dict, list)):
            return json.dumps(canned)
        return str(canned)

    async def complete(
        self,
        prompt: PromptDef,
        *,
        user_messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        expect_json: bool = False,
    ) -> LLMResponse:
        text = self._text_for(prompt)
        self.calls.append(
            {
                "prompt_id": prompt.id,
                "model": model,
                "stream": False,
                "block_count": len(prompt.blocks),
                "cache_breakpoint_count": len(prompt.cache_breakpoints),
                "user_messages": user_messages,
            }
        )
        parsed = None
        if expect_json:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = {}
        return LLMResponse(
            text=text,
            model=model or prompt.model,
            stop_reason="end_turn",
            usage=PromptCacheUsage(
                cache_creation_input_tokens=10,
                cache_read_input_tokens=90,
                input_tokens=5,
                output_tokens=20,
            ),
            raw=None,
            parsed_json=parsed,
        )

    async def stream(  # type: ignore[override]
        self,
        prompt: PromptDef,
        *,
        user_messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        text = self._text_for(prompt)
        self.calls.append(
            {
                "prompt_id": prompt.id,
                "model": model,
                "stream": True,
                "block_count": len(prompt.blocks),
                "cache_breakpoint_count": len(prompt.cache_breakpoints),
                "user_messages": user_messages,
            }
        )
        for i in range(0, len(text), 16):
            yield text[i : i + 16]


@pytest.fixture(autouse=True)
def _reset_persona_cache() -> Iterator[None]:
    """Persona file is read once and cached; clear between tests for hygiene."""
    get_persona_blocks.cache_clear()
    yield
    get_persona_blocks.cache_clear()


@pytest.fixture
def stub_client() -> Iterator[StubLLMClient]:
    """A fresh stub client installed as the process-wide LLM client."""
    client = StubLLMClient()
    set_client_for_tests(client)
    try:
        yield client
    finally:
        set_client_for_tests(None)


@pytest.fixture
def app(stub_client: StubLLMClient):  # noqa: ARG001 - implicit install
    # Reset cached settings so any env tweaks land.
    get_settings.cache_clear()
    return create_app()


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}
