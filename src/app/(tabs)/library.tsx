import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaSearch } from '@/components/media-search';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { getItems, ITEM_STATUSES, type Item, type ItemStatus } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';

const STATUS_LABELS: Record<ItemStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
};

export default function LibraryScreen() {
  const { query } = useMediaSearch();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<ItemStatus, boolean>>>({});

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
  const isSearching = query.trim().length > 0;

  const groups = ITEM_STATUSES.map((status) => ({
    status,
    items: visibleItems.filter((item) => item.status === status),
  })).filter((group) => group.items.length > 0);

  function toggleStatus(status: ItemStatus) {
    setExpanded((current) => ({
      ...current,
      [status]: !current[status],
    }));
  }

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
        groups.map((group) => {
          const isOpen = isSearching || Boolean(expanded[group.status]);

          return (
            <View key={group.status} style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (!isSearching) {
                    toggleStatus(group.status);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.searchBarBackground,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}>
                <Text style={{ flex: 1 }}>{STATUS_LABELS[group.status]}</Text>
                <Text style={{ color: colors.textMuted, marginRight: 8 }}>{group.items.length}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={colors.text}
                />
              </Pressable>

              {isOpen
                ? group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={{ pathname: '/item/[id]', params: { id: String(item.id) } }}
                      asChild>
                      <Pressable style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                        <View>
                          <Text>{item.title}</Text>
                          <Text style={{ color: colors.textMuted }}>
                            {item.mediaType}
                            {item.rating != null ? ` · ${item.rating}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    </Link>
                  ))
                : null}
            </View>
          );
        })
      )}
    </ScreenScrollView>
  );
}
