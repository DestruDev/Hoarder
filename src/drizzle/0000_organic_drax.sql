CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`media_type` text NOT NULL,
	`status` text NOT NULL,
	`rating` integer,
	`notes` text,
	`cover_image_url` text,
	`date_added` text NOT NULL
);
