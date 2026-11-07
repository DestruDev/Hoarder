import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { MediaPoster, MediaPosterGrid, MediaRow, usePosterSize } from '@/components/media-cover';
import { LibrarySearchHeader, useMediaQuery } from '@/components/media-search';
import { NotesModal } from '@/components/notes-modal';
import { useSyncRefreshControl } from '@/components/sync-refresh-control';
import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import {
  getCatalogItems,
  getItems,
  ITEM_STATUSES,
  peekCatalogItems,
  updateItem,
  type CatalogItem,
  type Item,
  type ItemStatus,
} from '@/lib/db';
import {
  matchesGenreFilter,
  matchesMediaName,
  matchesMediaTypeFilter,
  matchesReleaseFilter,
  matchesStatusFilter,
  matchesDateRules,
  releaseDateOf,
} from '@/lib/media-search';
import { catalogKey, sortEntries } from '@/lib/media-sort';

function indexCatalog(rows: CatalogItem[]): Map<string, CatalogItem> {
  return new Map(rows.map((row) => [catalogKey(row), row]));
}
import { libraryCountLabel, STATUS_LABELS } from '@/lib/status-labels';
import { useDataVersion } from '@/lib/sync';

export default function LibraryScreen() {
  const colors = useColors();
  const { query, browse } = useMediaQuery();
  const { filter, sort, statusFilter, releaseFilter, genreFilter, dateRules } = browse.library;
  const { libraryView, libraryExpanded } = useAppSettings();
  const { posterWidth, posterHeight } = usePosterSize();
  const [items, setItems] = useState<Item[]>([]);
  const [catalogByKey, setCatalogByKey] = useState<Map<string, CatalogItem>>(() =>
    indexCatalog(peekCatalogItems() ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<ItemStatus, boolean>>>({});
  const [notesItem, setNotesItem] = useState<Item | null>(null);

  // Reload on every write, even while hidden behind a pushed screen. Focus fires
  // only after the back animation ends, so reloading then shows stale rows first.
  const dataVersion = useDataVersion();
  const refreshControl = useSyncRefreshControl();
  useEffect(() => {
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
  }, [dataVersion]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getCatalogItems()
        .then((catalogRows) => {
          if (!cancelled) {
            setCatalogByKey(indexCatalog(catalogRows));
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

  const visibleItems = items.filter(
    (item) =>
      matchesMediaName(item.title, query) &&
      matchesMediaTypeFilter(item, filter) &&
      matchesStatusFilter(item.status, statusFilter) &&
      matchesReleaseFilter(
        catalogByKey.get(catalogKey(item))?.releaseStatus ?? item.releaseStatus,
        releaseFilter,
      ) &&
      matchesGenreFilter(catalogByKey.get(catalogKey(item))?.genres, genreFilter) &&
      matchesDateRules(releaseDateOf(catalogByKey.get(catalogKey(item)) ?? {}), dateRules),
  );
  const isSearching = query.trim().length > 0;

  const sortedItems = sortEntries(visibleItems, sort, (item) => ({
    title: item.title,
    library: item,
    catalog: catalogByKey.get(catalogKey(item)),
  }));

  const groups = ITEM_STATUSES.map((status) => ({
    status,
    items: sortedItems.filter((item) => item.status === status),
  })).filter((group) => group.items.length > 0);

  // Sections start from the user's default; taps override it for this session.
  function isExpanded(status: ItemStatus) {
    return expanded[status] ?? libraryExpanded.includes(status);
  }

  function toggleStatus(status: ItemStatus) {
    setExpanded((current) => ({
      ...current,
      [status]: !isExpanded(status),
    }));
  }

  function renderItem(item: Item) {
    const notesButton = item.notes?.trim() ? (
      <Pressable
        onPress={() => setNotesItem(item)}
        hitSlop={8}
        style={
          libraryView === 'card'
            ? {
                position: 'absolute',
                top: 8,
                right: 4,
                padding: 6,
                borderRadius: 999,
                backgroundColor: colors.imageBadgeBackground,
              }
            : { padding: 8 }
        }
        accessibilityRole="button"
        accessibilityLabel="Open notes">
        <Ionicons
          name="chatbubble-outline"
          size={libraryView === 'card' ? 16 : 18}
          color={libraryView === 'card' ? colors.imageBadgeIcon : colors.textMuted}
        />
      </Pressable>
    ) : null;

    if (libraryView === 'card') {
      return (
        <View key={item.id} style={{ width: posterWidth }}>
          <Link href={{ pathname: '/item/[id]', params: { id: String(item.id), title: item.title } }} asChild>
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
        <Link href={{ pathname: '/item/[id]', params: { id: String(item.id), title: item.title } }} asChild>
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
    <Screen>
      <LibrarySearchHeader />
      <ScreenScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          // Fill the screen even when the list is short, so pull-to-refresh
          // works from anywhere, not just over the content.
          flexGrow: 1,
          ...(items.length === 0 ? { justifyContent: 'center' } : null),
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
            open={isSearching || isExpanded(group.status)}
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
    </Screen>
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
  const colors = useColors();
  const highlight = useRef(new Animated.Value(0)).current;
  // Start at the initial state so sections that mount open don't animate in.
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
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
            backgroundColor: colors.text,
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
