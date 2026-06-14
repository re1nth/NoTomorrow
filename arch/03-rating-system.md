# 03 — Rating System

The soul of the app. Two numbers per domain, both starting at **1200**
(Codeforces-style baseline).

## Stamina

Measures consistency. Rewards showing up.

- **+X** when a daily TrainingLog is filed N days in a row (streak bonus)
- **-Y** per inactive day past a grace window (decay)
- Weekly cap to prevent farming
- Resets to a floor (e.g. 800) rather than zero — never humiliating

## Expertise

Measures capability. Rewards depth.

- Changes only on **verified** ProofOfWork
- Magnitude depends on:
  - Task difficulty (coach-estimated at planning time)
  - On-time vs late
  - LLM quality score of the artifact (1–5)
- Per-domain. Doing finetuning work does not bump web-frontend.

## Why two numbers

Solves the central tension in the problem statement: obsessive depth in one
dimension hollows out the rest. Stamina rewards breadth-of-showing-up across all
active goals; Expertise rewards depth in one. A healthy boxer has both.

## Onboarding rating

Computed from a blend:

1. Self-rated skill per domain (1–5)
2. 10-question diagnostic per claimed domain (LLM-generated, multi-step)
3. Optional portfolio scan — user pastes GitHub handle, coach reads top repos
   and estimates current capability

Initial Expertise = weighted blend. Initial Stamina = baseline 1200 for everyone.

## Rating math (first cut)

Standard Elo-ish update on Expertise:

```
expectedScore = 1 / (1 + 10^((difficulty - expertise) / 400))
actualScore   = qualityScore / 5  // 0.0..1.0
expertise    += K * (actualScore - expectedScore)
```

`K` decays as expertise grows (32 → 16 → 8) to dampen volatility for advanced
users. Same pattern as competitive coding.

## Rating events

Every change writes a `RatingEvent` row with `reason` and `sourceProofId` so the
fight-history view can render *why* a rating moved. No silent updates.

## Open questions

- Should domains be a fixed taxonomy or user-defined tags? See [09-risks.md](./09-risks.md).
- Should there be a combined "Overall" rank shown on the leaderboard, or only
  per-domain?
