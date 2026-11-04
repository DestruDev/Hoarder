import { getStoredRelatedMedia, saveRelatedMedia } from '@/lib/db/related-store';
import type { ComicOrigin, MediaType, NewCatalogItem } from '@/lib/db/types';

import { fetchAnilist, mapMedia, MEDIA_FIELDS, type AnilistMedia } from './anilist';
import { fetchJson, mapInBatches } from './http';
import { searchBook, searchComic, searchMovie } from './itunes';
import { isoDateFromLooseDate, seasonFromIsoDate } from './metadata';
import { attachStoreDetails, steamCoverUrl } from './steam';
import { mapPoster, tmdbApiKey } from './tmdb';
import { mapShow, type TvmazeShow } from './tvmaze';

export type RelatedMedia = {
  relation: string;
  entry: NewCatalogItem;
};

export type RelatedSource = {
  title: string;
  mediaType: MediaType;
  mangaOrigin?: ComicOrigin | null;
  season?: string | null;
};

const RELATION_ORDER = [
  'Prequel',
  'Parent story',
  'Base game',
  'Sequel',
  'Expansion',
  'Side story',
  'Spin-off',
  'Source',
  'Adaptation',
  'Alternative',
  'Summary',
  'Compilation',
  'Contains',
  'Same series',
  'Other',
];

const MAX_RELATED = 20;

// AniList: anime and Asian comics.

// CHARACTER is left out: a shared cameo doesn't make two titles related.
const ANILIST_RELATION_LABELS: Record<string, string> = {
  PREQUEL: 'Prequel',
  SEQUEL: 'Sequel',
  PARENT: 'Parent story',
  SIDE_STORY: 'Side story',
  SPIN_OFF: 'Spin-off',
  ADAPTATION: 'Adaptation',
  SOURCE: 'Source',
  ALTERNATIVE: 'Alternative',
  SUMMARY: 'Summary',
  COMPILATION: 'Compilation',
  CONTAINS: 'Contains',
  OTHER: 'Other',
};

const RELATIONS_QUERY = `
query ($search: String, $type: MediaType) {
  Media(search: $search, type: $type, isAdult: false) {
    relations {
      edges {
        relationType
        node {
          type
          isAdult
          ${MEDIA_FIELDS}
        }
      }
    }
  }
}
`;

type AnilistRelationNode = AnilistMedia & {
  type?: string | null;
  isAdult?: boolean | null;
};

type AnilistRelationsResponse = {
  data?: {
    Media?: {
      relations?: {
        edges?: Array<{
          relationType?: string | null;
          node?: AnilistRelationNode | null;
        } | null> | null;
      } | null;
    } | null;
  };
};

async function fetchAnilistRelated(source: RelatedSource): Promise<RelatedMedia[]> {
  const payload = await fetchAnilist<AnilistRelationsResponse>(RELATIONS_QUERY, {
    search: source.title,
    type: source.mediaType === 'anime' ? 'ANIME' : 'MANGA',
  });
  const related: RelatedMedia[] = [];

  for (const edge of payload.data?.Media?.relations?.edges ?? []) {
    const relation = edge?.relationType ? ANILIST_RELATION_LABELS[edge.relationType] : undefined;
    const node = edge?.node;
    if (!relation || !node || node.isAdult) {
      continue;
    }

    const entry = mapMedia(node, node.type === 'ANIME' ? 'anime' : 'comic');
    if (entry) {
      related.push({ relation, entry });
    }
  }

  return related;
}

// Wikidata: movies, TV, books, games and Western comics.

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
// Wikimedia throttles requests that don't identify the client.
const WIKIDATA_USER_AGENT = 'Hoarder/1.0 (media tracking app)';
const WIKIDATA_HEADERS = { 'User-Agent': WIKIDATA_USER_AGENT, 'Api-User-Agent': WIKIDATA_USER_AGENT };
const PORNOGRAPHIC_FILM = 'Q185529';
const MANGA_KINDS = new Set(['Q21198342', 'Q8274']);

// Wikidata "instance of" (P31) classes for each media type.
const WIKIDATA_KINDS: Partial<Record<MediaType, string[]>> = {
  movie: ['Q11424', 'Q506240', 'Q29168811', 'Q24869', 'Q202866', 'Q18011172'],
  tv: ['Q5398426', 'Q1259759', 'Q526877', 'Q581714'],
  anime: ['Q63952888', 'Q1107'],
  // Before book: graphic novels are often tagged as literary works too.
  comic: ['Q1004', 'Q1760610', 'Q14406742', 'Q3297186', 'Q725377', 'Q838795', ...MANGA_KINDS],
  book: ['Q7725634', 'Q8261', 'Q571', 'Q47461344', 'Q1667921', 'Q277759'],
  // Video game, game series, expansion pack, downloadable content.
  game: ['Q7889', 'Q7058673', 'Q209163', 'Q1755420'],
};

const SCREEN_TYPES = new Set<MediaType>(['movie', 'tv', 'anime']);

type WikidataEntity = {
  id?: string;
  labels?: Record<string, { value?: string } | undefined>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
};

type WikidataEntities = {
  entities?: Record<string, WikidataEntity>;
};

type WikidataSearch = {
  query?: { search?: Array<{ title?: string }> };
};

type WikidataEntitySearch = {
  search?: Array<{ id?: string }>;
};

type WikidataKind = {
  mediaType: MediaType;
  mangaOrigin: ComicOrigin | null;
};

function claimValues(entity: WikidataEntity, property: string): unknown[] {
  return (entity.claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value);
}

function claimIds(entity: WikidataEntity, property: string): string[] {
  return claimValues(entity, property).flatMap((value) => {
    const id = (value as { id?: unknown } | undefined)?.id;
    return typeof id === 'string' ? [id] : [];
  });
}

function claimString(entity: WikidataEntity, property: string): string | null {
  const value = claimValues(entity, property).find((item) => typeof item === 'string');
  return typeof value === 'string' ? value : null;
}

function claimDate(entity: WikidataEntity, property: string): string | null {
  for (const value of claimValues(entity, property)) {
    const time = (value as { time?: unknown } | undefined)?.time;
    if (typeof time === 'string') {
      return time.replace(/^\+/, '');
    }
  }

  return null;
}

function labelOf(entity: WikidataEntity): string | null {
  // Newer entries often only carry a language-neutral (mul) label.
  return entity.labels?.en?.value?.trim() || entity.labels?.mul?.value?.trim() || null;
}

function yearOf(text: string | null | undefined): string | null {
  return text?.match(/\b(\d{4})\b/)?.[1] ?? null;
}

function classify(entity: WikidataEntity): WikidataKind | null {
  const kinds = claimIds(entity, 'P31');
  if (kinds.includes(PORNOGRAPHIC_FILM) || claimIds(entity, 'P136').includes(PORNOGRAPHIC_FILM)) {
    return null;
  }

  for (const [mediaType, classes] of Object.entries(WIKIDATA_KINDS) as Array<[MediaType, string[]]>) {
    const match = kinds.find((kind) => classes.includes(kind));
    if (match) {
      const mangaOrigin =
        mediaType === 'comic' ? (MANGA_KINDS.has(match) ? 'japanese' : 'american') : null;
      return { mediaType, mangaOrigin };
    }
  }

  return null;
}

async function searchWikidata(query: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    format: 'json',
    origin: '*',
    srlimit: String(limit),
    srsearch: query,
  });
  const payload = (await fetchJson(`${WIKIDATA_API}?${params}`, {
    headers: WIKIDATA_HEADERS,
  })) as WikidataSearch;

  return (payload.query?.search ?? []).flatMap((result) => (result.title ? [result.title] : []));
}

// Label/alias search ranked by popularity; finds titles the full-text search misses.
async function searchWikidataTitles(title: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    format: 'json',
    origin: '*',
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '10',
    search: title,
  });
  const payload = (await fetchJson(`${WIKIDATA_API}?${params}`, {
    headers: WIKIDATA_HEADERS,
  })) as WikidataEntitySearch;

  return (payload.search ?? []).flatMap((result) => (result.id ? [result.id] : []));
}

async function getWikidataEntities(ids: string[]): Promise<WikidataEntity[]> {
  const entities: WikidataEntity[] = [];

  for (let index = 0; index < ids.length; index += 50) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      origin: '*',
      props: 'labels|claims',
      languages: 'en|mul',
      ids: ids.slice(index, index + 50).join('|'),
    });
    const payload = (await fetchJson(`${WIKIDATA_API}?${params}`, {
      headers: WIKIDATA_HEADERS,
    })) as WikidataEntities;

    // Keep the requested order; it carries the search ranking.
    for (const id of ids.slice(index, index + 50)) {
      const entity = payload.entities?.[id];
      if (entity?.claims) {
        entities.push(entity);
      }
    }
  }

  return entities;
}

async function findWikidataSource(source: RelatedSource): Promise<WikidataEntity | null> {
  if (!WIKIDATA_KINDS[source.mediaType]) {
    return null;
  }

  const title = source.title.trim();
  const candidates = (await getWikidataEntities(await searchWikidataTitles(title))).filter(
    (entity) => classify(entity)?.mediaType === source.mediaType,
  );
  const exact = candidates.filter((entity) => labelOf(entity)?.toLowerCase() === title.toLowerCase());
  const year = yearOf(source.season);
  const sameYear = year ? exact.find((entity) => yearOf(claimDate(entity, 'P577')) === year) : undefined;

  return sameYear ?? exact[0] ?? candidates[0] ?? null;
}

function commonsImage(entity: WikidataEntity): string | null {
  const file = claimString(entity, 'P18');
  // SVGs on title entries are almost always logos, not covers.
  if (!file || /\.svg$/i.test(file)) {
    return null;
  }

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`;
}

async function fetchTmdbMoviePoster(tmdbId: string): Promise<Partial<NewCatalogItem> | null> {
  const apiKey = tmdbApiKey();
  if (!apiKey) {
    return null;
  }

  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${encodeURIComponent(apiKey)}`;
  const payload = (await fetchJson(url)) as { poster_path?: string | null };
  const coverImageUrl = mapPoster(payload.poster_path);
  return coverImageUrl ? { coverImageUrl } : null;
}

const ANILIST_SEARCH_QUERY = `
query ($search: String, $type: MediaType) {
  Media(search: $search, type: $type, isAdult: false) {
    ${MEDIA_FIELDS}
  }
}
`;

// Anime/manga that Wikidata turned up (e.g. a game's manga); AniList has the art.
async function searchAnilist(title: string, mediaType: 'anime' | 'comic'): Promise<NewCatalogItem | null> {
  const payload = await fetchAnilist<{ data?: { Media?: AnilistMedia | null } }>(ANILIST_SEARCH_QUERY, {
    search: title,
    type: mediaType === 'anime' ? 'ANIME' : 'MANGA',
  });
  const media = payload.data?.Media;
  return media ? mapMedia(media, mediaType) : null;
}

// Steam's store search, for games and DLC whose Wikidata entry has no Steam app id.
async function searchSteamAppId(title: string): Promise<number | null> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&cc=us&l=english`;
  const payload = (await fetchJson(url)) as { items?: Array<{ id?: number; name?: string }> };
  // Steam styles names differently ("ELDEN RING Shadow of the Erdtree"), so compare loosely.
  const loose = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const wanted = loose(title);
  const match = payload.items?.find((item) => item.name && loose(item.name) === wanted);
  return match?.id ?? null;
}

async function lookupDetails(
  entity: WikidataEntity,
  base: NewCatalogItem,
): Promise<Partial<NewCatalogItem> | null> {
  switch (base.mediaType) {
    case 'tv': {
      const tvmazeId = claimString(entity, 'P8600');
      if (!tvmazeId) {
        return null;
      }
      const show = (await fetchJson(
        `https://api.tvmaze.com/shows/${encodeURIComponent(tvmazeId)}?embed=seasons`,
      )) as TvmazeShow;
      return mapShow(show);
    }
    case 'movie': {
      const tmdbId = claimString(entity, 'P4947');
      const poster = tmdbId ? await fetchTmdbMoviePoster(tmdbId) : null;
      return poster ?? (await searchMovie(base.title));
    }
    case 'book':
      return searchBook(base.title);
    case 'comic':
      return base.mangaOrigin === 'american'
        ? searchComic(base.title)
        : searchAnilist(base.title, 'comic');
    case 'anime':
      return searchAnilist(base.title, 'anime');
    case 'game': {
      const appId = Number(claimString(entity, 'P1733')) || (await searchSteamAppId(base.title));
      return appId && Number.isInteger(appId) && appId > 0
        ? attachStoreDetails({ ...base, coverImageUrl: steamCoverUrl(appId) }, appId)
        : null;
    }
    default:
      return null;
  }
}

async function wikidataEntry(entity: WikidataEntity, kind: WikidataKind): Promise<NewCatalogItem | null> {
  const title = labelOf(entity);
  if (!title) {
    return null;
  }

  const releaseDate = isoDateFromLooseDate(claimDate(entity, 'P577'));
  const base: NewCatalogItem = {
    title,
    mediaType: kind.mediaType,
    mangaOrigin: kind.mangaOrigin,
    coverImageUrl: commonsImage(entity),
    season: seasonFromIsoDate(releaseDate),
    releaseDate,
  };

  const details = await lookupDetails(entity, base).catch(() => null);
  if (!details) {
    return base;
  }

  const merged: NewCatalogItem = { ...base };
  for (const [key, value] of Object.entries(details)) {
    if (value != null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  // Keep Wikidata's identity; lookups by title can return a differently named match.
  return { ...merged, title, mediaType: base.mediaType, mangaOrigin: base.mangaOrigin };
}

type WikidataLink =
  | 'P155'
  | 'P156'
  | 'P144'
  | 'P4969'
  | 'P8646'
  | 'basedOnThis'
  | 'expansion'
  | 'series';

function wikidataRelation(link: WikidataLink, source: MediaType, other: MediaType): string {
  const bothScreen = SCREEN_TYPES.has(source) && SCREEN_TYPES.has(other);

  switch (link) {
    case 'P155':
      return 'Prequel';
    case 'P156':
      return 'Sequel';
    case 'P144':
      return bothScreen ? 'Parent story' : 'Source';
    case 'P8646':
      return 'Base game';
    case 'expansion':
      return 'Expansion';
    case 'series':
      return 'Same series';
    default:
      return bothScreen ? 'Spin-off' : 'Adaptation';
  }
}

async function fetchWikidataRelated(source: RelatedSource): Promise<RelatedMedia[]> {
  const entity = await findWikidataSource(source);
  const sourceId = entity?.id;
  if (!entity || !sourceId) {
    return [];
  }

  const linkById = new Map<string, WikidataLink>();
  function link(id: string, kind: WikidataLink) {
    if (id !== sourceId && !linkById.has(id)) {
      linkById.set(id, kind);
    }
  }

  // P8646 "expansion of": DLC pointing at its base game.
  for (const property of ['P155', 'P156', 'P8646', 'P144', 'P4969'] as const) {
    claimIds(entity, property).forEach((id) => link(id, property));
  }

  // Adaptations, spin-offs and DLC only link back from their own side.
  const reverseIds = await searchWikidata(`haswbstatement:P144=${sourceId}|P8646=${sourceId}`, MAX_RELATED);
  const reverse = await getWikidataEntities(reverseIds.filter((id) => !linkById.has(id)));
  for (const other of reverse) {
    if (other.id) {
      link(other.id, claimIds(other, 'P8646').includes(sourceId) ? 'expansion' : 'basedOnThis');
    }
  }

  // Game series (P179) are well kept; for film and TV the property is too noisy.
  const series = source.mediaType === 'game' ? claimIds(entity, 'P179')[0] : undefined;
  if (series) {
    (await searchWikidata(`haswbstatement:P179=${series}`, MAX_RELATED)).forEach((id) => link(id, 'series'));
  }

  const fetched = new Map(reverse.map((other) => [other.id, other]));
  const missing = [...linkById.keys()].filter((id) => !fetched.has(id));
  for (const other of await getWikidataEntities(missing.slice(0, MAX_RELATED + 10))) {
    fetched.set(other.id, other);
  }

  // Series siblings were added last, so they're the first to go past the cap.
  return mapInBatches([...linkById.keys()].slice(0, MAX_RELATED + 10), 4, async (id) => {
    const other = fetched.get(id);
    const kind = other ? classify(other) : null;
    const linkKind = linkById.get(id);
    if (!other || !kind || !linkKind) {
      return null;
    }

    const entry = await wikidataEntry(other, kind);
    return entry ? { relation: wikidataRelation(linkKind, source.mediaType, kind.mediaType), entry } : null;
  });
}

// Public API.

function usesAnilist(source: RelatedSource): boolean {
  return (
    source.mediaType === 'anime' ||
    (source.mediaType === 'comic' && (source.mangaOrigin ?? 'american') !== 'american')
  );
}

function entryKey(entry: Pick<NewCatalogItem, 'title' | 'mediaType'>): string {
  return `${entry.mediaType}:${entry.title.trim().toLowerCase()}`;
}

function relationRank(relation: string): number {
  const index = RELATION_ORDER.indexOf(relation);
  return index === -1 ? RELATION_ORDER.length : index;
}

async function loadRelatedMedia(source: RelatedSource): Promise<RelatedMedia[]> {
  const related = usesAnilist(source)
    ? await fetchAnilistRelated(source)
    : await fetchWikidataRelated(source);

  const seen = new Set([entryKey(source)]);
  const unique: RelatedMedia[] = [];
  for (const item of related) {
    const key = entryKey(item.entry);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique
    .sort(
      (a, b) =>
        relationRank(a.relation) - relationRank(b.relation) ||
        (a.entry.releaseDate ?? '9999').localeCompare(b.entry.releaseDate ?? '9999'),
    )
    .slice(0, MAX_RELATED);
}

// Lists are stored permanently once fetched; new entries added to a franchise later
// won't show up until the stored row is cleared (Debug screen).
async function storedOrFetched(source: RelatedSource, key: string): Promise<RelatedMedia[]> {
  const stored = await getStoredRelatedMedia(key).catch(() => undefined);
  if (stored) {
    try {
      return JSON.parse(stored) as RelatedMedia[];
    } catch {
      // Unreadable row: fetch again and overwrite it below.
    }
  }

  const related = await loadRelatedMedia(source);
  await saveRelatedMedia(key, JSON.stringify(related)).catch((reason: unknown) => {
    console.warn('[Hoarder related] save failed:', reason);
  });
  return related;
}

// In-memory layer on top, so repeat visits in a session skip the database too.
const relatedCache = new Map<string, Promise<RelatedMedia[]>>();

export function forgetRelatedMedia(): void {
  relatedCache.clear();
}

export function fetchRelatedMedia(source: RelatedSource): Promise<RelatedMedia[]> {
  const key = entryKey(source);
  let pending = relatedCache.get(key);

  if (!pending) {
    pending = storedOrFetched(source, key).catch((reason: unknown) => {
      // Let the next visit try again instead of caching the failure.
      relatedCache.delete(key);
      console.warn('[Hoarder related] lookup failed:', reason);
      return [];
    });
    relatedCache.set(key, pending);
  }

  return pending;
}
