-- Sync bookkeeping (see docs/sync.md).
--
-- sync_seq: every app write to a synced table stamps the row with the next
-- value of a device-wide counter. Sync uploads rows whose sync_seq is above the
-- last one it sent, so what gets uploaded doesn't depend on the device clock.
-- Rows written by sync itself set sync_seq to 0 or -1, which the triggers leave
-- alone and which never get uploaded.
--
-- updated_at: an app edit always gets a later updated_at than the version it
-- replaces, even if the device clock is behind the device that wrote that
-- version. Otherwise the server would reject the edit as older, and this device,
-- having already downloaded past the winning version, would never reconcile.
ALTER TABLE `items` ADD `sync_seq` integer;
--> statement-breakpoint
ALTER TABLE `saved_filters` ADD `sync_seq` integer;
--> statement-breakpoint
ALTER TABLE `profile` ADD `sync_seq` integer;
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `sync_seq` integer;
--> statement-breakpoint
CREATE TABLE `sync_clock` (
	`id` integer PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `sync_clock` (`id`, `seq`) VALUES (1, 1);
--> statement-breakpoint
UPDATE `items` SET `sync_seq` = 1;
--> statement-breakpoint
UPDATE `saved_filters` SET `sync_seq` = 1;
--> statement-breakpoint
UPDATE `profile` SET `sync_seq` = 1;
--> statement-breakpoint
UPDATE `app_settings` SET `sync_seq` = 1;
--> statement-breakpoint
CREATE TRIGGER `items_sync_seq_insert` AFTER INSERT ON `items`
WHEN NEW.`sync_seq` IS NULL
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `items` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `items_sync_seq_update` AFTER UPDATE ON `items`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `items` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `saved_filters_sync_seq_insert` AFTER INSERT ON `saved_filters`
WHEN NEW.`sync_seq` IS NULL
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `saved_filters` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `saved_filters_sync_seq_update` AFTER UPDATE ON `saved_filters`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `saved_filters` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `profile_sync_seq_insert` AFTER INSERT ON `profile`
WHEN NEW.`sync_seq` IS NULL
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `profile` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `profile_sync_seq_update` AFTER UPDATE ON `profile`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `profile` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `app_settings_sync_seq_insert` AFTER INSERT ON `app_settings`
WHEN NEW.`sync_seq` IS NULL
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `app_settings` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `app_settings_sync_seq_update` AFTER UPDATE ON `app_settings`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
BEGIN
	UPDATE `sync_clock` SET `seq` = `seq` + 1 WHERE `id` = 1;
	UPDATE `app_settings` SET `sync_seq` = (SELECT `seq` FROM `sync_clock` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `items_updated_at_monotonic` AFTER UPDATE ON `items`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
  AND OLD.`updated_at` IS NOT NULL
  AND julianday(NEW.`updated_at`) <= julianday(OLD.`updated_at`)
BEGIN
	UPDATE `items` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.`updated_at`, '+0.001 seconds') WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `saved_filters_updated_at_monotonic` AFTER UPDATE ON `saved_filters`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
  AND OLD.`updated_at` IS NOT NULL
  AND julianday(NEW.`updated_at`) <= julianday(OLD.`updated_at`)
BEGIN
	UPDATE `saved_filters` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.`updated_at`, '+0.001 seconds') WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `profile_updated_at_monotonic` AFTER UPDATE ON `profile`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
  AND OLD.`updated_at` IS NOT NULL
  AND julianday(NEW.`updated_at`) <= julianday(OLD.`updated_at`)
BEGIN
	UPDATE `profile` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.`updated_at`, '+0.001 seconds') WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `app_settings_updated_at_monotonic` AFTER UPDATE ON `app_settings`
WHEN NEW.`sync_seq` IS OLD.`sync_seq`
  AND OLD.`updated_at` IS NOT NULL
  AND julianday(NEW.`updated_at`) <= julianday(OLD.`updated_at`)
BEGIN
	UPDATE `app_settings` SET `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.`updated_at`, '+0.001 seconds') WHERE `id` = NEW.`id`;
END;
