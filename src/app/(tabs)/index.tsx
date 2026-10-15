import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaCover } from '@/components/media-cover';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { getCatalogItems, MEDIA_TYPES, type CatalogItem, type MediaType } from '@/lib/db';
import { MEDIA_TYPE_LABELS } from '@/lib/status-labels';

type FeedKind = 'media' | 'friend';
type FeedFilter = MediaType | 'friend' | null;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

function timeAgo(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());

  if (elapsed < MINUTE) {
    return 'just now';
  }

  if (elapsed < HOUR) {
    return `${Math.round(elapsed / MINUTE)}m ago`;
  }

  if (elapsed < DAY) {
    return `${Math.round(elapsed / HOUR)}h ago`;
  }

  const days = Math.round(elapsed / DAY);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  return new Date(iso).toLocaleDateString();
}

const PLACEHOLDER_NOTIFICATIONS: {
  id: string;
  title: string;
  body: string;
  mediaTitle: string;
  mediaType: MediaType;
  kind: FeedKind;
  occurredAt: string;
}[] = [
  {
    id: '1',
    title: 'New episode available',
    body: "Frieren: Beyond Journey's End — Episode 28 is out.",
    mediaTitle: "Frieren: Beyond Journey's End",
    mediaType: 'anime',
    kind: 'media',
    occurredAt: hoursAgo(0.4),
  },
  {
    id: '2',
    title: 'New chapter available',
    body: 'One Piece — Chapter 1128 is out.',
    mediaTitle: 'One Piece',
    mediaType: 'comic',
    kind: 'media',
    occurredAt: hoursAgo(2),
  },
  {
    id: '3',
    title: 'Release reminder',
    body: 'Dune: Part Two has a new trailer.',
    mediaTitle: 'Dune: Part Two',
    mediaType: 'movie',
    kind: 'media',
    occurredAt: hoursAgo(5),
  },
  {
    id: '4',
    title: 'Game update',
    body: 'Hades II left early access.',
    mediaTitle: 'Hades II',
    mediaType: 'game',
    kind: 'media',
    occurredAt: hoursAgo(26),
  },
  {
    id: '5',
    title: 'Book update',
    body: 'The next Stormlight Archive novel has a release date.',
    mediaTitle: 'The Way of Kings',
    mediaType: 'book',
    kind: 'media',
    occurredAt: hoursAgo(72),
  },
  {
    id: '6',
    title: 'Friend activity',
    body: "Alex completed Frieren: Beyond Journey's End.",
    mediaTitle: "Frieren: Beyond Journey's End",
    mediaType: 'anime',
    kind: 'friend',
    occurredAt: hoursAgo(6),
  },
  {
    id: '7',
    title: 'Friend activity',
    body: 'Sam started One Piece.',
    mediaTitle: 'One Piece',
    mediaType: 'comic',
    kind: 'friend',
    occurredAt: hoursAgo(48),
  },
];

const FILTER_OPTIONS: { value: FeedFilter; label: string }[] = [
  { value: null, label: 'All' },
  ...MEDIA_TYPES.map((type) => ({ value: type, label: MEDIA_TYPE_LABELS[type] })),
  { value: 'friend', label: 'Friend activity' },
];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [filterOpen, setFilterOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getCatalogItems()
        .then((rows) => {
          if (!cancelled) {
            setCatalogItems(rows);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCatalogItems([]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const catalogByKey = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalogItems) {
      map.set(`${item.mediaType}:${item.title}`, item);
    }
    return map;
  }, [catalogItems]);

  const notifications = useMemo(() => {
    const visible = !feedFilter
      ? PLACEHOLDER_NOTIFICATIONS
      : feedFilter === 'friend'
        ? PLACEHOLDER_NOTIFICATIONS.filter((item) => item.kind === 'friend')
        : PLACEHOLDER_NOTIFICATIONS.filter(
            (item) => item.kind === 'media' && item.mediaType === feedFilter,
          );

    return [...visible].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }, [feedFilter]);

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => setFilterOpen(true)}
              hitSlop={8}
              accessibilityLabel="Filter feed"
              style={{
                width: 44,
                height: 44,
                marginRight: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons
                name={feedFilter ? 'funnel' : 'funnel-outline'}
                size={22}
                color={colors.text}
              />
            </Pressable>
          ),
        }}
      />

      <ScreenScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {notifications.length === 0 ? (
          <Text style={{ paddingVertical: 12 }}>No matching updates.</Text>
        ) : (
          notifications.map((notification) => {
            const catalogItem = catalogByKey.get(
              `${notification.mediaType}:${notification.mediaTitle}`,
            );
            const row = (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}>
                <MediaCover uri={catalogItem?.coverImageUrl} width={48} height={68} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ flex: 1 }}>{notification.title}</Text>
                    <Text style={{ color: colors.textMuted }}>{timeAgo(notification.occurredAt)}</Text>
                  </View>
                  <Text>{notification.body}</Text>
                </View>
              </View>
            );

            if (!catalogItem) {
              return <View key={notification.id}>{row}</View>;
            }

            return (
              <Link
                key={notification.id}
                href={{ pathname: '/catalog/[id]', params: { id: String(catalogItem.id) } }}
                asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={notification.title}>
                  {row}
                </Pressable>
              </Link>
            );
          })
        )}
      </ScreenScrollView>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => setFilterOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: insets.top + 44,
              right: 12,
              minWidth: 168,
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
            {FILTER_OPTIONS.map((option) => {
              const isSelected = feedFilter === option.value;

              return (
                <Pressable
                  key={option.label}
                  onPress={() => {
                    setFeedFilter(option.value);
                    setFilterOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopWidth: option.value === 'friend' ? 1 : 0,
                    borderTopColor: colors.border,
                  }}>
                  <Text style={{ flex: 1 }}>{option.label}</Text>
                  {isSelected ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}
