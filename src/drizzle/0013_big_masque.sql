CREATE TABLE `feed_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`media_title` text NOT NULL,
	`media_type` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	`catalog_id` integer NOT NULL
);
