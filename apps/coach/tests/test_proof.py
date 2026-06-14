"""``POST /proof/grade`` end-to-end with stubbed Opus."""

from __future__ import annotations


def _payload() -> dict:
    return {
        "taskId": "00000000-0000-0000-0000-000000000010",
        "taskTitle": "Deploy hello world",
        "taskType": "jab",
        "milestoneTitle": "Round 1",
        "milestoneDeliverable": {"kind": "url", "description": "Live URL"},
        "proofKind": "url",
        "proofPayload": {"kind": "url", "url": "https://example.com/hello"},
        "userRating": {"stamina": 820, "expertise": 790},
    }


def test_proof_grade_happy_path(client, stub_client, auth_headers) -> None:
    stub_client.responses["proof/grade@1"] = {
        "shipped": True,
        "quality": 4,
        "gaps": [{"severity": "minor", "description": "Add usage block", "evidence": "README terse"}],
        "verdict": "Clean. Round cleared. README needs one usage block.",
        "ratingDelta": {"stamina": 10, "expertise": 10},
    }
    resp = client.post("/proof/grade", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["shipped"] is True
    assert body["quality"] == 4
    assert body["ratingDelta"]["stamina"] == 10
    assert body["gaps"][0]["severity"] == "minor"


def test_proof_grade_forces_quality_1_when_not_shipped(client, stub_client, auth_headers) -> None:
    """Invariant: ``quality`` must be 1 when ``shipped`` is false."""
    stub_client.responses["proof/grade@1"] = {
        "shipped": False,
        "quality": 5,  # nonsense; should be coerced to 1
        "gaps": [],
        "verdict": "Nothing landed.",
        "ratingDelta": {"stamina": 0, "expertise": 0},
    }
    resp = client.post("/proof/grade", json=_payload(), headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["quality"] == 1


def test_proof_grade_uses_opus(client, stub_client, auth_headers) -> None:
    stub_client.responses["proof/grade@1"] = {
        "shipped": True, "quality": 3, "gaps": [], "verdict": "ok",
        "ratingDelta": {"stamina": 6, "expertise": 4},
    }
    client.post("/proof/grade", json=_payload(), headers=auth_headers)
    assert stub_client.calls[0]["model"] == "claude-opus-4-7"
