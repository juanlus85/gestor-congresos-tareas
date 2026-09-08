CREATE TABLE `configurationItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configurationItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `members` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `members` ADD `organization` varchar(255);--> statement-breakpoint
ALTER TABLE `members` ADD `phone` varchar(64);--> statement-breakpoint
ALTER TABLE `members` ADD `notes` text;