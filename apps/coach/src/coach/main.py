"""FastAPI app factory.

Keeping the factory pure makes it trivial to test (no module-level side
effects) and lets the eval runner reuse the same loader pipeline without
booting Uvicorn.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from coach.db import close_pool
from coach.routers import chat, daily, health, proof, roadmap
from coach.settings import get_settings


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: nothing to spin up eagerly; tear down the DB pool on exit."""
    try:
        yield
    finally:  # pragma: no cover - lifecycle hook
        await close_pool()


def create_app() -> FastAPI:
    """Build the FastAPI app and register all routers."""
    settings = get_settings()
    _configure_logging(settings.log_level)

    app = FastAPI(
        title="NoTomorrow Coach Service",
        version="0.1.0",
        description=(
            "LLM orchestration service. All endpoints except /healthz require "
            "an Authorization: Bearer <COACH_SERVICE_TOKEN> header."
        ),
        lifespan=_lifespan,
    )

    app.include_router(health.router)
    app.include_router(daily.router)
    app.include_router(proof.router)
    app.include_router(roadmap.router)
    app.include_router(chat.router)

    return app


def _configure_logging(level: str) -> None:
    """Minimal logging config; production deploys layer in JSON formatting."""
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


# ASGI entrypoint: ``uv run uvicorn coach.main:app --reload``
app = create_app()
