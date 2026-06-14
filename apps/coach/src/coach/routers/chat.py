"""``POST /coach/chat`` — SSE token stream.

The user opens the Coach panel and talks; we stream Haiku tokens back via
SSE. Conversation history is passed in by the caller (App API persists it in
``coach_messages`` as ``kind=chat`` rows; this service is stateless w.r.t.
chat).
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from coach.auth import require_service_token
from coach.llm import LLMClient, get_client
from coach.prompts import load_prompt
from coach.routers.daily import _stitch_with_persona
from coach.schemas.generated import ChatRequest
from coach.settings import get_settings

router = APIRouter(prefix="/coach", tags=["coach"])
log = logging.getLogger(__name__)


def _sse(event_type: str, data: dict) -> dict:
    return {"event": event_type, "data": json.dumps(data, ensure_ascii=False)}


async def _chat_event_stream(
    body: ChatRequest,
    client: LLMClient,
    request: Request,
) -> AsyncIterator[dict]:
    per_call = load_prompt(
        category="coach",
        name="chat-system",
        version=1,
        inputs={
            "user_handle": body.userHandle,
            "active_goals": [g.model_dump() for g in body.activeGoals],
            "current_milestone": body.currentMilestone or {},
            "recent_training_log": [t.model_dump() for t in body.recentTrainingLog],
            "rating_snapshot": body.ratingSnapshot.model_dump(),
        },
    )
    stitched = _stitch_with_persona(per_call)
    settings = get_settings()

    # Caller passes prior turns in ``history``; we append the current user
    # message on top. SDK message shape is `{role, content}` with content as a
    # plain string per Anthropic's docs.
    messages: list[dict] = []
    for turn in body.history:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": body.message})

    message_id = str(uuid.uuid4())
    try:
        async for delta in client.stream(
            stitched,
            user_messages=messages,
            model=settings.coach_model_light,
            max_tokens=1200,
        ):
            if await request.is_disconnected():
                log.info("chat.client_disconnected")
                return
            yield _sse("token", {"type": "token", "delta": delta})
    except Exception as e:
        log.exception("chat.llm_failure")
        yield _sse("error", {"type": "error", "message": f"LLM stream failed: {e}"})
        return

    yield _sse("done", {"type": "done", "messageId": message_id})


@router.post("/chat", dependencies=[Depends(require_service_token)])
async def coach_chat(
    body: ChatRequest,
    request: Request,
    client: LLMClient = Depends(get_client),
) -> EventSourceResponse:
    """SSE token stream: ``token``* -> ``done`` / ``error``."""
    return EventSourceResponse(_chat_event_stream(body, client, request))
