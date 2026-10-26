CREATE TABLE `registration` (
	`id` text PRIMARY KEY,
	`employee_name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_email_idx` ON `registration` (`email`);--> statement-breakpoint
CREATE INDEX `registration_created_at_idx` ON `registration` (`created_at`);