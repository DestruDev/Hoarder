ALTER TABLE `items` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `items_user_id_idx` ON `items` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_user_id_unique` ON `app_settings` (`user_id`);
