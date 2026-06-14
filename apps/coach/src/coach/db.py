"""asyncpg connection pool wrapper.

Write surface intentionally narrow: only ``rating_events``, ``coach_messages``,
and new ``roadmaps`` rows. Reads are unrestricted but should go through helpers
in this module so callers don't sprinkle raw SQL across routers.

The pool is lazily created on first use to keep tests cheap.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

try:
    import asyncpg  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - asyncpg is required at runtime
    asyncpg = None  # type: ignore[assignment]

from coach.settings import get_settings

log = logging.getLogger(__name__)


class _PoolHolder:
    """Module-level holder so :func:`get_pool` is a cheap accessor.

    We don't use a global because tests need to reset it; one shared mutable
    object is easier to monkey-patch than a re-bound module global.
    """

    pool: Any | None = None


_holder = _PoolHolder()


async def get_pool() -> Any:
    """Return the process-wide asyncpg pool, creating it on first call.

    Raises ``RuntimeError`` if asyncpg isn't installed (shouldn't happen in
    production but tests stub the pool entirely and never hit this path).
    """
    if _holder.pool is not None:
        return _holder.pool
    if asyncpg is None:
        raise RuntimeError("asyncpg is not installed; cannot create connection pool")
    settings = get_settings()
    log.info("Creating asyncpg pool", extra={"db_url_host": _hide_url(settings.database_url)})
    _holder.pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=1,
        max_size=10,
        command_timeout=15,
    )
    return _holder.pool


async def close_pool() -> None:
    """Tear down the pool. Called on FastAPI shutdown."""
    if _holder.pool is not None:
        await _holder.pool.close()
        _holder.pool = None


@asynccontextmanager
async def acquire() -> AsyncIterator[Any]:
    """Convenience context manager for one connection.

    Usage::

        async with acquire() as conn:
            row = await conn.fetchrow("select 1")
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


def set_pool_for_tests(pool: Any | None) -> None:
    """Test hook: substitute an arbitrary pool object (or None to reset)."""
    _holder.pool = pool


def _hide_url(url: str) -> str:
    """Best-effort scrub of password in the connection URL for logs."""
    if "@" not in url:
        return url
    head, tail = url.rsplit("@", 1)
    if "://" in head and ":" in head.split("://", 1)[1]:
        scheme, rest = head.split("://", 1)
        user = rest.split(":", 1)[0]
        return f"{scheme}://{user}:***@{tail}"
    return url
