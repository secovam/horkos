CREATE TABLE `document` (
	`id` text PRIMARY KEY,
	`invitation_id` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_document_invitation_id_invitation_id_fk` FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `submission` (
	`invitation_id` text PRIMARY KEY,
	`full_name` text NOT NULL,
	`rfc` text NOT NULL,
	`curp` text NOT NULL,
	`nss` text NOT NULL,
	`street` text NOT NULL,
	`ext_number` text NOT NULL,
	`int_number` text,
	`suburb` text NOT NULL,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_submission_invitation_id_invitation_id_fk` FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_invitation_kind_idx` ON `document` (`invitation_id`,`kind`);