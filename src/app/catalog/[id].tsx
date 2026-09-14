import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  addCatalogItemToLibrary,
  findItemByTitleAndType,
  getCatalogItemById,
  type CatalogItem,
  type Item,
} from '@/lib/db';

export default function CatalogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);

  const [item, setItem] = useState<CatalogItem | undefined>();
  const [libraryItem, setLibraryItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function handleAddToLibrary() {
    if (!item || adding || libraryItem) {
      return;
    }

    setAdding(true);
    setActionError(null);

    try {
      const created = await addCatalogItemToLibrary(item);
      setLibraryItem(created);
    } catch (addError: unknown) {
      setActionError(addError instanceof Error ? addError.message : 'Failed to add to library');
    } finally {
      setAdding(false);
    }
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

      {libraryItem ? (
        <Link href={{ pathname: '/item/[id]', params: { id: String(libraryItem.id) } }} asChild>
          <Pressable
            style={{
              marginTop: 8,
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              alignItems: 'center',
            }}>
            <Text>In library</Text>
          </Pressable>
        </Link>
      ) : (
        <Pressable
          onPress={handleAddToLibrary}
          disabled={adding}
          style={{
            marginTop: 8,
            backgroundColor: colors.searchBarBackground,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: adding ? 0.6 : 1,
          }}>
          <Text>{adding ? 'Adding…' : 'Add to library'}</Text>
        </Pressable>
      )}

      {actionError ? <Text>{actionError}</Text> : null}
    </ScreenScrollView>
  );
}
