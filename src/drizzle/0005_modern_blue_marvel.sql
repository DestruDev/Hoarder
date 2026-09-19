ALTER TABLE `catalog` ADD `manga_origin` text;--> statement-breakpoint
ALTER TABLE `items` ADD `manga_origin` text;--> statement-breakpoint
UPDATE `catalog` SET `media_type` = 'manga', `manga_origin` = 'south_korean' WHERE `media_type` = 'manhwa';--> statement-breakpoint
UPDATE `items` SET `media_type` = 'manga', `manga_origin` = 'south_korean' WHERE `media_type` = 'manhwa';--> statement-breakpoint
UPDATE `catalog` SET `manga_origin` = 'japanese' WHERE `media_type` = 'manga' AND `manga_origin` IS NULL;--> statement-breakpoint
UPDATE `items` SET `manga_origin` = 'japanese' WHERE `media_type` = 'manga' AND `manga_origin` IS NULL;