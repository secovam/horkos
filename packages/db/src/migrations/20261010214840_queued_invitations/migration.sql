ALTER TABLE `invitation` ADD `enqueued_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invitation` (
	`id` text PRIMARY KEY,
	`employee_name` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text UNIQUE,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`enqueued_at` integer,
	`sent_at` integer,
	`revoked_at` integer,
	`opened_at` integer,
	`submitted_at` integer,
	`hr_completed_at` integer,
	`contract_generated_at` integer,
	CONSTRAINT `fk_invitation_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "invitation_sent_has_link" CHECK(("token_hash" is null) = ("sent_at" is null))
);
--> statement-breakpoint
INSERT INTO `__new_invitation`(`id`, `employee_name`, `email`, `token_hash`, `created_by`, `created_at`, `sent_at`, `revoked_at`, `opened_at`, `submitted_at`, `hr_completed_at`, `contract_generated_at`) SELECT `id`, `employee_name`, `email`, `token_hash`, `created_by`, `created_at`, `sent_at`, `revoked_at`, `opened_at`, `submitted_at`, `hr_completed_at`, `contract_generated_at` FROM `invitation`;--> statement-breakpoint
DROP TABLE `invitation`;--> statement-breakpoint
ALTER TABLE `__new_invitation` RENAME TO `invitation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `invitation_created_at_idx` ON `invitation` (`created_at`);