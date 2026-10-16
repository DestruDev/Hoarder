import { SAMPLE_CATALOG } from '@/lib/db/catalog-data';
import type { NewCatalogItem } from '@/lib/db/types';

import { fetchJson, mapInBatches } from './http';

const EXTRA_COMICS = [
  'Batman Year One',
  'The Walking Dead',
  'Hellboy',
  'Persepolis',
  'Bone',
  'Fun Home',
  'V for Vendetta',
  'Preacher',
  'Y The Last Man',
  'The Dark Knight Returns',
  'Blankets',
  'Nimona',
  'Ms. Marvel',
  'Spider-Man',
  'Saga',
  'Invincible',
  'The Sandman',
  'Maus',
  'Watchmen',
];

type ItunesRssImage = {
  label?: string;
};

type ItunesRssEntry = {
  'im:name'?: { label?: string };
  'im:image'?: ItunesRssImage[];
};

type ItunesRssFeed = {
  feed?: {
    entry?: ItunesRssEntry | ItunesRssEntry[];
  };
};

type ItunesSearchResult = {
  trackName?: string | null;
  collectionName?: string | null;
  artworkUrl100?: string | null;
  genres?: string[] | null;
};

type ItunesSearch = {
  results?: ItunesSearchResult[] | null;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function itunesArtwork(url: string | null | undefined, size = 400): string | null {
  if (!url) {
    return null;
  }

  return url.replace(/\/(\d+x\d+|0x\d+)(bb|cc)\.(png|jpe?g)$/i, `/${size}x${size}bb.jpg`);
}

function uniqueTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const title of titles) {
    const key = title.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(title);
  }

  return unique;
}

function mapFeedEntry(entry: ItunesRssEntry, mediaType: 'book' | 'movie'): NewCatalogItem | null {
  const title = entry['im:name']?.label?.trim();
  const images = asArray(entry['im:image']);
  const coverImageUrl = itunesArtwork(images[images.length - 1]?.label);

  if (!title || !coverImageUrl) {
    return null;
  }

  return {
    title,
    mediaType,
    coverImageUrl,
  };
}

async function fetchTypedFeed(url: string, mediaType: 'book' | 'movie'): Promise<NewCatalogItem[]> {
  const payload = (await fetchJson(url)) as ItunesRssFeed;
  return asArray(payload.feed?.entry).flatMap((entry) => {
    const mapped = mapFeedEntry(entry, mediaType);
    return mapped ? [mapped] : [];
  });
}

export async function fetchItunesBooks(): Promise<NewCatalogItem[]> {
  const feeds = await Promise.allSettled([
    fetchTypedFeed('https://itunes.apple.com/us/rss/toppaidebooks/limit=100/json', 'book'),
    fetchTypedFeed('https://itunes.apple.com/us/rss/topfreeebooks/limit=50/json', 'book'),
  ]);

  const items: NewCatalogItem[] = [];
  for (const result of feeds) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
  }

  return items;
}

function isGraphicNovel(result: ItunesSearchResult): boolean {
  return (result.genres ?? []).some((genre) => /comic|graphic novel/i.test(genre));
}

async function searchComic(title: string): Promise<NewCatalogItem | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=ebook&limit=5`;
  const payload = (await fetchJson(url)) as ItunesSearch;
  const results = payload.results ?? [];
  const match = results.find((result) => isGraphicNovel(result) && result.artworkUrl100) ?? results.find((result) => result.artworkUrl100);
  const coverImageUrl = itunesArtwork(match?.artworkUrl100);
  const matchedTitle = match?.trackName?.trim() || match?.collectionName?.trim();

  if (!matchedTitle || !coverImageUrl) {
    return null;
  }

  return {
    title: matchedTitle,
    mediaType: 'comic',
    coverImageUrl,
    mangaOrigin: 'american',
  };
}

export async function fetchItunesComics(): Promise<NewCatalogItem[]> {
  const titles = uniqueTitles([
    ...SAMPLE_CATALOG.filter((item) => item.mediaType === 'comic' && item.mangaOrigin === 'american').map(
      (item) => item.title,
    ),
    ...EXTRA_COMICS,
  ]);

  return mapInBatches(titles, 3, searchComic);
}

export async function lookupItunesMovieCover(title: string): Promise<string | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=movie&limit=1`;
  const payload = (await fetchJson(url)) as ItunesSearch;
  const match = payload.results?.find((result) => result.artworkUrl100);
  return itunesArtwork(match?.artworkUrl100);
}

async function searchMovie(title: string): Promise<NewCatalogItem | null> {
  const coverImageUrl = await lookupItunesMovieCover(title);
  if (!coverImageUrl) {
    return null;
  }

  return {
    title,
    mediaType: 'movie',
    coverImageUrl,
  };
}

export async function fetchItunesMovies(): Promise<NewCatalogItem[]> {
  const [chart, lookedUp] = await Promise.all([
    fetchTypedFeed('https://itunes.apple.com/us/rss/topmovies/limit=100/json', 'movie'),
    mapInBatches(
      SAMPLE_CATALOG.filter((item) => item.mediaType === 'movie').map((item) => item.title),
      3,
      searchMovie,
    ),
  ]);

  return [...lookedUp, ...chart];
}

export async function fetchItunesCatalog(): Promise<NewCatalogItem[]> {
  const books = await fetchItunesBooks();
  const comics = await fetchItunesComics();
  const movies = await fetchItunesMovies();
  return [...books, ...comics, ...movies];
}
