ALTER TABLE `catalog` ADD `release_status` text;--> statement-breakpoint
ALTER TABLE `items` ADD `release_status` text;--> statement-breakpoint
UPDATE `catalog` SET `release_status` = 'released' WHERE `media_type` IN ('tv', 'anime') AND `release_status` IS NULL;--> statement-breakpoint
UPDATE `items` SET `release_status` = 'released' WHERE `media_type` IN ('tv', 'anime') AND `release_status` IS NULL;