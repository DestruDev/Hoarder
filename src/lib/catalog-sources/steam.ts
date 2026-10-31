import type { NewCatalogItem } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson, mapInBatches } from './http';
import { cleanSynopsis, joinGenres, joinNames, seasonFromLooseDate } from './metadata';
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
    release_date?: { date?: string | null } | null;
  } | null;
};

function ownerCount(owners: string | null | undefined): number {
  const low = Number(String(owners ?? '').replace(/,/g, '').split('..')[0]);
  return Number.isFinite(low) ? low : 0;
}

function steamCoverUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

async function attachStoreDetails(
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
      },
    });

    if (games.length >= CATALOG_SECTION_LIMIT) {
      break;
    }
  }

  return mapInBatches(games, 4, ({ item, appId }) => attachStoreDetails(item, appId));
}
