"""Pydantic models for the HTTP surface.

**Codegen note.** The plan offers two options for keeping these in sync with
``@notomorrow/domain``: ``datamodel-code-generator`` or a hand-rolled subset.
We chose hand-rolled for v1 for three reasons:

1. The coach service only consumes a narrow slice of the domain schema (daily,
   proof, roadmap, chat). Generating the full ``api`` group buries us in
   ``Union`` types we don't use.
2. The generator emits one file with every model, which hurts diffs and makes
   the cache-control story harder to teach.
3. The mapping from JSON Schema enums to Python enums is mechanical but
   slightly opinionated (``Literal`` vs ``StrEnum``); writing it ourselves
   keeps imports stable for callers.

``scripts/gen_pydantic.py`` runs ``datamodel-code-generator`` and writes
``coach/schemas/codegen_full.py`` if you ever want to migrate. The fields here
are written to match the domain JSON Schema exactly so a future swap is a
mechanical rename.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# -- Enums (mirrored from packages/domain/src/enums.ts) ----------------------

CoachTone = Literal["hype", "stern", "analytical", "warm"]
PunchType = Literal["jab", "hook", "uppercut", "dempsey_roll"]
Horizon = Literal["1w", "1m", "3m", "1y"]
ProofKind = Literal["repo", "url", "video", "writeup"]
MilestoneStatus = Literal["locked", "current", "cleared", "failed"]
TaskStatus = Literal["pending", "submitted", "verified", "rejected"]
GoalStatus = Literal["draft", "active", "paused", "won", "abandoned"]
RoadmapDeliverableKind = Literal["repo", "url", "video", "writeup"]


# -- Shared building blocks --------------------------------------------------


class StrictModel(BaseModel):
    """Project-wide default: forbid unknown fields, populate_by_name on."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class RatingDelta(StrictModel):
    stamina: int
    expertise: int


class RatingSnapshot(StrictModel):
    """Snapshot the prompts use to calibrate ambition vs current level."""

    stamina: int = Field(ge=0)
    expertise: int = Field(ge=0)
    delta7d: RatingDelta | None = None


class TaskBrief(StrictModel):
    """One pending task — minimal shape used in daily/chat context."""

    title: str = Field(min_length=1, max_length=200)
    type: PunchType
    estMinutes: int = Field(gt=0)
    dueDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class GoalBrief(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    horizon: Horizon
    currentMilestoneTitle: str | None = None


class TrainingLogEntry(StrictModel):
    """A single TrainingLog row, trimmed for prompt context."""

    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    mood: int = Field(ge=1, le=5)
    hoursTrained: float = Field(ge=0, le=24)
    blockers: str = Field(default="", max_length=2000)


# -- Proof types -------------------------------------------------------------


class RepoProofPayload(StrictModel):
    kind: Literal["repo"]
    url: str
    commitSha: str | None = Field(default=None, min_length=7, max_length=64)


class UrlProofPayload(StrictModel):
    kind: Literal["url"]
    url: str


class VideoProofPayload(StrictModel):
    kind: Literal["video"]
    url: str
    durationSeconds: int | None = Field(default=None, gt=0)


class WriteupProofPayload(StrictModel):
    kind: Literal["writeup"]
    markdown: str = Field(min_length=1, max_length=50000)


ProofPayload = Annotated[
    RepoProofPayload | UrlProofPayload | VideoProofPayload | WriteupProofPayload,
    Field(discriminator="kind"),
]


class MilestoneDeliverable(StrictModel):
    kind: RoadmapDeliverableKind
    description: str = Field(min_length=1, max_length=2000)


# -- /coach/daily ------------------------------------------------------------


class DailyCoachRequest(StrictModel):
    """Input contract for ``POST /coach/daily``.

    Callers (Inngest cron) gather the context off Postgres and pass it in; the
    coach service does not query the DB for this endpoint to keep the loop
    independently testable.
    """

    userId: str = Field(description="UUID of the target user (echoed in logs).")
    userHandle: str = Field(min_length=2, max_length=32)
    localDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    activeGoals: list[GoalBrief] = Field(default_factory=list)
    ratingSnapshot: RatingSnapshot
    recentTrainingLog: list[TrainingLogEntry] = Field(default_factory=list)
    lastSubmittedProof: dict[str, Any] | None = None
    openTasks: list[TaskBrief] = Field(default_factory=list)


class CoachLine(StrictModel):
    body: str = Field(min_length=1, max_length=2000)
    tone: CoachTone


class DailyTask(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    type: PunchType
    estMinutes: int = Field(gt=0)
    rationale: str = Field(default="", max_length=500)


class DailyCoachResponse(StrictModel):
    primaryTask: DailyTask
    stretchTask: DailyTask | None
    coachLine: CoachLine


# -- /proof/grade ------------------------------------------------------------


class GradeProofRequest(StrictModel):
    taskId: str
    taskTitle: str = Field(min_length=1, max_length=200)
    taskType: PunchType
    milestoneTitle: str = Field(min_length=1, max_length=200)
    milestoneDeliverable: MilestoneDeliverable
    proofKind: ProofKind
    proofPayload: dict[str, Any]
    userRating: RatingSnapshot


class ProofGap(StrictModel):
    severity: Literal["blocker", "major", "minor"]
    description: str = Field(min_length=1, max_length=500)
    evidence: str = Field(default="", max_length=2000)


class GradeProofResponse(StrictModel):
    shipped: bool
    quality: int = Field(ge=1, le=5)
    gaps: list[ProofGap] = Field(default_factory=list)
    verdict: str = Field(default="", max_length=2000)
    ratingDelta: RatingDelta = Field(default_factory=lambda: RatingDelta(stamina=0, expertise=0))


# -- /roadmap/generate (SSE) -------------------------------------------------


class RoadmapGenerateRequest(StrictModel):
    userId: str
    goalId: str
    userHandle: str = Field(min_length=2, max_length=32)
    goalTitle: str = Field(min_length=1, max_length=200)
    goalMotivation: str = Field(default="", max_length=2000)
    horizon: Horizon
    targetDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    ratingSnapshot: RatingSnapshot
    domainHint: str | None = Field(default=None, max_length=64)
    priorGoals: list[str] = Field(default_factory=list)


class MilestoneDraft(StrictModel):
    order: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=200)
    deliverable: MilestoneDeliverable
    dueOffsetDays: int = Field(ge=0)
    tasks: list[TaskBrief] = Field(default_factory=list)
    rationale: str = Field(default="", max_length=500)


class RoadmapStreamGoalCreated(StrictModel):
    type: Literal["goal_created"] = "goal_created"
    goalId: str


class RoadmapStreamMilestone(StrictModel):
    type: Literal["milestone"] = "milestone"
    milestone: MilestoneDraft


class RoadmapStreamDone(StrictModel):
    type: Literal["done"] = "done"
    roadmapId: str
    coachNote: str = ""


class RoadmapStreamError(StrictModel):
    type: Literal["error"] = "error"
    message: str


RoadmapStreamEvent = Annotated[
    RoadmapStreamGoalCreated | RoadmapStreamMilestone | RoadmapStreamDone | RoadmapStreamError,
    Field(discriminator="type"),
]


# -- /roadmap/recalibrate ---------------------------------------------------


class RecalibrateRequest(StrictModel):
    userId: str
    goalId: str
    userHandle: str = Field(min_length=2, max_length=32)
    goalTitle: str = Field(min_length=1, max_length=200)
    currentRoadmap: dict[str, Any]
    weekSummary: dict[str, Any]
    ratingSnapshot: RatingSnapshot
    ratingHistory4w: list[dict[str, Any]] = Field(default_factory=list)
    todayDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class RoadmapDiffAdd(StrictModel):
    afterOrder: int | None
    title: str
    deliverable: MilestoneDeliverable
    dueOffsetDays: int = Field(ge=0)
    rationale: str = ""


class RoadmapDiffRemove(StrictModel):
    order: int
    reason: str = ""


class RoadmapDiffRetitle(StrictModel):
    order: int
    newTitle: str
    newDeliverable: MilestoneDeliverable
    reason: str = ""


class RoadmapDiffReschedule(StrictModel):
    order: int
    newDueOffsetDays: int = Field(ge=0)
    reason: str = ""


class RoadmapDiff(StrictModel):
    add: list[RoadmapDiffAdd] = Field(default_factory=list)
    remove: list[RoadmapDiffRemove] = Field(default_factory=list)
    retitle: list[RoadmapDiffRetitle] = Field(default_factory=list)
    reschedule: list[RoadmapDiffReschedule] = Field(default_factory=list)


class RecalibrateResponse(StrictModel):
    summary: str
    diff: RoadmapDiff
    noOp: bool = False
    coachLine: str = ""


# -- /coach/chat -------------------------------------------------------------


class ChatTurn(StrictModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(StrictModel):
    userId: str
    userHandle: str = Field(min_length=2, max_length=32)
    message: str = Field(min_length=1, max_length=4000)
    conversationId: str | None = None
    history: list[ChatTurn] = Field(default_factory=list)
    activeGoals: list[GoalBrief] = Field(default_factory=list)
    currentMilestone: dict[str, Any] | None = None
    recentTrainingLog: list[TrainingLogEntry] = Field(default_factory=list)
    ratingSnapshot: RatingSnapshot


class ChatStreamToken(StrictModel):
    type: Literal["token"] = "token"
    delta: str


class ChatStreamDone(StrictModel):
    type: Literal["done"] = "done"
    messageId: str


class ChatStreamError(StrictModel):
    type: Literal["error"] = "error"
    message: str


ChatStreamEvent = Annotated[
    ChatStreamToken | ChatStreamDone | ChatStreamError,
    Field(discriminator="type"),
]


# -- /healthz ----------------------------------------------------------------


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    service: Literal["coach"] = "coach"
    model_versions: dict[str, str]
    prompt_versions: dict[str, int]
