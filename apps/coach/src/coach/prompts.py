"""Prompt loader — Python mirror of ``packages/prompts/src/loader.ts``.

Reads files at ``<root>/<category>/<name>.v<n>.md``, parses frontmatter,
interpolates ``{{name}}`` tokens against declared inputs, and splits the body
on ``{{#cache:<name>}}`` markers so the Anthropic client can attach
``cache_control`` to the right blocks.

Why a Python re-implementation: the coach service can't depend on the TS
package at runtime. The two implementations stay in sync because the prompt
files are the source of truth and the frontmatter / marker conventions are
narrow enough to mirror cheaply.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import frontmatter

from coach.settings import get_settings

_SUPPORTED_MODELS = frozenset(
    {"claude-haiku-4-5-20251001", "claude-opus-4-7", "claude-sonnet-4-5"}
)
_CACHE_MARKER_RE = re.compile(r"^[ \t]*\{\{#cache:([a-zA-Z_][a-zA-Z0-9_-]*)\}\}[ \t]*$", re.MULTILINE)
_INPUT_TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


@dataclass(frozen=True)
class PromptInputSpec:
    """One declared input from the frontmatter ``inputs`` list."""

    name: str
    type: str  # 'string' | 'number' | 'boolean' | 'list' | 'object'
    description: str | None = None
    optional: bool = False


@dataclass(frozen=True)
class PromptFrontmatterParsed:
    """Validated, normalized frontmatter."""

    version: int
    model: str
    cache_breakpoints: list[str] = field(default_factory=list)
    inputs: list[PromptInputSpec] = field(default_factory=list)
    description: str | None = None
    output_schema: str | None = None


@dataclass(frozen=True)
class PromptBlock:
    """One content block, produced by splitting on ``{{#cache:<name>}}`` markers.

    ``cache=True`` means the Anthropic client should attach ``cache_control`` to
    this block; ``cache=False`` blocks are still emitted but uncached.
    """

    name: str
    text: str
    cache: bool


@dataclass(frozen=True)
class PromptDef:
    """Result of :func:`load_prompt`. Designed to feed straight into the SDK."""

    id: str
    category: str
    name: str
    version: int
    model: str
    system: str
    blocks: list[PromptBlock]
    cache_breakpoints: list[str]
    inputs: dict[str, Any]
    frontmatter: PromptFrontmatterParsed


# --- frontmatter validation -------------------------------------------------


def _parse_input_spec(raw: dict[str, Any], source: str) -> PromptInputSpec:
    name = raw.get("name")
    type_ = raw.get("type")
    if not isinstance(name, str) or not name:
        raise ValueError(f"{source}: input.name must be a non-empty string")
    if type_ not in {"string", "number", "boolean", "list", "object"}:
        raise ValueError(f"{source}: input.type must be one of string|number|boolean|list|object")
    return PromptInputSpec(
        name=name,
        type=type_,
        description=raw.get("description") if isinstance(raw.get("description"), str) else None,
        optional=bool(raw.get("optional", False)),
    )


def parse_frontmatter(raw: dict[str, Any], source: str) -> PromptFrontmatterParsed:
    """Validate frontmatter shape, raising :class:`ValueError` with a useful message."""
    version = raw.get("version")
    model = raw.get("model")
    if not isinstance(version, int) or version <= 0:
        raise ValueError(f"{source}: frontmatter.version must be a positive integer")
    if model not in _SUPPORTED_MODELS:
        raise ValueError(
            f"{source}: frontmatter.model must be one of {sorted(_SUPPORTED_MODELS)}"
        )

    cb_raw = raw.get("cache_breakpoints", []) or []
    if not isinstance(cb_raw, list) or not all(isinstance(x, str) and x for x in cb_raw):
        raise ValueError(f"{source}: frontmatter.cache_breakpoints must be a list of non-empty strings")

    inputs_raw = raw.get("inputs", []) or []
    if not isinstance(inputs_raw, list):
        raise ValueError(f"{source}: frontmatter.inputs must be a list")
    inputs = [_parse_input_spec(i, source) for i in inputs_raw]

    desc = raw.get("description") if isinstance(raw.get("description"), str) else None
    output_schema = raw.get("output_schema") if isinstance(raw.get("output_schema"), str) else None

    return PromptFrontmatterParsed(
        version=version,
        model=model,
        cache_breakpoints=list(cb_raw),
        inputs=inputs,
        description=desc,
        output_schema=output_schema,
    )


# --- inputs + interpolation -------------------------------------------------


def _coerce_input(value: Any, spec: PromptInputSpec, source: str) -> Any:
    """Type-check one input value against its declared spec.

    Mirrors the Zod-based TS validator: types are coarse on purpose so prompt
    authors can pass realistic JSON without first defining nested schemas.
    """
    if value is None:
        if spec.optional:
            return None
        raise ValueError(f"{source}: input '{spec.name}' is required but missing")
    match spec.type:
        case "string":
            if not isinstance(value, str):
                raise ValueError(f"{source}: input '{spec.name}' must be a string")
        case "number":
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                raise ValueError(f"{source}: input '{spec.name}' must be a number")
        case "boolean":
            if not isinstance(value, bool):
                raise ValueError(f"{source}: input '{spec.name}' must be a boolean")
        case "list":
            if not isinstance(value, list):
                raise ValueError(f"{source}: input '{spec.name}' must be a list")
        case "object":
            if not isinstance(value, dict):
                raise ValueError(f"{source}: input '{spec.name}' must be an object")
    return value


def _validate_inputs(
    inputs: dict[str, Any], specs: list[PromptInputSpec], source: str
) -> dict[str, Any]:
    declared = {s.name for s in specs}
    extra = set(inputs) - declared
    if extra:
        raise ValueError(f"{source}: unexpected inputs: {sorted(extra)}")
    out: dict[str, Any] = {}
    for spec in specs:
        out[spec.name] = _coerce_input(inputs.get(spec.name), spec, source)
    return out


def _render(value: Any) -> str:
    """Render an input value as a string suitable for interpolation."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, str):
                parts.append(f"- {item}")
            else:
                parts.append(f"- {json.dumps(item, ensure_ascii=False)}")
        return "\n".join(parts)
    # dict / fallback
    return json.dumps(value, indent=2, ensure_ascii=False)


def interpolate(
    body: str,
    inputs: dict[str, Any],
    declared: list[PromptInputSpec],
    source: str,
) -> str:
    """Replace ``{{name}}`` tokens with rendered input values."""
    declared_names = {s.name for s in declared}

    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in declared_names:
            raise ValueError(
                f"{source}: prompt references undeclared input '{{{{{name}}}}}'. "
                "Add it to the frontmatter inputs list."
            )
        return _render(inputs.get(name))

    return _INPUT_TOKEN_RE.sub(repl, body)


# --- cache-marker splitting -------------------------------------------------


def split_into_blocks(body: str, cache_breakpoints: list[str]) -> list[PromptBlock]:
    """Split body on ``{{#cache:<name>}}`` markers; mark named breakpoints cacheable."""
    cache_set = set(cache_breakpoints)
    markers = list(_CACHE_MARKER_RE.finditer(body))

    if not markers:
        for required in cache_breakpoints:
            if required != "head":
                raise ValueError(
                    f"Cache breakpoint '{required}' declared in frontmatter but no "
                    f"{{{{#cache:{required}}}}} marker found in the prompt body."
                )
        return [PromptBlock(name="head", text=body.strip(), cache="head" in cache_set)]

    blocks: list[PromptBlock] = []
    head_text = body[: markers[0].start()].strip()
    if head_text:
        blocks.append(PromptBlock(name="head", text=head_text, cache="head" in cache_set))

    for i, marker in enumerate(markers):
        next_start = markers[i + 1].start() if i + 1 < len(markers) else len(body)
        text = body[marker.end() : next_start].strip()
        if not text:
            continue
        name = marker.group(1)
        blocks.append(PromptBlock(name=name, text=text, cache=name in cache_set))

    seen = {b.name for b in blocks}
    for required in cache_breakpoints:
        if required not in seen:
            raise ValueError(
                f"Cache breakpoint '{required}' declared in frontmatter but no "
                f"{{{{#cache:{required}}}}} marker found in the prompt body."
            )
    return blocks


# --- public loader ----------------------------------------------------------


def load_prompt(
    category: str,
    name: str,
    version: int,
    inputs: dict[str, Any] | None = None,
    root_dir: Path | None = None,
) -> PromptDef:
    """Load + render a prompt by ``(category, name, version)``.

    ``root_dir`` overrides the default from settings; tests use this to point
    at fixture prompts.
    """
    inputs = inputs or {}
    root = root_dir or get_settings().coach_prompts_root
    file = Path(root) / category / f"{name}.v{version}.md"

    try:
        post = frontmatter.load(str(file))
    except FileNotFoundError as e:
        raise FileNotFoundError(f"Prompt file not found: {file}") from e

    fm = parse_frontmatter(dict(post.metadata), str(file))
    if fm.version != version:
        raise ValueError(
            f"{file} declares version {fm.version} but was loaded as v{version}"
        )

    validated = _validate_inputs(inputs, fm.inputs, str(file))
    rendered = interpolate(post.content, validated, fm.inputs, str(file))
    blocks = split_into_blocks(rendered, fm.cache_breakpoints)
    system = "\n\n".join(b.text for b in blocks)

    return PromptDef(
        id=f"{category}/{name}@{version}",
        category=category,
        name=name,
        version=version,
        model=fm.model,
        system=system,
        blocks=blocks,
        cache_breakpoints=[b.name for b in blocks if b.cache],
        inputs=validated,
        frontmatter=fm,
    )


@lru_cache(maxsize=64)
def load_prompt_cached(
    category: str,
    name: str,
    version: int,
    root_dir: str | None = None,
) -> PromptDef:
    """Cache the parsed-but-uninterpolated prompt definition.

    Inputs change per call so we cache the raw file read + frontmatter parse;
    callers re-interpolate by calling :func:`load_prompt` with their inputs.
    For inputs-free prompts (like the persona) this is a real cache hit.
    """
    return load_prompt(category, name, version, inputs={}, root_dir=Path(root_dir) if root_dir else None)
