"""``GET /healthz`` — liveness probe + introspection.

Returns the active model IDs and the prompt versions currently shipped, so a
deploy can be sanity-checked from the outside.
"""

from __future__ import annotations

from fastapi import APIRouter

from coach.schemas.generated import HealthResponse
from coach.settings import get_settings

router = APIRouter(tags=["health"])

# Hardcoded prompt versions live here; bump when you ship a new version of a
# prompt. Kept in code (not env) so the deploy artifact carries the source of
# truth.
_PROMPT_VERSIONS: dict[str, int] = {
    "coach/persona": 1,
    "coach/daily-checkin": 1,
    "coach/chat-system": 1,
    "proof/grade": 1,
    "roadmap/generate": 1,
    "roadmap/recalibrate": 1,
}


@router.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        model_versions={
            "heavy": settings.coach_model_heavy,
            "light": settings.coach_model_light,
        },
        prompt_versions=dict(_PROMPT_VERSIONS),
    )
