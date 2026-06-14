# NoTomorrow — Architecture

A Hajime no Ippo–themed builder's gym. Set an audacious goal, get a coach-generated
roadmap, ship proof of work, watch your Stamina/Expertise ratings climb (or get
knocked down).

This folder is the living architecture record. It is split into focused documents
so individual sections can evolve without churning the whole plan. Update
[CHANGELOG.md](./CHANGELOG.md) every iteration so we can see how thinking shifted.

## Index

1. [Product pillars](./01-product.md) — non-negotiables, problem, solution
2. [Domain model](./02-domain-model.md) — nouns, relationships
3. [Rating system](./03-rating-system.md) — Stamina + Expertise mechanics
4. [Frontend](./04-frontend.md) — stack, surfaces, theme
5. [Backend](./05-backend.md) — services, data, LLM layer
6. [Coach loop](./06-coach-loop.md) — daily/weekly AI orchestration
7. [API surface](./07-api.md) — route sketch
8. [MVP slice](./08-mvp.md) — first cut to ship
9. [Risks & open questions](./09-risks.md)
10. [Repository layout](./10-repo-layout.md) — monorepo topology, tooling, CI

## Coordination

- **[TRACKER.md](./TRACKER.md)** — live status, dependency graph, interface
  contracts. Read this before starting work in any sub-directory; update your
  row when state changes.
- Each sub-directory has its own `PLAN.md`:
  [packages/domain](../packages/domain/PLAN.md) ·
  [packages/db](../packages/db/PLAN.md) ·
  [packages/ui](../packages/ui/PLAN.md) ·
  [packages/prompts](../packages/prompts/PLAN.md) ·
  [apps/coach](../apps/coach/PLAN.md) ·
  [apps/web](../apps/web/PLAN.md) ·
  [infra/inngest](../infra/inngest/PLAN.md) ·
  [scripts](../scripts/PLAN.md)

## How to update

- Keep each document focused on its concern. Cross-link with relative paths.
- When a decision changes, edit the relevant document AND append a dated entry
  to [CHANGELOG.md](./CHANGELOG.md) explaining what shifted and why.
- Open questions live in [09-risks.md](./09-risks.md) until resolved; resolved
  ones move into the appropriate doc and get noted in the changelog.
