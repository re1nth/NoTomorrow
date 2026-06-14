"""Shared bearer-token auth dependency.

Callers (``apps/web``, ``infra/inngest``) send ``Authorization: Bearer <token>``.
The token is symmetric and rotated out-of-band — this is service-to-service
auth, not end-user auth.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from coach.settings import get_settings


async def require_service_token(
    authorization: str | None = Header(default=None),
) -> None:
    """FastAPI dependency that 401s on a missing or mismatched bearer token.

    Uses :func:`hmac.compare_digest` to avoid timing-based token discovery.
    """
    settings = get_settings()
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    provided = authorization.split(" ", 1)[1].strip()
    expected = settings.coach_service_token
    if not expected or not hmac.compare_digest(provided.encode(), expected.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
