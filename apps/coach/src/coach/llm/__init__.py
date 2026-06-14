"""LLM layer: Anthropic SDK wrapper, prompt-cache plumbing, streaming helpers."""

from coach.llm.client import (
    LLMClient,
    LLMResponse,
    PromptCacheUsage,
    blocks_to_system_payload,
    get_client,
    set_client_for_tests,
)

__all__ = [
    "LLMClient",
    "LLMResponse",
    "PromptCacheUsage",
    "blocks_to_system_payload",
    "get_client",
    "set_client_for_tests",
]
