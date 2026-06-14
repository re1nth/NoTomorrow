# packages/domain — Build Plan

> Owner: unassigned  |  Status: not started  |  Updated: 2026-06-14

Foundational track. **Wave 0.** Everything else depends on shapes published here.

## Mission

Single source of truth for cross-runtime data contracts. Zod schemas → TS
types, mirrored to Pydantic for the Python Coach Service via JSON Schema
codegen.

## Scope

**In:**
- Zod schemas for every entity in [arch/02-domain-model.md](../../arch/02-domain-model.md)
- TS types inferred from Zod
- Enums (Punch type, Goal status, Milestone status, Task status, Proof kind, Channel)
- API request/response shapes used across `apps/web` ↔ `apps/coach`
- JSON Schema export script for Pydantic codegen

**Out:**
- Persistence concerns (handled in `packages/db`)
- HTTP transport (handled in `apps/web`)
- Validation logic beyond field-shape constraints

## Dependencies (consumes)

None. This package is foundational.

## Exposes

- `import { Goal, Task, ... } from '@notomorrow/domain'` — Zod schemas + types
- `import { GoalStatus, PunchType, ... } from '@notomorrow/domain/enums'`
- `packages/domain/dist/json-schema.json` — generated, consumed by `apps/coach`

See [arch/TRACKER.md](../../arch/TRACKER.md) Interface contracts.

## Build steps (ordered)

1. `package.json` with deps: `zod`, `zod-to-json-schema`
2. `tsconfig.json` extending `tsconfig.base.json`
3. `src/enums.ts` — all enum types
4. `src/entities/` — one file per entity (user, rating-profile, goal, roadmap,
   milestone, task, proof, training-log, rating-event, bundle, coach-message,
   rival)
5. `src/api/` — request/response shapes for endpoints in [arch/07-api.md](../../arch/07-api.md)
6. `src/index.ts` — barrel exports
7. `scripts/build-json-schema.ts` — emits `dist/json-schema.json`
8. Wire `pnpm build` to run typecheck + json-schema export

## Acceptance criteria

- [ ] All entities from `02-domain-model.md` have a Zod schema
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` produces `dist/json-schema.json` and the schema is
      deterministic across runs
- [ ] No circular imports between entity files
- [ ] Unit tests for at least three representative schemas with valid + invalid
      fixtures

## Verification

```
pnpm --filter @notomorrow/domain build
pnpm --filter @notomorrow/domain test
```

Inspect `dist/json-schema.json` for completeness.

## Deferred / out of scope

- Versioning of schemas across releases (revisit when there are real consumers)
- Schema migration tooling

## Open questions

- Should `RatingProfile.domain` be a strict enum or a free string for now?
  See [arch/09-risks.md](../../arch/09-risks.md) domain taxonomy.
- Naming: `Round`/`Punch` (boxing metaphor) vs `Milestone`/`Task` (literal) at
  the schema level — recommendation: literal in schema, metaphorical in UI copy.

## Coordination

- Publish stub exports as early as possible — `packages/db` and `apps/coach` are
  blocked on these.
- Any schema field rename is a breaking interface change: follow protocol in
  [arch/TRACKER.md](../../arch/TRACKER.md).
