CREATE TABLE `documentAccess` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`memberId` int,
	`groupId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentAccess_id` PRIMARY KEY(`id`)
);
