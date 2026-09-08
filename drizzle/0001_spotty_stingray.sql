CREATE TABLE `conferenceTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(32) NOT NULL,
	`phase` varchar(120) NOT NULL,
	`workBlock` varchar(120) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`observations` text,
	`status` varchar(64) NOT NULL DEFAULT 'Pendiente',
	`committee` varchar(255),
	`responsible` varchar(255),
	`coResponsible1` varchar(255),
	`coResponsible2` varchar(255),
	`support` varchar(255),
	`priority` varchar(32) NOT NULL DEFAULT 'Media',
	`scope` varchar(255),
	`platformModule` varchar(80),
	`team` varchar(255),
	`plannedStart` varchar(64),
	`dueDate` varchar(64),
	`actualClose` varchar(64),
	`deliverable` text,
	`dependencies` text,
	`risk` text,
	`decisionRequired` text,
	`assignedAtMeeting` text,
	`costEstimate` varchar(64),
	`costActual` varchar(64),
	`progress` int NOT NULL DEFAULT 0,
	`localEligible` boolean NOT NULL DEFAULT false,
	`localWorkstream` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conferenceTasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `conferenceTasks_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(120) NOT NULL,
	`url` text,
	`owner` varchar(255),
	`visibility` varchar(32) NOT NULL DEFAULT 'Comités',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`scheduledAt` varchar(64) NOT NULL,
	`committee` varchar(255) NOT NULL,
	`agenda` text,
	`notes` text,
	`status` varchar(32) NOT NULL DEFAULT 'Planificada',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`role` enum('user','admin','direction','local_member','scientific','technical','collaborator','viewer') NOT NULL DEFAULT 'viewer',
	`committee` varchar(255),
	`position` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','direction','local_member','scientific','technical','collaborator','viewer') NOT NULL DEFAULT 'user';