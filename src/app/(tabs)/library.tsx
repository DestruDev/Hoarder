import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ScreenScrollView, Text } from '@/components/themed';
import { getItems, type Item } from '@/lib/db';

export default function LibraryScreen() {
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

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {error ? <Text>{error}</Text> : null}

      {items.length === 0 ? (
        <Text>No items yet. Seed sample data from Settings, or add your own.</Text>
      ) : (
        items.map((item) => (
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
