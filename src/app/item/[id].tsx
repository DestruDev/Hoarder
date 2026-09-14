import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { LibraryStatusControl } from '@/components/library-status-control';
import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { deleteItem, getItemById, type Item } from '@/lib/db';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);

  const [item, setItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (!Number.isFinite(itemId)) {
        setError('Invalid item id');
        setLoaded(true);
        return;
      }

      getItemById(itemId)
        .then((row) => {
          if (!cancelled) {
            setItem(row);
            setError(null);
            setLoaded(true);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load item');
            setLoaded(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [itemId]),
  );

  async function handleDelete() {
    await deleteItem(itemId);
    router.back();
  }

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
        <Text>Item not found.</Text>
      </Screen>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: item.title }} />
      <Text>Title: {item.title}</Text>
      <Text>Type: {item.mediaType}</Text>
      <Text>Rating: {item.rating ?? '—'}</Text>
      <Text>Notes: {item.notes ?? '—'}</Text>
      <Text>Cover URL: {item.coverImageUrl ?? '—'}</Text>
      <Text>Added: {item.dateAdded}</Text>
      <LibraryStatusControl media={item} libraryItem={item} onLibraryItemChange={setItem} />

      <Link href={{ pathname: '/form', params: { id: String(item.id) } }} asChild>
        <Pressable>
          <Text>Edit item</Text>
        </Pressable>
      </Link>

      <Pressable onPress={handleDelete}>
        <Text>Delete item</Text>
      </Pressable>
    </ScreenScrollView>
  );
}
