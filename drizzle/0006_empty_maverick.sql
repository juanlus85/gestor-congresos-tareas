ALTER TABLE `documents` ADD `eventId` int;--> statement-breakpoint
ALTER TABLE `documents` ADD `storageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `documents` ADD `fileName` varchar(500);--> statement-breakpoint
ALTER TABLE `documents` ADD `mimeType` varchar(255);--> statement-breakpoint
ALTER TABLE `documents` ADD `sizeBytes` int;