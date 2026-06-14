"""Coach persona loader.

The persona is ~5k tokens, identical across users, and prepended as the first
cached block on every coach-facing call. Cached in-process so we don't re-read
the file per request.
"""

from __future__ import annotations

from functools import lru_cache

from coach.prompts import PromptBlock, load_prompt


@lru_cache(maxsize=1)
def get_persona_blocks() -> list[PromptBlock]:
    """Return the persona prompt's cache blocks (without the user-specific suffix).

    Cached on import so the file is read at most once per process. Tests that
    point ``COACH_PROMPTS_ROOT`` at a fixture should call
    ``get_persona_blocks.cache_clear()`` after re-setting the env.
    """
    persona = load_prompt(category="coach", name="persona", version=1)
    return list(persona.blocks)
