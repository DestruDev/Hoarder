import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { deleteItem, getItemById, type Item } from '@/lib/db';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);

  const [item, setItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(itemId)) {
      setError('Invalid item id');
      setLoaded(true);
      return;
    }

    getItemById(itemId)
      .then((row) => {
        setItem(row);
        setLoaded(true);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load item');
        setLoaded(true);
      });
  }, [itemId]);

  async function handleDelete() {
    await deleteItem(itemId);
    router.back();
  }

  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <Text>{error}</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Item not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Stack.Screen options={{ title: item.title }} />
      <Text>Title: {item.title}</Text>
      <Text>Type: {item.mediaType}</Text>
      <Text>Status: {item.status}</Text>
      <Text>Rating: {item.rating ?? '—'}</Text>
      <Text>Notes: {item.notes ?? '—'}</Text>
      <Text>Cover URL: {item.coverImageUrl ?? '—'}</Text>
      <Text>Added: {item.dateAdded}</Text>

      <Link href={{ pathname: '/form', params: { id: String(item.id) } }} asChild>
        <Pressable>
          <Text>Edit item</Text>
        </Pressable>
      </Link>

      <Pressable onPress={handleDelete}>
        <Text>Delete item</Text>
      </Pressable>
    </ScrollView>
  );
}
