"""Anthropic SDK wrapper.

Three things this module owns:

1. Building the ``system`` payload with ``cache_control`` markers on the right
   blocks (persona + user-profile blocks are the hot path).
2. A structured-output helper that prompts the model for JSON and parses it
   defensively (handles markdown fences if the model adds them).
3. An async generator that streams text deltas, surfaced to FastAPI via
   ``sse-starlette``.

We intentionally do not depend on any beta cache APIs — the stable
``anthropic`` SDK accepts ``cache_control`` directly on system content blocks.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass, field
from typing import Any

from coach.prompts import PromptBlock, PromptDef
from coach.settings import get_settings

log = logging.getLogger(__name__)


# --- types ------------------------------------------------------------------


@dataclass
class PromptCacheUsage:
    """Cache hit/miss metadata pulled from Anthropic's ``usage`` block.

    Logged after every call. Cache hit rate is a load-bearing cost metric, not
    a polish item — see ``arch/06-coach-loop.md``.
    """

    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total_input_tokens(self) -> int:
        return self.cache_creation_input_tokens + self.cache_read_input_tokens + self.input_tokens

    @property
    def cache_hit_ratio(self) -> float:
        total = self.total_input_tokens
        if total <= 0:
            return 0.0
        return self.cache_read_input_tokens / total

    @classmethod
    def from_usage(cls, usage: Any | None) -> PromptCacheUsage:
        if usage is None:
            return cls()
        # Both dict-like (mocks) and pydantic models work via getattr/getitem fallback.
        return cls(
            cache_creation_input_tokens=_pick(usage, "cache_creation_input_tokens", 0),
            cache_read_input_tokens=_pick(usage, "cache_read_input_tokens", 0),
            input_tokens=_pick(usage, "input_tokens", 0),
            output_tokens=_pick(usage, "output_tokens", 0),
        )


@dataclass
class LLMResponse:
    """Result of a single non-streaming call."""

    text: str
    model: str
    stop_reason: str | None
    usage: PromptCacheUsage
    raw: Any = None
    parsed_json: dict[str, Any] | None = None


def _pick(obj: Any, name: str, default: Any) -> Any:
    """Read ``obj.name`` or ``obj[name]`` if either exists; else ``default``."""
    try:
        val = getattr(obj, name)
        if val is not None:
            return val
    except AttributeError:
        pass
    if isinstance(obj, dict):
        return obj.get(name, default)
    return default


# --- prompt -> SDK payload --------------------------------------------------


def blocks_to_system_payload(blocks: Iterable[PromptBlock]) -> list[dict[str, Any]]:
    """Translate prompt blocks into the SDK's ``system`` array.

    Every cacheable block gets ``cache_control: {type: "ephemeral"}``. The
    ordering is preserved so the cache prefix is stable across calls.
    """
    payload: list[dict[str, Any]] = []
    for block in blocks:
        item: dict[str, Any] = {"type": "text", "text": block.text}
        if block.cache:
            item["cache_control"] = {"type": "ephemeral"}
        payload.append(item)
    return payload


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def extract_json(text: str) -> dict[str, Any]:
    """Best-effort JSON extraction.

    The prompts ask for ``ONLY a single JSON object, no fences``, but real
    models sometimes still wrap output. This handles fenced and unfenced
    output and raises with the offending text on parse failure so logs are
    useful.
    """
    candidate = text.strip()
    # Strip fences if present.
    fence_match = _JSON_FENCE_RE.search(candidate)
    if fence_match:
        candidate = fence_match.group(1).strip()
    # If the model added a preamble, find the first { and last } as a fallback.
    if not candidate.startswith("{"):
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = candidate[start : end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Model did not return valid JSON: {e}\n--- raw response (truncated) ---\n{text[:1000]}"
        ) from e


# --- client -----------------------------------------------------------------


class LLMClient:
    """Thin async wrapper around the Anthropic SDK.

    Routers should call :func:`get_client` rather than instantiate this
    directly so tests can swap in a fake via :func:`set_client_for_tests`.
    """

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().anthropic_api_key
        self._client: Any | None = None

    def _get_sdk(self) -> Any:
        if self._client is None:
            # Imported lazily so a missing SDK doesn't break import in test/CI.
            from anthropic import AsyncAnthropic  # type: ignore[import-not-found]

            if not self._api_key:
                raise RuntimeError(
                    "ANTHROPIC_API_KEY is not set. Configure it in your environment "
                    "or set EVAL_MOCK=1 to stub the client."
                )
            self._client = AsyncAnthropic(api_key=self._api_key)
        return self._client

    async def complete(
        self,
        prompt: PromptDef,
        *,
        user_messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float | None = None,
        expect_json: bool = False,
    ) -> LLMResponse:
        """One-shot completion. Returns text + cache metadata.

        ``user_messages`` defaults to a single empty-string user turn — most of
        our prompts are entirely system-side and self-contained.
        """
        sdk = self._get_sdk()
        system_payload = blocks_to_system_payload(prompt.blocks)
        msgs = user_messages or [{"role": "user", "content": "Begin."}]
        chosen_model = model or prompt.model

        log.info(
            "anthropic.complete",
            extra={"prompt_id": prompt.id, "model": chosen_model, "stream": False},
        )

        create_kwargs: dict[str, Any] = {
            "model": chosen_model,
            "max_tokens": max_tokens,
            "system": system_payload,
            "messages": msgs,
        }
        if temperature is not None:
            create_kwargs["temperature"] = temperature
        result = await sdk.messages.create(**create_kwargs)

        text = _join_text_blocks(result.content)
        usage = PromptCacheUsage.from_usage(getattr(result, "usage", None))
        log_cache_metrics(prompt.id, chosen_model, usage)

        parsed: dict[str, Any] | None = None
        if expect_json:
            parsed = extract_json(text)

        return LLMResponse(
            text=text,
            model=chosen_model,
            stop_reason=getattr(result, "stop_reason", None),
            usage=usage,
            raw=result,
            parsed_json=parsed,
        )

    async def stream(
        self,
        prompt: PromptDef,
        *,
        user_messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float | None = None,
    ) -> AsyncIterator[str]:
        """Token stream as an async generator of text deltas.

        Cache metrics are logged at the end of the stream when the final
        ``message_delta`` event lands.
        """
        sdk = self._get_sdk()
        system_payload = blocks_to_system_payload(prompt.blocks)
        msgs = user_messages or [{"role": "user", "content": "Begin."}]
        chosen_model = model or prompt.model

        log.info(
            "anthropic.stream",
            extra={"prompt_id": prompt.id, "model": chosen_model, "stream": True},
        )

        # Use the SDK's high-level streaming helper. It yields a sequence of
        # event objects; we only care about text deltas + the final usage.
        stream_kwargs: dict[str, Any] = {
            "model": chosen_model,
            "max_tokens": max_tokens,
            "system": system_payload,
            "messages": msgs,
        }
        if temperature is not None:
            stream_kwargs["temperature"] = temperature
        async with sdk.messages.stream(**stream_kwargs) as stream:
            async for text_delta in stream.text_stream:
                yield text_delta
            final = await stream.get_final_message()
            usage = PromptCacheUsage.from_usage(getattr(final, "usage", None))
            log_cache_metrics(prompt.id, chosen_model, usage)


def _join_text_blocks(content: Any) -> str:
    """Concatenate text from a list of ``ContentBlock`` (or dicts in tests)."""
    if isinstance(content, str):
        return content
    out: list[str] = []
    for block in content or []:
        if isinstance(block, dict):
            if block.get("type") == "text":
                out.append(str(block.get("text", "")))
        else:
            btype = getattr(block, "type", None)
            if btype == "text":
                out.append(str(getattr(block, "text", "")))
    return "".join(out)


def log_cache_metrics(prompt_id: str, model: str, usage: PromptCacheUsage) -> None:
    """Emit one structured log line per call.

    Centralized so the dashboards (and the eval runner) can rely on a single
    keyspace.
    """
    log.info(
        "anthropic.usage",
        extra={
            "prompt_id": prompt_id,
            "model": model,
            "cache_creation_input_tokens": usage.cache_creation_input_tokens,
            "cache_read_input_tokens": usage.cache_read_input_tokens,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cache_hit_ratio": round(usage.cache_hit_ratio, 4),
        },
    )


# --- module singleton + test hook -------------------------------------------


@dataclass
class _ClientHolder:
    client: LLMClient | None = None


_holder = _ClientHolder()


def get_client() -> LLMClient:
    """Return the process-wide :class:`LLMClient`, instantiating lazily."""
    if _holder.client is None:
        _holder.client = LLMClient()
    return _holder.client


def set_client_for_tests(client: LLMClient | None) -> None:
    """Test hook to substitute a fake client (or ``None`` to reset)."""
    _holder.client = client
