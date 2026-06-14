"""Eval runner smoke test (uses mock LLM, runs the local cases dir)."""

from __future__ import annotations

import asyncio
from argparse import Namespace
from pathlib import Path

from evals.runner import _amain


def test_runner_executes_all_local_cases() -> None:
    cases_dir = Path(__file__).resolve().parents[1] / "evals" / "cases"
    args = Namespace(
        cases_dir=str(cases_dir),
        prompt=None,
        version=None,
        mock=True,
        all=True,
    )
    rc = asyncio.run(_amain(args))
    assert rc == 0
