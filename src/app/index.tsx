import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { getItems, type Item } from '@/lib/db';

export default function ListScreen() {
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
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Link href="/form" asChild>
        <Pressable>
          <Text>Add item</Text>
        </Pressable>
      </Link>

      {error ? <Text>{error}</Text> : null}

      {items.length === 0 ? (
        <Text>No items yet.</Text>
      ) : (
        items.map((item) => (
          <Link key={item.id} href={{ pathname: '/item/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable>
              <View>
                <Text>{item.title}</Text>
                <Text>
                  {item.mediaType} · {item.status}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}
