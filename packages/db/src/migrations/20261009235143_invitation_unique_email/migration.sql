DROP INDEX IF EXISTS `invitation_active_email_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_email_idx` ON `invitation` (`email`);