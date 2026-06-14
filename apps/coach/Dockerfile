# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# uv binary
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /usr/local/bin/uv

# System deps: build-essential not required for our wheels; libpq optional
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first so layer caches well
COPY pyproject.toml ./
COPY uv.lock* ./
RUN uv sync --no-dev --no-install-project

# Copy source
COPY src ./src
COPY scripts ./scripts

# Install the project itself
RUN uv sync --no-dev

# The coach service expects packages/prompts mounted at this path (or override via env)
ENV COACH_PROMPTS_ROOT=/app/prompts

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "coach.main:app", "--host", "0.0.0.0", "--port", "8000"]
