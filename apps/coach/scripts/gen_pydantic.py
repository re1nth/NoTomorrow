"""Regenerate ``coach/schemas/codegen_full.py`` from the domain JSON Schema.

Usage::

    uv run python scripts/gen_pydantic.py \
        --input ../../packages/domain/dist/json-schema.json \
        --output src/coach/schemas/codegen_full.py

We currently ship a hand-rolled subset (``coach/schemas/generated.py``) — see
the module docstring there for why. This script exists so swapping to full
codegen later is a one-command operation.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).resolve().parents[3]
        / "packages"
        / "domain"
        / "dist"
        / "json-schema.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent
        / "src"
        / "coach"
        / "schemas"
        / "codegen_full.py",
    )
    parser.add_argument(
        "--group",
        choices=("api", "entities", "enums", "all"),
        default="all",
        help="Which group of definitions to emit. Default: all.",
    )
    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"input not found: {args.input}", file=sys.stderr)
        return 1

    try:
        from datamodel_code_generator import DataModelType, InputFileType, generate
    except ImportError:
        print(
            "datamodel-code-generator is required. Install dev deps:\n"
            "  uv sync --extra dev",
            file=sys.stderr,
        )
        return 2

    raw = json.loads(args.input.read_text())
    groups = raw.get("groups", {})

    # ``raw`` is a bundle of multiple sub-schemas under ``groups.<g>.<name>``.
    # datamodel-code-generator expects a single root schema, so we either pick
    # one group or merge all definitions into a flat allOf.
    merged_defs: dict[str, dict] = {}
    selected = ("api", "entities", "enums") if args.group == "all" else (args.group,)
    for g in selected:
        for name, sub in (groups.get(g) or {}).items():
            for def_name, def_body in (sub.get("definitions") or {}).items():
                # Prefer the most-recent definition if duplicates appear.
                merged_defs[def_name] = def_body

    root_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "NoTomorrowDomain",
        "type": "object",
        "additionalProperties": False,
        "properties": {},
        "definitions": merged_defs,
    }

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(root_schema, tmp)
        tmp_path = Path(tmp.name)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    generate(
        input_=tmp_path,
        input_file_type=InputFileType.JsonSchema,
        output=args.output,
        output_model_type=DataModelType.PydanticV2BaseModel,
        target_python_version="3.12",
        use_standard_collections=True,
        use_union_operator=True,
        field_constraints=True,
        snake_case_field=False,
        use_schema_description=True,
        disable_timestamp=True,
    )
    tmp_path.unlink(missing_ok=True)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
