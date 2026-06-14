"""``POST /coach/daily`` — daily check-in.

This is the integration template for the rest of the routers:
1. Load the persona once (cached, used for ``cache_control`` on the persona block).
2. Load the per-call prompt with user-specific inputs.
3. Stitch the persona blocks in front of the daily prompt's blocks so the cached
   prefix is identical across users.
4. Call the light-tier model (Haiku) asking for JSON.
5. Coerce into :class:`DailyCoachResponse` and return.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from coach.auth import require_service_token
from coach.llm import LLMClient, get_client
from coach.llm.persona import get_persona_blocks
from coach.prompts import PromptDef, load_prompt
from coach.schemas.generated import (
    CoachLine,
    DailyCoachRequest,
    DailyCoachResponse,
    DailyTask,
)
from coach.settings import get_settings

router = APIRouter(prefix="/coach", tags=["coach"])
log = logging.getLogger(__name__)


def _stitch_with_persona(per_call: PromptDef) -> PromptDef:
    """Prepend cached persona blocks to a per-call prompt.

    Order matters for prompt caching: persona is the stable prefix, the
    per-call prompt is the suffix. We rebuild the ``PromptDef`` rather than
    mutate it so the loader's outputs stay immutable.
    """
    persona_blocks = get_persona_blocks()
    all_blocks = list(persona_blocks) + list(per_call.blocks)
    return PromptDef(
        id=per_call.id,
        category=per_call.category,
        name=per_call.name,
        version=per_call.version,
        model=per_call.model,
        system="\n\n".join(b.text for b in all_blocks),
        blocks=all_blocks,
        cache_breakpoints=[b.name for b in all_blocks if b.cache],
        inputs=per_call.inputs,
        frontmatter=per_call.frontmatter,
    )


@router.post(
    "/daily",
    response_model=DailyCoachResponse,
    dependencies=[Depends(require_service_token)],
)
async def daily_checkin(
    body: DailyCoachRequest,
    client: LLMClient = Depends(get_client),
) -> DailyCoachResponse:
    """Generate today's primary task, optional stretch task, and coach line."""
    per_call = load_prompt(
        category="coach",
        name="daily-checkin",
        version=1,
        inputs={
            "user_handle": body.userHandle,
            "local_date": body.localDate,
            "active_goals": [g.model_dump() for g in body.activeGoals],
            "rating_snapshot": body.ratingSnapshot.model_dump(),
            "recent_training_log": [t.model_dump() for t in body.recentTrainingLog],
            "last_submitted_proof": body.lastSubmittedProof or {},
            "open_tasks": [t.model_dump() for t in body.openTasks],
        },
    )
    stitched = _stitch_with_persona(per_call)

    settings = get_settings()
    try:
        result = await client.complete(
            stitched,
            model=settings.coach_model_light,
            max_tokens=1024,
            expect_json=True,
        )
    except Exception as e:  # pragma: no cover - exercised via failing tests
        log.exception("daily.llm_failure", extra={"user_id": body.userId})
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    return _shape_daily_response(result.parsed_json or {})


def _shape_daily_response(raw: dict) -> DailyCoachResponse:
    """Map the model's JSON into our response contract.

    The prompt asks for ``primaryTask``, ``stretchTask``, ``coachLine`` —
    if the model uses slightly different casing (``primary_task``) or adds
    ``ratingDelta``, we normalize quietly rather than 500.
    """
    primary = raw.get("primaryTask") or raw.get("primary_task") or {}
    stretch = raw.get("stretchTask") if "stretchTask" in raw else raw.get("stretch_task")
    line_raw = raw.get("coachLine") or raw.get("coach_line") or ""

    # ``coachLine`` may be a string (per prompt) or an object with body/tone.
    if isinstance(line_raw, str):
        line = CoachLine(body=line_raw or "Throw the next punch.", tone="stern")
    elif isinstance(line_raw, dict):
        line = CoachLine(
            body=str(line_raw.get("body") or "Throw the next punch."),
            tone=line_raw.get("tone", "stern"),  # type: ignore[arg-type]
        )
    else:
        line = CoachLine(body="Throw the next punch.", tone="stern")

    primary_task = _shape_task(primary, required=True)
    assert primary_task is not None  # required path always returns
    stretch_task = _shape_task(stretch, required=False)

    return DailyCoachResponse(
        primaryTask=primary_task,
        stretchTask=stretch_task,
        coachLine=line,
    )


def _shape_task(raw: dict | None, *, required: bool) -> DailyTask | None:
    """Normalize a task dict from the model.

    The prompt uses ``"dempseyRoll"`` (camelCase) but our enum is
    ``"dempsey_roll"`` — we lowercase + snake_case the punch type.
    """
    if not raw:
        if required:
            return DailyTask(
                title="Pick the next punch.",
                type="jab",
                estMinutes=30,
                rationale="Coach did not return a primary task; please review prompt eval.",
            )
        return None

    punch = str(raw.get("type", "jab"))
    if punch == "dempseyRoll":
        punch = "dempsey_roll"
    return DailyTask(
        title=str(raw.get("title", "")),
        type=punch,  # type: ignore[arg-type]
        estMinutes=int(raw.get("estMinutes") or raw.get("est_minutes") or 30),
        rationale=str(raw.get("rationale", "")),
    )
