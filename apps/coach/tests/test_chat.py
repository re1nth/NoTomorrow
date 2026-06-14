"""``POST /coach/chat`` — SSE token stream."""

from __future__ import annotations

import json


def _parse_sse(stream_text: str) -> list[dict]:
    """Parse SSE output. ``sse-starlette`` emits ``\\r\\n`` line endings, so
    normalize first and split on a blank line in either flavor."""
    normalized = stream_text.replace("\r\n", "\n")
    events: list[dict] = []
    for chunk in normalized.split("\n\n"):
        event = None
        data_parts: list[str] = []
        for line in chunk.splitlines():
            if line.startswith("event:"):
                event = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data_parts.append(line[len("data:") :].strip())
        if event and data_parts:
            try:
                payload = json.loads("\n".join(data_parts))
            except json.JSONDecodeError:
                payload = {"_raw": "\n".join(data_parts)}
            events.append({"event": event, "data": payload})
    return events


def test_chat_streams_tokens_then_done(client, stub_client, auth_headers) -> None:
    stub_client.responses["coach/chat-system@1"] = (
        "You're here. Good. Throw the next punch."
    )
    body = {
        "userId": "u", "userHandle": "ippo",
        "message": "I missed yesterday. What now?",
        "ratingSnapshot": {"stamina": 820, "expertise": 790},
    }
    with client.stream("POST", "/coach/chat", json=body, headers=auth_headers) as resp:
        assert resp.status_code == 200
        out = "".join(resp.iter_text())
    events = _parse_sse(out)
    types = [e["data"]["type"] for e in events]
    assert types.count("token") >= 2  # 16-char slices => multiple tokens
    assert types[-1] == "done"
    reconstructed = "".join(
        e["data"]["delta"] for e in events if e["data"]["type"] == "token"
    )
    assert reconstructed == "You're here. Good. Throw the next punch."


def test_chat_passes_history_as_user_messages(client, stub_client, auth_headers) -> None:
    stub_client.responses["coach/chat-system@1"] = "ok"
    body = {
        "userId": "u", "userHandle": "ippo",
        "message": "what next?",
        "history": [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "show me the work"},
        ],
        "ratingSnapshot": {"stamina": 820, "expertise": 790},
    }
    with client.stream("POST", "/coach/chat", json=body, headers=auth_headers) as resp:
        list(resp.iter_text())
    call = stub_client.calls[0]
    msgs = call["user_messages"]
    assert msgs is not None
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    assert msgs[-1]["content"] == "what next?"
