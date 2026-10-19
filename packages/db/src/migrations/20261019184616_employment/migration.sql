CREATE TABLE `employment` (
	`invitation_id` text PRIMARY KEY,
	`work_email` text NOT NULL,
	`personal_email` text NOT NULL,
	`job_title` text NOT NULL,
	`department` text NOT NULL,
	`manager` text,
	`office` text NOT NULL,
	`companies` text NOT NULL,
	`nationality` text NOT NULL,
	`sex` text NOT NULL,
	`hire_date` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_employment_invitation_id_invitation_id_fk` FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON DELETE CASCADE
);
