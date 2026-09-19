import { db, sqlite } from './client';
import { getItems } from './items';
import { items } from './schema';
import type { Item, NewItemInput } from './types';

type SampleItem = NewItemInput & { dateAdded: string };

export const SAMPLE_ITEMS: SampleItem[] = [
  {
    title: 'The Hobbit',
    mediaType: 'book',
    status: 'completed',
    rating: 9,
    notes: 'Comfort reread. Still holds up.',
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2024-11-02T18:20:00.000Z',
  },
  {
    title: 'Project Hail Mary',
    mediaType: 'book',
    status: 'in_progress',
    rating: 8,
    notes: 'Halfway through. Rocky is the best.',
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2025-03-14T12:00:00.000Z',
  },
  {
    title: 'Spirited Away',
    mediaType: 'movie',
    status: 'completed',
    rating: 10,
    notes: null,
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2024-08-21T21:15:00.000Z',
  },
  {
    title: 'Dune: Part Two',
    mediaType: 'movie',
    status: 'planning',
    rating: null,
    notes: 'Want to rewatch Part One first.',
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2026-01-09T16:40:00.000Z',
  },
  {
    title: 'The Bear',
    mediaType: 'tv',
    status: 'in_progress',
    rating: 8,
    notes: 'On season 3.',
    coverImageUrl: null,
    releaseStatus: 'releasing',
    dateAdded: '2025-06-02T19:05:00.000Z',
  },
  {
    title: 'Andor',
    mediaType: 'tv',
    status: 'planning',
    rating: null,
    notes: null,
    coverImageUrl: null,
    releaseStatus: 'released',
    dateAdded: '2026-04-18T10:30:00.000Z',
  },
  {
    title: "Frieren: Beyond Journey's End",
    mediaType: 'anime',
    status: 'in_progress',
    rating: 10,
    notes: 'Caught up. Waiting on the next cour.',
    coverImageUrl: null,
    releaseStatus: 'releasing',
    dateAdded: '2025-01-22T08:00:00.000Z',
  },
  {
    title: 'Fullmetal Alchemist',
    mediaType: 'manga',
    status: 'completed',
    rating: 10,
    notes: 'Read the manga after finishing the show.',
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2023-12-11T14:55:00.000Z',
  },
  {
    title: 'Elden Ring',
    mediaType: 'game',
    status: 'planning',
    rating: null,
    notes: 'Next after Hades.',
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2026-02-01T15:00:00.000Z',
  },
  {
    title: 'Hades',
    mediaType: 'game',
    status: 'on_hold',
    rating: null,
    notes: 'Escaped once. Still have heat 8 runs to do.',
    coverImageUrl: null,
    releaseStatus: null,
    dateAdded: '2024-05-30T01:12:00.000Z',
  },
];

export async function seedItems(): Promise<Item[]> {
  const created = await db.insert(items).values(SAMPLE_ITEMS).returning();
  return created;
}

export async function seedIfEmpty(): Promise<Item[]> {
  const existing = await getItems();
  if (existing.length > 0) {
    return existing;
  }

  return seedItems();
}

export async function resetAndSeed(): Promise<Item[]> {
  await db.delete(items);

  try {
    sqlite.execSync("DELETE FROM sqlite_sequence WHERE name = 'items'");
  } catch {
    // sqlite_sequence is created after the first insert; ignore if missing.
  }

  return seedItems();
}
