CREATE TYPE "public"."coach_channel" AS ENUM('inbox', 'push');--> statement-breakpoint
CREATE TYPE "public"."coach_tone" AS ENUM('hype', 'stern', 'analytical', 'warm');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('draft', 'active', 'paused', 'won', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."goal_horizon" AS ENUM('1w', '1m', '3m', '1y');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('locked', 'current', 'cleared', 'failed');--> statement-breakpoint
CREATE TYPE "public"."proof_kind" AS ENUM('repo', 'url', 'video', 'writeup');--> statement-breakpoint
CREATE TYPE "public"."punch_type" AS ENUM('jab', 'hook', 'uppercut', 'dempsey_roll');--> statement-breakpoint
CREATE TYPE "public"."rival_archetype" AS ENUM('mirror', 'nemesis', 'mentor', 'rookie');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'submitted', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"avatar" text,
	"timezone" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rating_profiles" (
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"stamina" integer DEFAULT 1200 NOT NULL,
	"expertise" integer DEFAULT 1200 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_profiles_user_id_domain_pk" PRIMARY KEY("user_id","domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"motivation" text DEFAULT '' NOT NULL,
	"horizon" "goal_horizon" NOT NULL,
	"target_date" date NOT NULL,
	"status" "goal_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_version" text NOT NULL,
	"graph" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"deliverable" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "milestone_status" DEFAULT 'locked' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "punch_type" NOT NULL,
	"est_minutes" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proofs_of_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"kind" "proof_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"score" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mood" integer NOT NULL,
	"hours_trained" double precision DEFAULT 0 NOT NULL,
	"blockers" text DEFAULT '' NOT NULL,
	"coach_reply" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rating_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"stamina_delta" integer DEFAULT 0 NOT NULL,
	"expertise_delta" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"source_proof_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"source_goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"embedding" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "coach_channel" NOT NULL,
	"tone" "coach_tone" NOT NULL,
	"body" text NOT NULL,
	"cta_task_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivals" (
	"user_id" uuid NOT NULL,
	"archetype" "rival_archetype" NOT NULL,
	"domain" text NOT NULL,
	CONSTRAINT "rivals_user_id_archetype_domain_pk" PRIMARY KEY("user_id","archetype","domain")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_profiles" ADD CONSTRAINT "rating_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proofs_of_work" ADD CONSTRAINT "proofs_of_work_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_source_proof_id_proofs_of_work_id_fk" FOREIGN KEY ("source_proof_id") REFERENCES "public"."proofs_of_work"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundles" ADD CONSTRAINT "bundles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundles" ADD CONSTRAINT "bundles_source_goal_id_goals_id_fk" FOREIGN KEY ("source_goal_id") REFERENCES "public"."goals"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_cta_task_id_tasks_id_fk" FOREIGN KEY ("cta_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivals" ADD CONSTRAINT "rivals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_handle_unique" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goals_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goals_status_idx" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmaps_goal_idx" ON "roadmaps" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_roadmap_idx" ON "milestones" USING btree ("roadmap_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_roadmap_order_idx" ON "milestones" USING btree ("roadmap_id","order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_milestone_idx" ON "tasks" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proofs_task_idx" ON "proofs_of_work" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_logs_user_date_unique" ON "training_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rating_events_user_domain_idx" ON "rating_events" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rating_events_occurred_at_idx" ON "rating_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_author_idx" ON "bundles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_messages_user_idx" ON "coach_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_messages_sent_at_idx" ON "coach_messages" USING btree ("sent_at");