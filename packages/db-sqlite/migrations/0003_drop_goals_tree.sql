-- Drop every table that hung off the goals/coach/rating feature tree.
-- Order matters cosmetically (children first); DROP TABLE in SQLite
-- bypasses FK checks regardless.

DROP TABLE IF EXISTS `rating_events`;--> statement-breakpoint
DROP TABLE IF EXISTS `coach_messages`;--> statement-breakpoint
DROP TABLE IF EXISTS `proofs_of_work`;--> statement-breakpoint
DROP TABLE IF EXISTS `tasks`;--> statement-breakpoint
DROP TABLE IF EXISTS `milestones`;--> statement-breakpoint
DROP TABLE IF EXISTS `roadmaps`;--> statement-breakpoint
DROP TABLE IF EXISTS `goals`;--> statement-breakpoint
DROP TABLE IF EXISTS `training_logs`;--> statement-breakpoint
DROP TABLE IF EXISTS `rating_profiles`;--> statement-breakpoint
DROP TABLE IF EXISTS `rivals`;
