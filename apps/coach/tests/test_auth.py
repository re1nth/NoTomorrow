"""Bearer-token rejection across every non-health endpoint."""

from __future__ import annotations

import pytest

NON_HEALTH_ENDPOINTS = [
    ("/coach/daily", {"userId": "u", "userHandle": "x", "localDate": "2026-01-01",
                      "ratingSnapshot": {"stamina": 1, "expertise": 1}}),
    ("/proof/grade", {"taskId": "t", "taskTitle": "x", "taskType": "jab",
                       "milestoneTitle": "m",
                       "milestoneDeliverable": {"kind": "url", "description": "x"},
                       "proofKind": "url", "proofPayload": {"kind": "url", "url": "https://x"},
                       "userRating": {"stamina": 1, "expertise": 1}}),
    ("/roadmap/recalibrate", {"userId": "u", "goalId": "g", "userHandle": "x",
                              "goalTitle": "x", "currentRoadmap": {}, "weekSummary": {},
                              "ratingSnapshot": {"stamina": 1, "expertise": 1},
                              "ratingHistory4w": [], "todayDate": "2026-01-01"}),
    ("/roadmap/generate", {"userId": "u", "goalId": "g", "userHandle": "x",
                            "goalTitle": "x", "goalMotivation": "x", "horizon": "1m",
                            "targetDate": "2026-07-14",
                            "ratingSnapshot": {"stamina": 1, "expertise": 1}}),
    ("/coach/chat", {"userId": "u", "userHandle": "x", "message": "hi",
                      "ratingSnapshot": {"stamina": 1, "expertise": 1}}),
]


@pytest.mark.parametrize("path,payload", NON_HEALTH_ENDPOINTS)
def test_missing_token_returns_401(client, path: str, payload: dict) -> None:
    resp = client.post(path, json=payload)
    assert resp.status_code == 401
    assert "Bearer" in resp.headers.get("www-authenticate", "")


@pytest.mark.parametrize("path,payload", NON_HEALTH_ENDPOINTS)
def test_wrong_token_returns_401(client, path: str, payload: dict) -> None:
    resp = client.post(path, json=payload, headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401
