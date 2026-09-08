CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#173c59',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`shortName` varchar(80) NOT NULL,
	`location` varchar(255),
	`startDate` varchar(32),
	`endDate` varchar(32),
	`status` varchar(32) NOT NULL DEFAULT 'Planificación',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_shortName_unique` UNIQUE(`shortName`)
);
--> statement-breakpoint
CREATE TABLE `groupMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`memberId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `groupMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`memberId` int,
	`groupId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `members` MODIFY COLUMN `role` enum('user','admin','direction','local_member','scientific','technical','collaborator','viewer') NOT NULL DEFAULT 'collaborator';--> statement-breakpoint
ALTER TABLE `conferenceTasks` ADD `eventId` int;--> statement-breakpoint
ALTER TABLE `conferenceTasks` ADD `categoryId` int;