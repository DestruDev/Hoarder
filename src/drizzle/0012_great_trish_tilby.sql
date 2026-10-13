PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`media_type` text NOT NULL,
	`status` text NOT NULL,
	`rating` real,
	`notes` text,
	`cover_image_url` text,
	`release_status` text,
	`manga_origin` text,
	`total_episodes` integer,
	`total_pages` integer,
	`total_chapters` integer,
	`current_episodes` integer,
	`current_pages` integer,
	`current_chapters` integer,
	`date_added` text NOT NULL,
	`finish_date` text
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "title", "media_type", "status", "rating", "notes", "cover_image_url", "release_status", "manga_origin", "total_episodes", "total_pages", "total_chapters", "current_episodes", "current_pages", "current_chapters", "date_added", "finish_date") SELECT "id", "title", "media_type", "status", "rating", "notes", "cover_image_url", "release_status", "manga_origin", "total_episodes", "total_pages", "total_chapters", "current_episodes", "current_pages", "current_chapters", "date_added", "finish_date" FROM `items`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;