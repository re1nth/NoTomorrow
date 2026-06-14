"""Application settings, loaded from environment with Pydantic Settings.

The defaults are dev-friendly. Production callers must set ``ANTHROPIC_API_KEY``
and ``COACH_SERVICE_TOKEN`` explicitly — the loader will accept the placeholder
values shipped in ``.env.example`` so local tests can boot without secrets, but
the service refuses real Anthropic calls when the key is unset.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the default prompts root relative to this file so dev runs out of the
# monorepo work without any env vars set.
_DEFAULT_PROMPTS_ROOT = (
    Path(__file__).resolve().parents[4] / "packages" / "prompts" / "prompts"
)


class Settings(BaseSettings):
    """Process-wide configuration.

    Read once at startup via :func:`get_settings`. Tests can override by
    calling ``get_settings.cache_clear()`` after mutating the environment.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    anthropic_api_key: str = Field(
        default="",
        description="Anthropic API key. Empty disables live Anthropic calls.",
    )
    coach_service_token: str = Field(
        default="local-dev-token",
        description="Shared bearer token required on every non-health endpoint.",
    )
    database_url: str = Field(
        default="postgres://postgres:postgres@localhost:5432/notomorrow",
        description="Postgres connection string (asyncpg-compatible).",
    )

    # Model IDs: keep narrow on purpose. Adding a model is an intentional cost +
    # cache-compatibility decision.
    coach_model_heavy: str = Field(
        default="claude-opus-4-7",
        description="Opus tier — roadmap + proof grading + recalibration.",
    )
    coach_model_light: str = Field(
        default="claude-haiku-4-5-20251001",
        description="Haiku tier — daily check-ins + free-form chat.",
    )

    coach_prompts_root: Path = Field(
        default=_DEFAULT_PROMPTS_ROOT,
        description="Filesystem path to packages/prompts/prompts.",
    )

    log_level: str = Field(default="INFO")
    eval_mock: bool = Field(default=False, alias="EVAL_MOCK")

    @property
    def has_live_anthropic(self) -> bool:
        """True if a real Anthropic key is configured."""
        return bool(self.anthropic_api_key) and not self.anthropic_api_key.startswith(
            "sk-ant-xxx"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor. Use this everywhere; never instantiate ``Settings`` directly."""
    return Settings()
