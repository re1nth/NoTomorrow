CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`avatar` text,
	`timezone` text NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE TABLE `rating_profiles` (
	`user_id` text NOT NULL,
	`domain` text NOT NULL,
	`stamina` integer DEFAULT 1200 NOT NULL,
	`expertise` integer DEFAULT 1200 NOT NULL,
	`last_updated` text NOT NULL,
	PRIMARY KEY(`user_id`, `domain`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`motivation` text DEFAULT '' NOT NULL,
	`horizon` text NOT NULL,
	`target_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `goals_status_idx` ON `goals` (`status`);--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`generated_at` text NOT NULL,
	`model_version` text NOT NULL,
	`graph` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roadmaps_goal_idx` ON `roadmaps` (`goal_id`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`roadmap_id` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`deliverable` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_roadmap_idx` ON `milestones` (`roadmap_id`);--> statement-breakpoint
CREATE INDEX `milestones_roadmap_order_idx` ON `milestones` (`roadmap_id`,`order`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`milestone_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`est_minutes` integer NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_milestone_idx` ON `tasks` (`milestone_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE TABLE `proofs_of_work` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`submitted_at` text NOT NULL,
	`verified_at` text,
	`score` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proofs_task_idx` ON `proofs_of_work` (`task_id`);--> statement-breakpoint
CREATE TABLE `training_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`mood` integer NOT NULL,
	`hours_trained` real DEFAULT 0 NOT NULL,
	`blockers` text DEFAULT '' NOT NULL,
	`coach_reply` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_logs_user_date_unique` ON `training_logs` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `rating_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain` text NOT NULL,
	`stamina_delta` integer DEFAULT 0 NOT NULL,
	`expertise_delta` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`source_proof_id` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_proof_id`) REFERENCES `proofs_of_work`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rating_events_user_domain_idx` ON `rating_events` (`user_id`,`domain`);--> statement-breakpoint
CREATE INDEX `rating_events_occurred_at_idx` ON `rating_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `coach_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`tone` text NOT NULL,
	`body` text NOT NULL,
	`cta_task_id` text,
	`sent_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cta_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `coach_messages_user_idx` ON `coach_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `coach_messages_sent_at_idx` ON `coach_messages` (`sent_at`);--> statement-breakpoint
CREATE TABLE `rivals` (
	`user_id` text NOT NULL,
	`archetype` text NOT NULL,
	`domain` text NOT NULL,
	PRIMARY KEY(`user_id`, `archetype`, `domain`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
