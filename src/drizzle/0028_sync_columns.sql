ALTER TABLE `items` ADD `sync_id` text;--> statement-breakpoint
ALTER TABLE `items` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `saved_filters` ADD `sync_id` text;--> statement-breakpoint
ALTER TABLE `saved_filters` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `saved_filters` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `updated_at` text;--> statement-breakpoint
UPDATE `items` SET `sync_id` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `sync_id` IS NULL;--> statement-breakpoint
UPDATE `saved_filters` SET `sync_id` = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE `sync_id` IS NULL;--> statement-breakpoint
UPDATE `items` SET `updated_at` = `date_added` WHERE `updated_at` IS NULL;--> statement-breakpoint
UPDATE `saved_filters` SET `updated_at` = `created_at`;--> statement-breakpoint
UPDATE `profile` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');--> statement-breakpoint
UPDATE `app_settings` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');--> statement-breakpoint
CREATE UNIQUE INDEX `items_sync_id_unique` ON `items` (`sync_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `saved_filters_sync_id_unique` ON `saved_filters` (`sync_id`);
