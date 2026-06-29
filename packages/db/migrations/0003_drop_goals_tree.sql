-- Drop every table that hung off the goals/coach/rating feature tree.
-- Order matters: children first, then parents. CASCADE catches any
-- lingering FK we forgot.

DROP TABLE IF EXISTS "rating_events" CASCADE;
DROP TABLE IF EXISTS "coach_messages" CASCADE;
DROP TABLE IF EXISTS "proofs_of_work" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "milestones" CASCADE;
DROP TABLE IF EXISTS "roadmaps" CASCADE;
DROP TABLE IF EXISTS "goals" CASCADE;
DROP TABLE IF EXISTS "training_logs" CASCADE;
DROP TABLE IF EXISTS "rating_profiles" CASCADE;
DROP TABLE IF EXISTS "rivals" CASCADE;
DROP TABLE IF EXISTS "bundles" CASCADE;

-- Postgres enums attached to the dropped tables.
DROP TYPE IF EXISTS "proof_kind" CASCADE;
DROP TYPE IF EXISTS "rival_archetype" CASCADE;
DROP TYPE IF EXISTS "goal_status" CASCADE;
DROP TYPE IF EXISTS "task_status" CASCADE;
DROP TYPE IF EXISTS "milestone_status" CASCADE;
DROP TYPE IF EXISTS "coach_message_kind" CASCADE;
