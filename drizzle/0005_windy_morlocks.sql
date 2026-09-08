CREATE TABLE `emailMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`recipients` text NOT NULL,
	`recipientCount` int NOT NULL,
	`createdBy` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'Enviado',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smtpSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 587,
	`username` varchar(320),
	`passwordEncrypted` text,
	`fromName` varchar(255) NOT NULL,
	`fromEmail` varchar(320) NOT NULL,
	`secure` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smtpSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskVerifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`submittedByMemberId` int,
	`submittedByName` varchar(255) NOT NULL,
	`note` text,
	`status` varchar(32) NOT NULL DEFAULT 'Pendiente',
	`reviewedByName` varchar(255),
	`reviewerNote` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `taskVerifications_id` PRIMARY KEY(`id`)
);
