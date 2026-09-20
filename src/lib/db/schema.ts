import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { ComicOrigin, ItemStatus, MediaType, ReleaseStatus } from './types';

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  mediaType: text('media_type').notNull().$type<MediaType>(),
  status: text('status').notNull().$type<ItemStatus>(),
  rating: integer('rating'),
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
