CREATE TABLE `counters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`last_check_in` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `counters_user_idx` ON `counters` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `counters_user_name_unique` ON `counters` (`user_id`,`name`);