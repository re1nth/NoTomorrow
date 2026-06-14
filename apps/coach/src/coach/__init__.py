"""NoTomorrow Coach Service.

FastAPI app that owns LLM orchestration: roadmap generation, proof grading,
daily coach messages, free-form chat. Callers are ``apps/web`` and
``infra/inngest``; never end users directly.
"""

from coach.main import create_app

__all__ = ["create_app"]
