import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MediaRow } from '@/components/media-cover';
import { useMediaSearch } from '@/components/media-search';
import { NotesModal } from '@/components/notes-modal';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { getItems, ITEM_STATUSES, updateItem, type Item, type ItemStatus } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';
import { libraryCountLabel, STATUS_LABELS } from '@/lib/status-labels';

export default function LibraryScreen() {
  const { query } = useMediaSearch();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<ItemStatus, boolean>>>({});
  const [notesItem, setNotesItem] = useState<Item | null>(null);

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
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 4,
                        paddingVertical: 2,
                        gap: 4,
                      }}>
                      <Link
                        href={{ pathname: '/item/[id]', params: { id: String(item.id) } }}
                        asChild>
                        <Pressable style={{ flex: 1 }}>
                          <MediaRow
                            title={item.title}
                            subtitle={libraryCountLabel(item.mediaType, {
                              mangaOrigin: item.mangaOrigin,
                              currentEpisodes: item.currentEpisodes,
                              totalEpisodes: item.totalEpisodes,
                              currentPages: item.currentPages,
                              totalPages: item.totalPages,
                              currentChapters: item.currentChapters,
                              totalChapters: item.totalChapters,
                            })}
                            rating={item.rating}
                            coverImageUrl={item.coverImageUrl}
                          />
                        </Pressable>
                      </Link>
                      {item.notes?.trim() ? (
                        <Pressable
                          onPress={() => setNotesItem(item)}
                          hitSlop={8}
                          style={{ padding: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Open notes">
                          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                : null}
            </View>
          );
        })
      )}

      <NotesModal
        visible={notesItem != null}
        title={notesItem?.title ?? ''}
        notes={notesItem?.notes ?? ''}
        onClose={() => setNotesItem(null)}
        onSave={async (notes) => {
          if (!notesItem) {
            return;
          }

          const saved = await updateItem(notesItem.id, { notes: notes || null });
          if (!saved) {
            throw new Error('Failed to save notes');
          }

          setItems((current) => current.map((item) => (item.id === saved.id ? saved : item)));
          setNotesItem(saved.notes?.trim() ? saved : null);
        }}
      />
    </ScreenScrollView>
  );
}
