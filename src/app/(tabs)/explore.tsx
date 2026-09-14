import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaSearch } from '@/components/media-search';
import { ScreenScrollView, Text } from '@/components/themed';
import { getCatalogItems, type CatalogItem } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';

export default function ExploreScreen() {
  const { query } = useMediaSearch();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getCatalogItems()
        .then((rows) => {
          if (!cancelled) {
            setItems(rows);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load catalog');
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const visibleItems = items.filter((item) => matchesMediaName(item.title, query));

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 12 }}>
      {error ? <Text>{error}</Text> : null}

      {items.length === 0 ? (
        <Text>No catalog titles yet.</Text>
      ) : visibleItems.length === 0 ? (
        <Text>No matching titles.</Text>
      ) : (
        visibleItems.map((item) => (
          <Link
            key={item.id}
            href={{ pathname: '/catalog/[id]', params: { id: String(item.id) } }}
            asChild>
            <Pressable>
              <View>
                <Text>{item.title}</Text>
                <Text>{item.mediaType}</Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScrollView>
  );
}
