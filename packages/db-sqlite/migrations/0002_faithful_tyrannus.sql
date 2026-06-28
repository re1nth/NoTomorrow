CREATE TABLE `counter_check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`counter_id` text NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`counter_id`) REFERENCES `counters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `counter_check_ins_counter_idx` ON `counter_check_ins` (`counter_id`);--> statement-breakpoint
CREATE INDEX `counter_check_ins_user_idx` ON `counter_check_ins` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `counter_check_ins_counter_day_unique` ON `counter_check_ins` (`counter_id`,`day`);