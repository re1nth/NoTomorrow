"""Roadmap endpoints: ``POST /roadmap/generate`` (SSE) and ``POST /roadmap/recalibrate``.

Generation streams milestones as the model produces them. We approximate
incremental milestone emission by:

1. Calling the Opus model in streaming mode.
2. Accumulating text and watching for milestone-shaped JSON objects to flush.
3. Emitting an SSE ``milestone`` event per detected milestone, then a final
   ``done`` event with the persisted roadmap id.

For the v1 cut we tolerate a single final JSON object — the streaming UI gets
incremental visual feedback (events flush as soon as the object is parseable)
and we don't try to parse partial JSON in flight.
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from coach.auth import require_service_token
from coach.llm import LLMClient, get_client
from coach.llm.client import extract_json
from coach.prompts import load_prompt
from coach.routers.daily import _stitch_with_persona
from coach.schemas.generated import (
    MilestoneDeliverable,
    MilestoneDraft,
    RecalibrateRequest,
    RecalibrateResponse,
    RoadmapDiff,
    RoadmapDiffAdd,
    RoadmapDiffRemove,
    RoadmapDiffReschedule,
    RoadmapDiffRetitle,
    RoadmapGenerateRequest,
    TaskBrief,
)
from coach.settings import get_settings

router = APIRouter(prefix="/roadmap", tags=["roadmap"])
log = logging.getLogger(__name__)


def _sse(event_type: str, data: dict) -> dict:
    """Build an sse-starlette event payload."""
    return {"event": event_type, "data": json.dumps(data, ensure_ascii=False)}


async def _generate_event_stream(
    body: RoadmapGenerateRequest,
    client: LLMClient,
    request: Request,
) -> AsyncIterator[dict]:
    per_call = load_prompt(
        category="roadmap",
        name="generate",
        version=1,
        inputs={
            "user_handle": body.userHandle,
            "goal_title": body.goalTitle,
            "goal_motivation": body.goalMotivation,
            "horizon": body.horizon,
            "target_date": body.targetDate,
            "rating_snapshot": body.ratingSnapshot.model_dump(),
            "domain_hint": body.domainHint or "",
            "prior_goals": body.priorGoals,
        },
    )
    stitched = _stitch_with_persona(per_call)
    settings = get_settings()

    yield _sse("goal_created", {"type": "goal_created", "goalId": body.goalId})

    accumulated: list[str] = []
    try:
        async for delta in client.stream(
            stitched,
            model=settings.coach_model_heavy,
            max_tokens=4096,
        ):
            if await request.is_disconnected():
                log.info("roadmap.generate.client_disconnected")
                return
            accumulated.append(delta)
    except Exception as e:
        log.exception("roadmap.generate.llm_failure")
        yield _sse("error", {"type": "error", "message": f"LLM stream failed: {e}"})
        return

    full = "".join(accumulated)
    try:
        parsed = extract_json(full)
    except ValueError as e:
        yield _sse("error", {"type": "error", "message": str(e)})
        return

    roadmap_id = str(uuid.uuid4())
    milestones_raw = parsed.get("milestones") or []
    for raw in milestones_raw:
        if not isinstance(raw, dict):
            continue
        try:
            milestone = _to_milestone_draft(raw)
        except Exception as e:  # noqa: BLE001 - one malformed entry shouldn't kill the stream
            log.warning("roadmap.generate.milestone_skip", extra={"error": str(e)})
            continue
        yield _sse(
            "milestone",
            {"type": "milestone", "milestone": milestone.model_dump()},
        )

    yield _sse(
        "done",
        {
            "type": "done",
            "roadmapId": roadmap_id,
            "coachNote": str(parsed.get("coachNote", "")),
        },
    )


def _to_milestone_draft(raw: dict) -> MilestoneDraft:
    """Coerce a raw milestone dict (camelCase from the model) into our schema."""
    deliv = raw.get("deliverable") or {}
    deliverable = MilestoneDeliverable(
        kind=deliv.get("kind", "writeup"),
        description=str(deliv.get("description", "")) or "(no description)",
    )
    tasks: list[TaskBrief] = []
    for t in raw.get("tasks") or []:
        if not isinstance(t, dict):
            continue
        ptype = str(t.get("type", "jab"))
        if ptype == "dempseyRoll":
            ptype = "dempsey_roll"
        tasks.append(
            TaskBrief(
                title=str(t.get("title", "")) or "(untitled)",
                type=ptype,  # type: ignore[arg-type]
                estMinutes=int(t.get("estMinutes") or t.get("est_minutes") or 30),
            )
        )
    return MilestoneDraft(
        order=int(raw.get("order", 0)),
        title=str(raw.get("title", "")) or "(untitled)",
        deliverable=deliverable,
        dueOffsetDays=int(raw.get("dueOffsetDays") or raw.get("due_offset_days") or 0),
        tasks=tasks,
        rationale=str(raw.get("rationale", "")),
    )


@router.post("/generate", dependencies=[Depends(require_service_token)])
async def generate_roadmap(
    body: RoadmapGenerateRequest,
    request: Request,
    client: LLMClient = Depends(get_client),
) -> EventSourceResponse:
    """SSE: streams ``goal_created`` -> ``milestone``* -> ``done`` / ``error``."""
    return EventSourceResponse(_generate_event_stream(body, client, request))


@router.post(
    "/recalibrate",
    response_model=RecalibrateResponse,
    dependencies=[Depends(require_service_token)],
)
async def recalibrate_roadmap(
    body: RecalibrateRequest,
    client: LLMClient = Depends(get_client),
) -> RecalibrateResponse:
    per_call = load_prompt(
        category="roadmap",
        name="recalibrate",
        version=1,
        inputs={
            "user_handle": body.userHandle,
            "goal_title": body.goalTitle,
            "current_roadmap": body.currentRoadmap,
            "week_summary": body.weekSummary,
            "rating_snapshot": body.ratingSnapshot.model_dump(),
            "rating_history_4w": body.ratingHistory4w,
            "today_date": body.todayDate,
        },
    )
    stitched = _stitch_with_persona(per_call)
    settings = get_settings()
    try:
        result = await client.complete(
            stitched,
            model=settings.coach_model_heavy,
            max_tokens=2500,
            expect_json=True,
        )
    except Exception as e:
        log.exception("roadmap.recalibrate.llm_failure")
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    return _shape_recalibrate(result.parsed_json or {})


def _shape_recalibrate(raw: dict) -> RecalibrateResponse:
    diff_raw = raw.get("diff") or {}

    def _deliverable(d: dict) -> MilestoneDeliverable:
        return MilestoneDeliverable(
            kind=d.get("kind", "writeup"),
            description=str(d.get("description", "")) or "(no description)",
        )

    diff = RoadmapDiff(
        add=[
            RoadmapDiffAdd(
                afterOrder=item.get("afterOrder"),
                title=str(item.get("title", "")),
                deliverable=_deliverable(item.get("deliverable") or {}),
                dueOffsetDays=int(item.get("dueOffsetDays") or 0),
                rationale=str(item.get("rationale", "")),
            )
            for item in (diff_raw.get("add") or [])
            if isinstance(item, dict)
        ],
        remove=[
            RoadmapDiffRemove(
                order=int(item.get("order", 0)),
                reason=str(item.get("reason", "")),
            )
            for item in (diff_raw.get("remove") or [])
            if isinstance(item, dict)
        ],
        retitle=[
            RoadmapDiffRetitle(
                order=int(item.get("order", 0)),
                newTitle=str(item.get("newTitle", "")),
                newDeliverable=_deliverable(item.get("newDeliverable") or {}),
                reason=str(item.get("reason", "")),
            )
            for item in (diff_raw.get("retitle") or [])
            if isinstance(item, dict)
        ],
        reschedule=[
            RoadmapDiffReschedule(
                order=int(item.get("order", 0)),
                newDueOffsetDays=int(item.get("newDueOffsetDays") or 0),
                reason=str(item.get("reason", "")),
            )
            for item in (diff_raw.get("reschedule") or [])
            if isinstance(item, dict)
        ],
    )
    return RecalibrateResponse(
        summary=str(raw.get("summary", "")),
        diff=diff,
        noOp=bool(raw.get("noOp", False)),
        coachLine=str(raw.get("coachLine", "")),
    )
