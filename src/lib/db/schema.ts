import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { CollectionView, ComicOrigin, FeedKind, ItemStatus, MediaType, RatingSystem, ReleaseStatus } from './types';

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  mediaType: text('media_type').notNull().$type<MediaType>(),
  status: text('status').notNull().$type<ItemStatus>(),
  rating: real('rating'),
  notes: text('notes'),
  coverImageUrl: text('cover_image_url'),
  releaseStatus: text('release_status').$type<ReleaseStatus>(),
  mangaOrigin: text('manga_origin').$type<ComicOrigin>(),
  totalEpisodes: integer('total_episodes'),
  totalPages: integer('total_pages'),
  totalChapters: integer('total_chapters'),
  currentEpisodes: integer('current_episodes'),
  currentPages: integer('current_pages'),
  currentChapters: integer('current_chapters'),
  dateAdded: text('date_added').notNull(),
  finishDate: text('finish_date'),
});

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  name: text('name'),
  description: text('description'),
  avatarUrl: text('avatar_url'),
});

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  ratingSystem: text('rating_system').notNull().$type<RatingSystem>(),
  libraryView: text('library_view').notNull().default('list').$type<CollectionView>(),
  exploreView: text('explore_view').notNull().default('card').$type<CollectionView>(),
});

export const catalog = sqliteTable('catalog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  mediaType: text('media_type').notNull().$type<MediaType>(),
  coverImageUrl: text('cover_image_url'),
  releaseStatus: text('release_status').$type<ReleaseStatus>(),
  mangaOrigin: text('manga_origin').$type<ComicOrigin>(),
  totalEpisodes: integer('total_episodes'),
  totalPages: integer('total_pages'),
  totalChapters: integer('total_chapters'),
});

export const feedNotifications = sqliteTable('feed_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  mediaTitle: text('media_title').notNull(),
  mediaType: text('media_type').notNull().$type<MediaType>(),
  kind: text('kind').notNull().$type<FeedKind>(),
  occurredAt: text('occurred_at').notNull(),
  catalogId: integer('catalog_id').notNull(),
  liked: integer('liked', { mode: 'boolean' }).notNull().default(false),
  likeCount: integer('like_count').notNull().default(0),
});
