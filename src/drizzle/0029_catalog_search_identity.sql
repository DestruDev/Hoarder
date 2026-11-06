ALTER TABLE `catalog` ADD `source` text;--> statement-breakpoint
ALTER TABLE `catalog` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `catalog` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `catalog` SET `featured` = true;--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_source_external_id_unique` ON `catalog` (`source`,`external_id`);
