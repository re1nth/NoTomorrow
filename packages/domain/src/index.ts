/**
 * @notomorrow/domain — single source of truth for cross-runtime data contracts.
 *
 * Zod schemas + inferred TS types for every entity in
 * arch/02-domain-model.md, plus request/response shapes for the endpoints in
 * arch/07-api.md.
 *
 * The same schemas are exported to JSON Schema (see scripts/build-json-schema.ts)
 * for Pydantic codegen in apps/coach.
 */

export * from './enums.js';
export * from './entities/index.js';
export * as Api from './api/index.js';
