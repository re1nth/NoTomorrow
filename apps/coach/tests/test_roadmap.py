"""Roadmap endpoints — SSE streaming + recalibrate JSON response."""

from __future__ import annotations

import json


def _generate_payload() -> dict:
    return {
        "userId": "00000000-0000-0000-0000-000000000001",
        "goalId": "00000000-0000-0000-0000-000000000020",
        "userHandle": "ippo",
        "goalTitle": "Ship a Pomodoro web app",
        "goalMotivation": "Want to learn React end-to-end.",
        "horizon": "1m",
        "targetDate": "2026-07-14",
        "ratingSnapshot": {"stamina": 820, "expertise": 790},
    }


def _parse_sse(stream_text: str) -> list[dict]:
    """Minimal SSE parser: normalize CRLF and split on a blank line."""
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


def test_generate_streams_milestones(client, stub_client, auth_headers) -> None:
    stub_client.responses["roadmap/generate@1"] = {
        "title": "Pomodoro plan",
        "summary": "Three rounds.",
        "milestones": [
            {
                "order": 1, "title": "Hello world deploy",
                "deliverable": {"kind": "url", "description": "Live URL"},
                "dueOffsetDays": 3,
                "tasks": [{"title": "Init repo", "type": "jab", "estMinutes": 30}],
                "rationale": "Proof of life.",
            },
            {
                "order": 2, "title": "Persist timers",
                "deliverable": {"kind": "url", "description": "Stored timers"},
                "dueOffsetDays": 10,
                "tasks": [{"title": "Add localStorage", "type": "hook", "estMinutes": 120}],
                "rationale": "Foundations.",
            },
        ],
        "coachNote": "First round is a proof of life.",
    }
    with client.stream("POST", "/roadmap/generate",
                       json=_generate_payload(), headers=auth_headers) as resp:
        assert resp.status_code == 200
        body = "".join(resp.iter_text())
    events = _parse_sse(body)
    types = [e["data"]["type"] for e in events]
    assert types[0] == "goal_created"
    assert types.count("milestone") == 2
    assert types[-1] == "done"
    # The two milestones should be in order.
    milestone_titles = [
        e["data"]["milestone"]["title"] for e in events if e["data"]["type"] == "milestone"
    ]
    assert milestone_titles == ["Hello world deploy", "Persist timers"]
    done_evt = next(e for e in events if e["data"]["type"] == "done")
    assert "roadmapId" in done_evt["data"]


def test_generate_uses_opus(client, stub_client, auth_headers) -> None:
    stub_client.responses["roadmap/generate@1"] = {"milestones": [], "coachNote": ""}
    with client.stream("POST", "/roadmap/generate",
                       json=_generate_payload(), headers=auth_headers) as resp:
        list(resp.iter_text())
    assert stub_client.calls[0]["model"] == "claude-opus-4-7"
    assert stub_client.calls[0]["stream"] is True


def test_recalibrate_returns_diff(client, stub_client, auth_headers) -> None:
    stub_client.responses["roadmap/recalibrate@1"] = {
        "summary": "On pace.",
        "diff": {
            "add": [],
            "remove": [],
            "retitle": [],
            "reschedule": [{"order": 2, "newDueOffsetDays": 14, "reason": "Buffer for tests."}],
        },
        "noOp": False,
        "coachLine": "Same plan. Tighter.",
    }
    body = {
        "userId": "u", "goalId": "g", "userHandle": "ippo", "goalTitle": "x",
        "currentRoadmap": {}, "weekSummary": {},
        "ratingSnapshot": {"stamina": 1, "expertise": 1},
        "ratingHistory4w": [], "todayDate": "2026-06-14",
    }
    resp = client.post("/roadmap/recalibrate", json=body, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    out = resp.json()
    assert out["noOp"] is False
    assert out["diff"]["reschedule"][0]["order"] == 2
    assert out["diff"]["reschedule"][0]["newDueOffsetDays"] == 14
