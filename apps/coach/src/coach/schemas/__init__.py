"""Pydantic mirrors of @notomorrow/domain JSON Schema.

The hand-rolled subset in :mod:`coach.schemas.generated` covers only what the
HTTP surface needs. A regen script (``scripts/gen_pydantic.py``) is provided
for the day we choose to widen this with ``datamodel-code-generator``.
"""

from coach.schemas.generated import (  # noqa: F401
    ChatRequest,
    ChatStreamEvent,
    CoachLine,
    CoachTone,
    DailyCoachRequest,
    DailyCoachResponse,
    GradeProofRequest,
    GradeProofResponse,
    HealthResponse,
    Horizon,
    MilestoneDraft,
    ProofGap,
    ProofKind,
    ProofPayload,
    PunchType,
    RatingDelta,
    RatingSnapshot,
    RecalibrateRequest,
    RecalibrateResponse,
    RoadmapDiff,
    RoadmapGenerateRequest,
    RoadmapStreamEvent,
    TaskBrief,
)
