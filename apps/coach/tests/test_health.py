"""``GET /healthz`` smoke + introspection assertions."""

from __future__ import annotations


def test_healthz_returns_ok(client) -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "coach"
    assert "heavy" in body["model_versions"]
    assert "light" in body["model_versions"]
    assert body["model_versions"]["heavy"] == "claude-opus-4-7"
    assert body["model_versions"]["light"] == "claude-haiku-4-5-20251001"
    # Every prompt the service uses should be advertised.
    for k in ("coach/persona", "coach/daily-checkin", "proof/grade", "roadmap/generate"):
        assert k in body["prompt_versions"]


def test_healthz_does_not_require_auth(client) -> None:
    # No Authorization header — should still return 200.
    resp = client.get("/healthz")
    assert resp.status_code == 200
