import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { MediaDetail } from '@/components/media-detail';
import { Screen, Text } from '@/components/themed';
import {
  findItemByTitleAndType,
  getCatalogItemById,
  type CatalogItem,
  type Item,
} from '@/lib/db';

export default function CatalogDetailScreen() {
  // The opener passes the title along so the header is right before the row loads.
  const { id, title: titleParam } = useLocalSearchParams<{ id: string; title?: string }>();
  const itemId = Number(id);

  const [item, setItem] = useState<CatalogItem | undefined>();
  const [libraryItem, setLibraryItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (!Number.isFinite(itemId)) {
        setError('Invalid catalog id');
        setLoaded(true);
        return;
      }

      getCatalogItemById(itemId)
        .then(async (row) => {
          if (cancelled) {
            return;
          }

          setItem(row);
          setError(null);

          if (row) {
            const existing = await findItemByTitleAndType(row.title, row.mediaType);
            if (!cancelled) {
              setLibraryItem(existing);
            }
          } else {
            setLibraryItem(undefined);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load title');
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
        <Stack.Screen options={{ title: titleParam ?? 'Title' }} />
        <Text>{error}</Text>
      </Screen>
    );
  }

  if (!loaded) {
    return (
      <Screen style={{ padding: 16 }}>
        <Stack.Screen options={{ title: titleParam ?? 'Title' }} />
        <Text>Loading...</Text>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen style={{ padding: 16 }}>
        <Stack.Screen options={{ title: titleParam ?? 'Title' }} />
        <Text>Title not found.</Text>
      </Screen>
    );
  }

  return (
    <MediaDetail
      media={item}
      libraryItem={libraryItem}
      onLibraryItemChange={setLibraryItem}
      onRemoved={() => setLibraryItem(undefined)}
    />
  );
}
