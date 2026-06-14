# 05 — Backend

## Service split

Two services, deployed independently. The split keeps LLM dependencies (cost,
latency, retries) off the hot path of normal app reads.

### A. App API
- **Next.js Route Handlers** (or standalone Hono server if we outgrow Next)
- CRUD for users, goals, roadmaps, milestones, proofs
- Auth, rate limiting, webhook ingestion (GitHub for proof verification)
- Enqueues jobs to the Coach Service

### B. Coach Service
- **Python FastAPI**
- LLM orchestration: roadmap generation, proof scoring, daily coach messages
- Vector search over Bundle library (pgvector)
- Diagnostic scoring
- Owns prompt versions and the eval suite

## Data layer

- **Postgres** (Neon or Supabase) — primary store, with **pgvector** for bundle
  and embedding search
- **Redis** (Upstash) — sessions, rate limits, daily streak counters
- **S3 / R2** — proof artifacts (screenshots, video demos)
- **Inngest** (or BullMQ self-hosted) — scheduled jobs: daily coach check-ins,
  weekly rating recalibration, streak decay

## LLM layer

- **Claude Opus 4.7** for roadmap generation and proof scoring (complex reasoning,
  lower frequency)
- **Claude Haiku 4.5** for daily coach nudges and free-form chat (cheap, high
  frequency)
- **Prompt caching** on the system prompt + coach persona — persona is ~5k
  tokens and reused per user, so caching is a major cost lever
- **Embeddings**: Voyage `voyage-3` for bundle similarity

See [06-coach-loop.md](./06-coach-loop.md) for how these are wired together.

## Proof verification pipeline

On proof submission:

1. Fetch the artifact:
   - `repo` → GitHub API: readme, recent commits, languages
   - `url` → headless fetch, screenshot, response size sanity check
   - `video` → transcript via Whisper if available
   - `writeup` → already text
2. Coach service runs structured-output LLM grading:
   ```json
   { "shipped": true, "quality": 1-5, "gaps": ["..."] }
   ```
3. If `shipped && quality >= 3` → emit `RatingEvent`, unlock next milestone if
   applicable
4. Else → return coach feedback as a `CoachMessage` with concrete revision
   requirements. No rating change.

## Anti-cheat guards

- Proof grading grounded in fetched artifact, not user-supplied claims
- Per-user LLM rate limits (verification + chat separately)
- Bundle stars weighted by fork-completion, not click count
- Stamina caps prevent farming streaks via rapid no-content check-ins
- Manual report flow for misleading bundles

## Deployment shape (current best guess)

- App API → Vercel (Next.js)
- Coach Service → Fly.io or Railway (Python, needs persistent connections)
- Postgres → Neon
- Redis → Upstash
- Object storage → Cloudflare R2

This may consolidate once we know real traffic patterns.
