import type { NewCatalogItem } from '@/lib/db/types';

import { CATALOG_SECTION_LIMIT } from '@/lib/catalog-sections';

import { fetchJson } from './http';

type SteamSpyGame = {
  appid?: number | null;
  name?: string | null;
  owners?: string | null;
  positive?: number | null;
};

function ownerCount(owners: string | null | undefined): number {
  const low = Number(String(owners ?? '').replace(/,/g, '').split('..')[0]);
  return Number.isFinite(low) ? low : 0;
}

function steamCoverUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
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

  const items: NewCatalogItem[] = [];

  for (const entry of ranked) {
    const title = entry.name?.replace(/®|™/g, '').trim();
    if (!title || entry.appid == null) {
      continue;
    }

    items.push({
      title,
      mediaType: 'game',
      coverImageUrl: steamCoverUrl(entry.appid),
    });

    if (items.length >= CATALOG_SECTION_LIMIT) {
      break;
    }
  }

  return items;
}
