import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { MediaDetail } from '@/components/media-detail';
import { Screen, Text } from '@/components/themed';
import {
  findCatalogItemByTitleAndType,
  getItemById,
  type Item,
} from '@/lib/db';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);

  const [item, setItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<Item['releaseStatus']>(null);
  const [mangaOrigin, setMangaOrigin] = useState<Item['mangaOrigin']>(null);
  const [totalEpisodes, setTotalEpisodes] = useState<Item['totalEpisodes']>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (!Number.isFinite(itemId)) {
        setError('Invalid item id');
        setLoaded(true);
        return;
      }

      getItemById(itemId)
        .then(async (row) => {
          if (cancelled) {
            return;
          }

          setItem(row);
          setError(null);

          if (row) {
            const catalogItem = await findCatalogItemByTitleAndType(row.title, row.mediaType);
            if (!cancelled) {
              setCoverImageUrl(row.coverImageUrl ?? catalogItem?.coverImageUrl ?? null);
              setReleaseStatus(row.releaseStatus ?? catalogItem?.releaseStatus ?? null);
              setMangaOrigin(row.mangaOrigin ?? catalogItem?.mangaOrigin ?? null);
              setTotalEpisodes(row.totalEpisodes ?? catalogItem?.totalEpisodes ?? null);
            }
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load item');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoaded(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [itemId]),
  );

  if (error) {
    return (
      <Screen style={{ padding: 16 }}>
        <Stack.Screen options={{ title: 'Item' }} />
        <Text>{error}</Text>
      </Screen>
    );
  }

  if (!loaded) {
    return (
      <Screen style={{ padding: 16 }}>
        <Stack.Screen options={{ title: 'Item' }} />
        <Text>Loading...</Text>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen style={{ padding: 16 }}>
        <Stack.Screen options={{ title: 'Item' }} />
        <Text>Item not found.</Text>
      </Screen>
    );
  }

  return (
    <MediaDetail
      media={{
        title: item.title,
        mediaType: item.mediaType,
        coverImageUrl,
        releaseStatus,
        mangaOrigin,
        totalEpisodes,
      }}
      libraryItem={item}
      onLibraryItemChange={(next) => {
        setItem(next);
        if (next) {
          setCoverImageUrl(next.coverImageUrl ?? coverImageUrl);
          setReleaseStatus(next.releaseStatus ?? releaseStatus);
          setMangaOrigin(next.mangaOrigin ?? mangaOrigin);
          setTotalEpisodes(next.totalEpisodes);
        }
      }}
      onRemoved={() => router.back()}
    />
  );
}
