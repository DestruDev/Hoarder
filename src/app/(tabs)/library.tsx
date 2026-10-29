import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { MediaPoster, MediaPosterGrid, MediaRow, usePosterSize } from '@/components/media-cover';
import { useMediaSearch } from '@/components/media-search';
import { NotesModal } from '@/components/notes-modal';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { getItems, ITEM_STATUSES, updateItem, type Item, type ItemStatus } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';
import { libraryCountLabel, STATUS_LABELS } from '@/lib/status-labels';

export default function LibraryScreen() {
  const { query } = useMediaSearch();
  const { libraryView } = useAppSettings();
  const { posterWidth, posterHeight } = usePosterSize();
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

  function renderItem(item: Item) {
    const notesButton = item.notes?.trim() ? (
      <Pressable
        onPress={() => setNotesItem(item)}
        hitSlop={8}
        style={{
          padding: 8,
          ...(libraryView === 'card'
            ? { position: 'absolute', top: 4, right: 0 }
            : null),
        }}
        accessibilityRole="button"
        accessibilityLabel="Open notes">
        <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
      </Pressable>
    ) : null;

    if (libraryView === 'card') {
      return (
        <View key={item.id} style={{ width: posterWidth }}>
          <Link href={{ pathname: '/item/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable>
              <MediaPoster
                title={item.title}
                coverImageUrl={item.coverImageUrl}
                rating={item.rating}
                width={posterWidth}
                height={posterHeight}
              />
            </Pressable>
          </Link>
          {notesButton}
        </View>
      );
    }

    return (
      <View
        key={item.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 4,
          paddingVertical: 2,
          gap: 4,
        }}>
        <Link href={{ pathname: '/item/[id]', params: { id: String(item.id) } }} asChild>
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
                completed: item.status === 'completed',
              })}
              rating={item.rating}
              coverImageUrl={item.coverImageUrl}
            />
          </Pressable>
        </Link>
        {notesButton}
      </View>
    );
  }

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        ...(items.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : null),
      }}>
      {error ? <Text>{error}</Text> : null}

      {items.length === 0 ? (
        <Text style={{ textAlign: 'center' }}>
          Nothing's in your library currently! Try adding entries from the explore tab!
        </Text>
      ) : visibleItems.length === 0 ? (
        <Text>No matching titles.</Text>
      ) : (
        groups.map((group) => (
          <LibraryStatusGroup
            key={group.status}
            title={STATUS_LABELS[group.status]}
            count={group.items.length}
            open={isSearching || Boolean(expanded[group.status])}
            canToggle={!isSearching}
            onToggle={() => toggleStatus(group.status)}>
            {libraryView === 'card' ? (
              <MediaPosterGrid>{group.items.map(renderItem)}</MediaPosterGrid>
            ) : (
              group.items.map(renderItem)
            )}
          </LibraryStatusGroup>
        ))
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

function LibraryStatusGroup({
  title,
  count,
  open,
  canToggle,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  canToggle: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const highlight = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(open);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (open) {
      setShown(true);
      if (contentHeight === 0) {
        return () => {
          cancelled = true;
        };
      }

      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return () => {
        cancelled = true;
      };
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !cancelled) {
        setShown(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [contentHeight, open, progress]);

  function flash() {
    if (!canToggle) {
      return;
    }

    highlight.stopAnimation();
    highlight.setValue(0);
    Animated.sequence([
      Animated.timing(highlight, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(highlight, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }

  return (
    <View>
      <Pressable
        onPress={canToggle ? onToggle : undefined}
        onPressIn={flash}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.searchBarBackground,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          overflow: 'hidden',
        }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#ffffff',
            opacity: highlight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.07],
            }),
          }}
        />
        <Text style={{ flex: 1 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, marginRight: 8 }}>{count}</Text>
        <Animated.View
          style={{
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                }),
              },
            ],
          }}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Animated.View>
      </Pressable>

      {shown ? (
        <Animated.View
          style={{
            height: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, Math.max(contentHeight, 1)],
            }),
            opacity: progress,
            overflow: 'hidden',
          }}>
          <View
            style={{ position: 'absolute', top: 0, right: 0, left: 0, paddingTop: 8 }}
            onLayout={(event) => {
              const nextHeight = Math.round(event.nativeEvent.layout.height);
              if (nextHeight > 0 && nextHeight !== contentHeight) {
                setContentHeight(nextHeight);
              }
            }}>
            {children}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
