import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { CollectionView, ColorScheme, ComicOrigin, ItemStatus, MediaType, RatingSystem, ReleaseStatus, SavedFilterTab } from './types';

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id'),
  // Shared id across devices; the local integer id never leaves this device.
  syncId: text('sync_id').unique(),
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
  startDate: text('start_date'),
  finishDate: text('finish_date'),
  updatedAt: text('updated_at'),
  // Soft delete so the deletion can sync to other devices.
  deletedAt: text('deleted_at'),
}, (table) => [index('items_user_id_idx').on(table.userId)]);

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  userId: text('user_id').unique(),
  name: text('name'),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  updatedAt: text('updated_at'),
});

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  userId: text('user_id').unique(),
  ratingSystem: text('rating_system').notNull().$type<RatingSystem>(),
  libraryView: text('library_view').notNull().default('list').$type<CollectionView>(),
  exploreView: text('explore_view').notNull().default('card').$type<CollectionView>(),
  colorScheme: text('color_scheme').notNull().default('dark').$type<ColorScheme>(),
  // Comma-separated ItemStatus list of library sections that start expanded.
  libraryExpanded: text('library_expanded').notNull().default('in_progress'),
  updatedAt: text('updated_at'),
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
  globalRating: real('global_rating'),
  season: text('season'),
  genres: text('genres'),
  creator: text('creator'),
  synopsis: text('synopsis'),
  releaseDate: text('release_date'),
  // Where the row came from ('anilist', 'tmdb-movie', 'tmdb-tv', 'tvmaze', 'steam', 'itunes')
  // and that source's id. Null for rows saved before search existed.
  source: text('source'),
  externalId: text('external_id'),
  // Chart rows shown in Explore's sections. Rows saved from search or Related stay
  // searchable but don't crowd the charts.
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
}, (table) => [uniqueIndex('catalog_source_external_id_unique').on(table.source, table.externalId)]);

export const savedFilters = sqliteTable('saved_filters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  syncId: text('sync_id').unique(),
  tab: text('tab').notNull().$type<SavedFilterTab>(),
  name: text('name').notNull(),
  // JSON-encoded BrowseFilters from the filter sheet.
  filters: text('filters').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => [index('saved_filters_user_tab_idx').on(table.userId, table.tab)]);

// Related-title lists from AniList/Wikidata, kept forever once fetched.
export const relatedMedia = sqliteTable('related_media', {
  // `${mediaType}:${lowercased title}` of the title the list belongs to.
  sourceKey: text('source_key').primaryKey(),
  // JSON-encoded RelatedMedia[].
  related: text('related').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});

