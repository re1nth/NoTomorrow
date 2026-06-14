"""Eval runner CLI.

Reads JSON cases from ``packages/prompts/evals/<prompt>/`` and runs each
against its declared prompt. ``EVAL_MOCK=1`` (or ``--mock``) substitutes a
fake LLM that echoes the rendered system text — useful for CI loops where we
just need to verify that prompts compile and that inputs match the cases.

Usage::

    uv run python -m evals.runner --prompt coach/daily-checkin --version 1
    EVAL_MOCK=1 uv run python -m evals.runner --all
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from coach.llm.client import LLMClient, LLMResponse, PromptCacheUsage
from coach.prompts import PromptDef, load_prompt
from coach.settings import get_settings

log = logging.getLogger(__name__)


@dataclass
class EvalCase:
    """Mirror of the TS ``EvalCase`` shape — one JSON file per case."""

    id: str
    prompt_category: str
    prompt_name: str
    prompt_version: int
    inputs: dict[str, Any]
    expect: dict[str, Any]
    source: Path

    @classmethod
    def from_path(cls, path: Path) -> EvalCase:
        data = json.loads(path.read_text())
        prompt = data.get("prompt", {})
        return cls(
            id=str(data.get("id") or path.stem),
            prompt_category=str(prompt.get("category", "")),
            prompt_name=str(prompt.get("name", "")),
            prompt_version=int(prompt.get("version", 1)),
            inputs=data.get("inputs") or {},
            expect=data.get("expect") or {},
            source=path,
        )


@dataclass
class EvalResult:
    case: EvalCase
    passed: bool
    failures: list[str] = field(default_factory=list)
    latency_ms: int = 0
    output_text: str = ""


class _MockLLMClient(LLMClient):
    """Stub client: echoes the rendered system text + a tiny JSON envelope."""

    def __init__(self) -> None:  # noqa: D401 - skip parent init (no api key needed)
        self._api_key = ""
        self._client = None

    async def complete(
        self,
        prompt: PromptDef,
        *,
        user_messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        expect_json: bool = False,
    ) -> LLMResponse:
        text = _mock_text_for(prompt)
        parsed: dict[str, Any] | None = None
        if expect_json:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = {}
        return LLMResponse(
            text=text,
            model=model or prompt.model,
            stop_reason="end_turn",
            usage=PromptCacheUsage(),
            raw=None,
            parsed_json=parsed,
        )

    async def stream(self, prompt: PromptDef, **_: Any):  # type: ignore[override]
        text = _mock_text_for(prompt)
        for chunk in (text[i : i + 32] for i in range(0, len(text), 32)):
            yield chunk


def _mock_text_for(prompt: PromptDef) -> str:
    """Synthesize a plausible JSON response per prompt id, deterministic."""
    if prompt.category == "coach" and prompt.name == "daily-checkin":
        return json.dumps(
            {
                "primaryTask": {
                    "title": "Wire up the Next.js scaffold",
                    "type": "jab",
                    "estMinutes": 30,
                    "rationale": "First punch lands the proof-of-life shipped this week.",
                },
                "stretchTask": None,
                "coachLine": "You're here. Good. Show me the first commit by tonight.",
            }
        )
    if prompt.category == "proof" and prompt.name == "grade":
        return json.dumps(
            {
                "shipped": True,
                "quality": 3,
                "gaps": [
                    {
                        "severity": "minor",
                        "description": "Add a usage example to the README.",
                        "evidence": "README is two paragraphs; no code block.",
                    }
                ],
                "verdict": "Shipped. Round cleared. README needs one usage block before next round.",
                "ratingDelta": {"stamina": 6, "expertise": 4},
            }
        )
    if prompt.category == "roadmap" and prompt.name == "generate":
        return json.dumps(
            {
                "title": "Ship the Pomodoro web app",
                "summary": "Three rounds. Hello world, persistence, public deploy.",
                "milestones": [
                    {
                        "order": 1,
                        "title": "Deploy a hello-world page",
                        "deliverable": {"kind": "url", "description": "Live URL on Vercel."},
                        "dueOffsetDays": 3,
                        "tasks": [
                            {"title": "Init repo + Next.js", "type": "jab", "estMinutes": 30}
                        ],
                        "rationale": "Front-load proof of life.",
                    }
                ],
                "coachNote": "First round is a proof-of-life. Don't overthink it.",
            }
        )
    if prompt.category == "roadmap" and prompt.name == "recalibrate":
        return json.dumps(
            {
                "summary": "On pace. No changes.",
                "diff": {"add": [], "remove": [], "retitle": [], "reschedule": []},
                "noOp": True,
                "coachLine": "Hold the line. Next round same plan.",
            }
        )
    # Chat / unknown: return prose.
    return "I'm your coach. Show me the work."


async def _run_case(case: EvalCase, client: LLMClient) -> EvalResult:
    """Execute one case end-to-end and apply the expectation rubric."""
    started = time.perf_counter()
    try:
        prompt = load_prompt(
            category=case.prompt_category,
            name=case.prompt_name,
            version=case.prompt_version,
            inputs=case.inputs,
        )
    except Exception as e:  # noqa: BLE001
        return EvalResult(
            case=case,
            passed=False,
            failures=[f"load_prompt failed: {e}"],
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    expect_json = bool(prompt.frontmatter.output_schema)
    try:
        resp = await client.complete(prompt, expect_json=expect_json)
    except Exception as e:  # noqa: BLE001
        return EvalResult(
            case=case,
            passed=False,
            failures=[f"llm call failed: {e}"],
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    failures: list[str] = []
    text = resp.text
    expect = case.expect

    for needle in expect.get("contains", []) or []:
        if str(needle).lower() not in text.lower():
            failures.append(f"missing required substring: {needle!r}")
    for needle in expect.get("notContains", []) or []:
        if str(needle).lower() in text.lower():
            failures.append(f"forbidden substring present: {needle!r}")
    for key in expect.get("hasKeys", []) or []:
        obj = resp.parsed_json or {}
        if not isinstance(obj, dict) or key not in obj:
            failures.append(f"missing required key in JSON output: {key!r}")

    return EvalResult(
        case=case,
        passed=not failures,
        failures=failures,
        latency_ms=int((time.perf_counter() - started) * 1000),
        output_text=text,
    )


def _discover_cases(root: Path, filter_prompt: str | None) -> list[EvalCase]:
    """Walk ``packages/prompts/evals`` for *.json case files."""
    cases: list[EvalCase] = []
    for path in sorted(root.rglob("*.json")):
        try:
            case = EvalCase.from_path(path)
        except Exception as e:  # noqa: BLE001
            log.warning("eval.skip_unparseable", extra={"path": str(path), "error": str(e)})
            continue
        if filter_prompt:
            full = f"{case.prompt_category}/{case.prompt_name}"
            if full != filter_prompt:
                continue
        cases.append(case)
    return cases


async def _amain(args: argparse.Namespace) -> int:
    settings = get_settings()
    mock = args.mock or settings.eval_mock or not settings.has_live_anthropic
    if mock:
        log.info("eval.mode=mock — using stubbed LLM client")
        client: LLMClient = _MockLLMClient()
    else:
        client = LLMClient()

    cases_root = Path(args.cases_dir).resolve()
    if not cases_root.exists():
        print(f"cases dir not found: {cases_root}", file=sys.stderr)
        return 2

    prompt_filter = (
        f"{args.prompt}" if args.prompt and "/" in args.prompt else None
    )
    cases = _discover_cases(cases_root, prompt_filter)
    if not cases:
        print("no matching eval cases", file=sys.stderr)
        return 1

    results = [await _run_case(c, client) for c in cases]

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    report = {
        "total": len(results),
        "passed": passed,
        "failed": failed,
        "cases": [
            {
                "id": r.case.id,
                "prompt": f"{r.case.prompt_category}/{r.case.prompt_name}@v{r.case.prompt_version}",
                "passed": r.passed,
                "failures": r.failures,
                "latency_ms": r.latency_ms,
            }
            for r in results
        ],
    }
    print(json.dumps(report, indent=2))
    return 0 if failed == 0 else 3


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cases-dir",
        type=str,
        default=str(
            (Path(__file__).resolve().parents[3] / "packages" / "prompts" / "evals").resolve()
        ),
        help="Root directory of eval cases.",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default=None,
        help="Filter to one prompt id like 'coach/daily-checkin'.",
    )
    parser.add_argument(
        "--version",
        type=int,
        default=None,
        help="(optional) restrict to a specific version. Currently informational.",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Force the mock LLM client (otherwise honors EVAL_MOCK env).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run every discovered case (same as omitting --prompt).",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    return asyncio.run(_amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
