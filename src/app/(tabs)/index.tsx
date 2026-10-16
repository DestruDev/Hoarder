import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaCover } from '@/components/media-cover';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  getCatalogItems,
  getFeedNotifications,
  MEDIA_TYPES,
  type CatalogItem,
  type FeedNotification,
  type MediaType,
} from '@/lib/db';
import { MEDIA_TYPE_LABELS } from '@/lib/status-labels';

type FeedFilter = MediaType | 'friend' | null;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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
  const [feedItems, setFeedItems] = useState<FeedNotification[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      Promise.all([getCatalogItems(), getFeedNotifications()])
        .then(([catalogRows, feedRows]) => {
          if (!cancelled) {
            setCatalogItems(catalogRows);
            setFeedItems(feedRows);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCatalogItems([]);
            setFeedItems([]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const catalogById = useMemo(() => {
    const map = new Map<number, CatalogItem>();
    for (const item of catalogItems) {
      map.set(item.id, item);
    }
    return map;
  }, [catalogItems]);

  const notifications = useMemo(() => {
    const visible = !feedFilter
      ? feedItems
      : feedFilter === 'friend'
        ? feedItems.filter((item) => item.kind === 'friend')
        : feedItems.filter((item) => item.kind === 'media' && item.mediaType === feedFilter);

    return [...visible].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }, [feedFilter, feedItems]);

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
          <Text style={{ paddingVertical: 12 }}>
            {feedItems.length === 0
              ? 'No updates yet. Replace & seed the feed from Settings.'
              : 'No matching updates.'}
          </Text>
        ) : (
          notifications.map((notification) => {
            const catalogItem = catalogById.get(notification.catalogId);
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
