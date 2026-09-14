import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaSearch } from '@/components/media-search';
import { ScreenScrollView, Text } from '@/components/themed';
import { getItems, type Item } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';

export default function LibraryScreen() {
  const { query } = useMediaSearch();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getItems()
        .then((rows) => {
          if (!cancelled) {
            setItems(rows);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load items');
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
        <Text>No items yet. Seed sample data from Settings, or add your own.</Text>
      ) : visibleItems.length === 0 ? (
        <Text>No matching titles.</Text>
      ) : (
        visibleItems.map((item) => (
          <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable>
              <View>
                <Text>{item.title}</Text>
                <Text>
                  {item.mediaType} · {item.status}
                  {item.rating != null ? ` · ${item.rating}` : ''}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScrollView>
  );
}
