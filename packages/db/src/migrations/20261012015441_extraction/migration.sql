CREATE TABLE `extraction` (
	`invitation_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`fields` text NOT NULL,
	`warnings` text NOT NULL,
	`extracted_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `extraction_pk` PRIMARY KEY(`invitation_id`, `kind`),
	CONSTRAINT `fk_extraction_invitation_id_invitation_id_fk` FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON DELETE CASCADE
);
