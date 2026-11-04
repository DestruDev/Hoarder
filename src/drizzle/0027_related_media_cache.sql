CREATE TABLE `related_media` (
	`source_key` text PRIMARY KEY NOT NULL,
	`related` text NOT NULL,
	`fetched_at` text NOT NULL
);
