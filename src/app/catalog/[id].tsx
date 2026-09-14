import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { getCatalogItemById, type CatalogItem } from '@/lib/db';

export default function CatalogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);

  const [item, setItem] = useState<CatalogItem | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(itemId)) {
      setError('Invalid catalog id');
      setLoaded(true);
      return;
    }

    getCatalogItemById(itemId)
      .then((row) => {
        setItem(row);
        setLoaded(true);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load title');
        setLoaded(true);
      });
  }, [itemId]);

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
    </ScreenScrollView>
  );
}
