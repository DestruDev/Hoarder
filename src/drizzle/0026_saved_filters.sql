CREATE TABLE `saved_filters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`tab` text NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_filters_user_tab_idx` ON `saved_filters` (`user_id`,`tab`);
