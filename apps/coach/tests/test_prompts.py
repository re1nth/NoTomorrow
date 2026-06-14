"""Prompt loader unit tests against the real prompt files."""

from __future__ import annotations

import pytest

from coach.llm.client import blocks_to_system_payload
from coach.prompts import load_prompt, parse_frontmatter, split_into_blocks


def test_load_persona_has_three_cache_blocks() -> None:
    persona = load_prompt(category="coach", name="persona", version=1)
    names = [b.name for b in persona.blocks]
    assert names[:3] == ["persona", "principles", "examples"]
    assert all(b.cache for b in persona.blocks)
    assert persona.model == "claude-haiku-4-5-20251001"


def test_load_daily_checkin_interpolates() -> None:
    daily = load_prompt(
        category="coach",
        name="daily-checkin",
        version=1,
        inputs={
            "user_handle": "ippo",
            "local_date": "2026-06-14",
            "active_goals": [],
            "rating_snapshot": {"stamina": 1, "expertise": 1},
            "recent_training_log": [],
            "last_submitted_proof": {},
            "open_tasks": [],
        },
    )
    assert "ippo" in daily.system
    assert "2026-06-14" in daily.system
    # cache_breakpoints come from frontmatter
    assert set(daily.cache_breakpoints) >= {"instructions", "user_profile"}


def test_blocks_to_system_payload_marks_cached_blocks() -> None:
    persona = load_prompt(category="coach", name="persona", version=1)
    payload = blocks_to_system_payload(persona.blocks)
    assert all(item["type"] == "text" for item in payload)
    # Every persona block is cached.
    assert all("cache_control" in item for item in payload)
    assert payload[0]["cache_control"] == {"type": "ephemeral"}


def test_parse_frontmatter_rejects_bad_model() -> None:
    with pytest.raises(ValueError):
        parse_frontmatter({"version": 1, "model": "gpt-9"}, "<test>")


def test_split_into_blocks_implicit_head() -> None:
    blocks = split_into_blocks("hello world", [])
    assert len(blocks) == 1
    assert blocks[0].name == "head"
    assert blocks[0].cache is False


def test_split_into_blocks_raises_on_missing_marker() -> None:
    with pytest.raises(ValueError):
        split_into_blocks("hello", ["persona"])
