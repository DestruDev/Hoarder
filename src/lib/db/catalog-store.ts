import { eq } from 'drizzle-orm';

import { db } from './client';
import { catalog } from './schema';
import type { CatalogItem, MediaType } from './types';

export async function getCatalogItems(mediaType?: MediaType): Promise<CatalogItem[]> {
  if (mediaType) {
    return db.select().from(catalog).where(eq(catalog.mediaType, mediaType));
  }

  return db.select().from(catalog);
}

export async function getCatalogItemById(id: number): Promise<CatalogItem | undefined> {
  const [item] = await db.select().from(catalog).where(eq(catalog.id, id)).limit(1);
  return item;
}
