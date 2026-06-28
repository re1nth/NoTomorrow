-- counter_check_ins — append-only log of every day a counter was bumped,
-- so the UI can render a GitHub-style contribution heatmap. The unique
-- (counter_id, day) index doubles as the storage-level "once per day" guard.

CREATE TABLE IF NOT EXISTS "counter_check_ins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "counter_id" uuid NOT NULL REFERENCES "counters"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "day" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "counter_check_ins_counter_idx"
  ON "counter_check_ins" ("counter_id");

CREATE INDEX IF NOT EXISTS "counter_check_ins_user_idx"
  ON "counter_check_ins" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "counter_check_ins_counter_day_unique"
  ON "counter_check_ins" ("counter_id", "day");
