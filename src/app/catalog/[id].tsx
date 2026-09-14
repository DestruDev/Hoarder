import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { LibraryStatusControl } from '@/components/library-status-control';
import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { findItemByTitleAndType, getCatalogItemById, type CatalogItem, type Item } from '@/lib/db';

export default function CatalogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
        <Text>{error}</Text>
      </Screen>
    );
  }

  if (!loaded) {
    return (
      <Screen style={{ padding: 16 }}>
        <Text>Loading...</Text>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen style={{ padding: 16 }}>
        <Text>Title not found.</Text>
      </Screen>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: item.title }} />
      <Text>Title: {item.title}</Text>
      <Text>Type: {item.mediaType}</Text>
      <Text>Cover URL: {item.coverImageUrl ?? '—'}</Text>
      <LibraryStatusControl
        media={item}
        libraryItem={libraryItem}
        onLibraryItemChange={setLibraryItem}
      />
    </ScreenScrollView>
  );
}
