import type { NewCatalogItem } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson, mapInBatches } from './http';
import {
  cleanSynopsis,
  isoDateFromLooseDate,
  joinGenres,
  joinNames,
  releaseStatusFromDate,
  seasonFromLooseDate,
} from './metadata';
import { ratioScoreOutOfTen } from './rating';

type SteamSpyGame = {
  appid?: number | null;
  name?: string | null;
  owners?: string | null;
  positive?: number | null;
  negative?: number | null;
};

type SteamAppDetails = {
  success?: boolean;
  data?: {
    short_description?: string | null;
    developers?: string[] | null;
    genres?: Array<{ description?: string | null }> | null;
    release_date?: { date?: string | null; coming_soon?: boolean | null } | null;
  } | null;
};

function ownerCount(owners: string | null | undefined): number {
  const low = Number(String(owners ?? '').replace(/,/g, '').split('..')[0]);
  return Number.isFinite(low) ? low : 0;
}

export function steamCoverUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

export async function attachStoreDetails(
  item: NewCatalogItem,
  appId: number,
): Promise<NewCatalogItem> {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
    const payload = (await fetchJson(url)) as Record<string, SteamAppDetails>;
    const details = payload[String(appId)];
    if (!details?.success || !details.data) {
      return item;
    }

    return {
      ...item,
      season: seasonFromLooseDate(details.data.release_date?.date),
      releaseDate: isoDateFromLooseDate(details.data.release_date?.date),
      releaseStatus: releaseStatusFromDate(
        details.data.release_date?.date,
        details.data.release_date?.coming_soon === true,
      ),
      genres: joinGenres(details.data.genres?.map((genre) => genre.description)),
      creator: joinNames(details.data.developers),
      synopsis: cleanSynopsis(details.data.short_description),
    };
  } catch (reason) {
    console.warn('[Hoarder catalog] Steam store details fetch failed:', reason);
    return item;
  }
}

export async function fetchSteamCatalog(): Promise<NewCatalogItem[]> {
  const payload = (await fetchJson('https://steamspy.com/api.php?request=top100forever')) as Record<
    string,
    SteamSpyGame
  >;

  const ranked = Object.values(payload).sort((left, right) => {
    const byOwners = ownerCount(right.owners) - ownerCount(left.owners);
    if (byOwners !== 0) {
      return byOwners;
    }

    return (right.positive ?? 0) - (left.positive ?? 0);
  });

  const games: Array<{ item: NewCatalogItem; appId: number }> = [];

  for (const entry of ranked) {
    const title = entry.name?.replace(/®|™/g, '').trim();
    if (!title || entry.appid == null) {
      continue;
    }

    games.push({
      appId: entry.appid,
      item: {
        title,
        mediaType: 'game',
        coverImageUrl: steamCoverUrl(entry.appid),
        globalRating: ratioScoreOutOfTen(entry.positive, entry.negative),
        source: 'steam',
        externalId: String(entry.appid),
      },
    });

    if (games.length >= CATALOG_SECTION_LIMIT) {
      break;
    }
  }

  return mapInBatches(games, 4, ({ item, appId }) => attachStoreDetails(item, appId));
}

type SteamStoreSearch = {
  items?: Array<{ id?: number | null; name?: string | null; type?: string | null } | null> | null;
};

export function cleanSteamTitle(name: string | null | undefined): string | null {
  const title = name?.replace(/®|™/g, '').trim();
  return title ? title : null;
}

// Store search returns names and ids only; hydrateSteamEntry fills in the rest on open.
export async function searchSteam(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<NewCatalogItem[]> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=english`;
  const payload = (await fetchJson(url, { signal })) as SteamStoreSearch;
  const items: NewCatalogItem[] = [];

  for (const entry of payload.items ?? []) {
    const title = cleanSteamTitle(entry?.name);
    if (!entry || !title || entry.id == null || (entry.type && entry.type !== 'app')) {
      continue;
    }

    items.push({
      title,
      mediaType: 'game',
      coverImageUrl: steamCoverUrl(entry.id),
      source: 'steam',
      externalId: String(entry.id),
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

export async function hydrateSteamEntry(entry: NewCatalogItem): Promise<NewCatalogItem> {
  const appId = Number(entry.externalId);
  if (entry.source !== 'steam' || !Number.isInteger(appId)) {
    return entry;
  }

  return attachStoreDetails(entry, appId);
}
