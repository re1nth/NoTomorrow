CREATE TABLE `perf_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`test_slug` text NOT NULL,
	`topic` text NOT NULL,
	`day` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`total_nodes` integer NOT NULL,
	`max_depth` integer NOT NULL,
	`max_branching` integer NOT NULL,
	`score` integer NOT NULL,
	`tree_json` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `perf_sessions_user_idx` ON `perf_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `perf_sessions_user_test_day_idx` ON `perf_sessions` (`user_id`,`test_slug`,`day`);
