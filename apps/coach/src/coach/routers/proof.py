"""``POST /proof/grade`` — structured-output proof grading.

Calls Opus with the proof artifact and the task it claims to satisfy. Returns
the structured grade the App API will use to write a ``RatingEvent`` (on pass)
or a ``CoachMessage`` with revision asks (on fail).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from coach.auth import require_service_token
from coach.llm import LLMClient, get_client
from coach.prompts import load_prompt
from coach.routers.daily import _stitch_with_persona
from coach.schemas.generated import (
    GradeProofRequest,
    GradeProofResponse,
    ProofGap,
    RatingDelta,
)
from coach.settings import get_settings

router = APIRouter(prefix="/proof", tags=["proof"])
log = logging.getLogger(__name__)


@router.post(
    "/grade",
    response_model=GradeProofResponse,
    dependencies=[Depends(require_service_token)],
)
async def grade_proof(
    body: GradeProofRequest,
    client: LLMClient = Depends(get_client),
) -> GradeProofResponse:
    per_call = load_prompt(
        category="proof",
        name="grade",
        version=1,
        inputs={
            "task_title": body.taskTitle,
            "task_type": body.taskType,
            "milestone_title": body.milestoneTitle,
            "milestone_deliverable": body.milestoneDeliverable.model_dump(),
            "proof_kind": body.proofKind,
            "proof_payload": body.proofPayload,
            "user_rating": body.userRating.model_dump(),
        },
    )
    stitched = _stitch_with_persona(per_call)

    settings = get_settings()
    try:
        result = await client.complete(
            stitched,
            model=settings.coach_model_heavy,
            max_tokens=1500,
            expect_json=True,
        )
    except Exception as e:
        log.exception("proof.llm_failure", extra={"task_id": body.taskId})
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    return _shape_grade(result.parsed_json or {})


def _shape_grade(raw: dict) -> GradeProofResponse:
    """Coerce model JSON into our response, defaulting safely on missing fields."""
    shipped = bool(raw.get("shipped", False))
    quality_raw = raw.get("quality", 1)
    try:
        quality = max(1, min(5, int(quality_raw)))
    except (TypeError, ValueError):
        quality = 1
    if not shipped:
        quality = 1  # enforce the prompt's invariant

    gaps_raw = raw.get("gaps") or []
    gaps: list[ProofGap] = []
    for g in gaps_raw:
        if not isinstance(g, dict):
            continue
        severity = g.get("severity", "minor")
        if severity not in ("blocker", "major", "minor"):
            severity = "minor"
        gaps.append(
            ProofGap(
                severity=severity,
                description=str(g.get("description", "")) or "Unspecified gap.",
                evidence=str(g.get("evidence", "")),
            )
        )

    delta_raw = raw.get("ratingDelta") or raw.get("rating_delta") or {}
    delta = RatingDelta(
        stamina=int(delta_raw.get("stamina", 0) or 0),
        expertise=int(delta_raw.get("expertise", 0) or 0),
    )

    return GradeProofResponse(
        shipped=shipped,
        quality=quality,
        gaps=gaps,
        verdict=str(raw.get("verdict", "")),
        ratingDelta=delta,
    )
