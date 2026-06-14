"""``POST /coach/daily`` end-to-end with stubbed LLM."""

from __future__ import annotations

import json


def _payload() -> dict:
    return {
        "userId": "00000000-0000-0000-0000-000000000001",
        "userHandle": "ippo",
        "localDate": "2026-06-14",
        "activeGoals": [
            {"title": "Ship a Pomodoro web app", "horizon": "1m",
             "currentMilestoneTitle": "Hello world deploy"}
        ],
        "ratingSnapshot": {"stamina": 820, "expertise": 790,
                            "delta7d": {"stamina": 0, "expertise": 0}},
        "recentTrainingLog": [],
        "openTasks": [{"title": "Wire scaffold", "type": "jab", "estMinutes": 30}],
    }


def test_daily_happy_path(client, stub_client, auth_headers) -> None:
    stub_client.responses["coach/daily-checkin@1"] = {
        "primaryTask": {
            "title": "Wire up Next.js scaffold",
            "type": "jab",
            "estMinutes": 30,
            "rationale": "First punch lands the proof of life.",
        },
        "stretchTask": None,
        "coachLine": "You're here. Good. Show me the first commit by tonight.",
    }
    resp = client.post("/coach/daily", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["primaryTask"]["title"] == "Wire up Next.js scaffold"
    assert body["primaryTask"]["type"] == "jab"
    assert body["stretchTask"] is None
    assert "first commit" in body["coachLine"]["body"]


def test_daily_handles_dempseyroll_camelcase(client, stub_client, auth_headers) -> None:
    stub_client.responses["coach/daily-checkin@1"] = {
        "primaryTask": {
            "title": "Ship capstone",
            "type": "dempseyRoll",
            "estMinutes": 480,
            "rationale": "Big punch.",
        },
        "stretchTask": None,
        "coachLine": "Big one today.",
    }
    resp = client.post("/coach/daily", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["primaryTask"]["type"] == "dempsey_roll"


def test_daily_uses_haiku_and_stitches_persona(client, stub_client, auth_headers) -> None:
    stub_client.responses["coach/daily-checkin@1"] = json.dumps({
        "primaryTask": {"title": "x", "type": "jab", "estMinutes": 30, "rationale": "x"},
        "stretchTask": None,
        "coachLine": "x",
    })
    client.post("/coach/daily", json=_payload(), headers=auth_headers)
    assert len(stub_client.calls) == 1
    call = stub_client.calls[0]
    assert call["model"] == "claude-haiku-4-5-20251001"
    # persona has 3 cache breakpoints; daily-checkin has 2 — totals must include all.
    assert call["block_count"] >= 4
    assert call["cache_breakpoint_count"] >= 4


def test_daily_validates_request(client, auth_headers) -> None:
    resp = client.post("/coach/daily", json={"userId": "u"}, headers=auth_headers)
    assert resp.status_code == 422
