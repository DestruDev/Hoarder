import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { ItemStatus, MediaType } from './types';

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  mediaType: text('media_type').notNull().$type<MediaType>(),
  status: text('status').notNull().$type<ItemStatus>(),
  rating: integer('rating'),
  notes: text('notes'),
  coverImageUrl: text('cover_image_url'),
  dateAdded: text('date_added').notNull(),
});
