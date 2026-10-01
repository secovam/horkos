CREATE TABLE `invitation` (
	`id` text PRIMARY KEY,
	`employee_name` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`sent_at` integer NOT NULL,
	`revoked_at` integer,
	`submitted_at` integer,
	CONSTRAINT `fk_invitation_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_active_email_idx` ON `invitation` (`email`) WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX `invitation_created_at_idx` ON `invitation` (`created_at`);