import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MediaCover } from '@/components/media-cover';
import { FeedHeader, useMediaSearch } from '@/components/media-search';
import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  getCatalogItems,
  getFeedNotifications,
  toggleFeedLike,
  type CatalogItem,
  type FeedNotification,
} from '@/lib/db';
import { matchesFeedFilter } from '@/lib/media-search';

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

export default function FeedScreen() {
  const { feedFilter } = useMediaSearch();
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

  const notifications = [...feedItems]
    .filter((item) => matchesFeedFilter(item, feedFilter))
    .sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );

  async function handleToggleLike(id: number) {
    const previous = feedItems;
    setFeedItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const liked = !item.liked;
        return {
          ...item,
          liked,
          likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
        };
      }),
    );

    try {
      const updated = await toggleFeedLike(id);
      if (updated) {
        setFeedItems((current) => current.map((item) => (item.id === id ? updated : item)));
      }
    } catch {
      setFeedItems(previous);
    }
  }

  return (
    <Screen>
      <FeedHeader />
      <ScreenScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {notifications.length === 0 ? (
          <Text style={{ paddingVertical: 12 }}>
            {feedItems.length === 0
              ? 'No updates yet. Replace & seed the feed from Settings → Debug.'
              : 'No matching updates.'}
          </Text>
        ) : (
          notifications.map((notification) => {
            const catalogItem = catalogById.get(notification.catalogId);
            const likeCount =
              notification.liked && notification.likeCount < 1 ? 1 : notification.likeCount;
            const content = (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <MediaCover uri={catalogItem?.coverImageUrl} width={48} height={68} />
                <View style={{ flex: 1 }}>
                  <Text>{notification.title}</Text>
                  <Text>{notification.body}</Text>
                </View>
              </View>
            );

            return (
              <View
                key={notification.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 4,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}>
                {catalogItem ? (
                  <Link
                    href={{ pathname: '/catalog/[id]', params: { id: String(catalogItem.id) } }}
                    asChild>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={notification.title}
                      style={{ flex: 1 }}>
                      {content}
                    </Pressable>
                  </Link>
                ) : (
                  content
                )}
                <View
                  style={{
                    width: 72,
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    alignSelf: 'stretch',
                    minHeight: 68,
                  }}>
                  <Text style={{ color: colors.textMuted }}>{timeAgo(notification.occurredAt)}</Text>
                  <Pressable
                    onPress={() => handleToggleLike(notification.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={notification.liked ? 'Unlike' : 'Like'}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      alignSelf: 'stretch',
                      height: 32,
                    }}>
                    {likeCount > 0 ? (
                      <Text
                        style={{
                          color: notification.liked ? colors.danger : colors.textMuted,
                          marginRight: 2,
                        }}>
                        {likeCount}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        width: 22,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons
                        name={notification.liked ? 'heart' : 'heart-outline'}
                        size={22}
                        color={notification.liked ? colors.danger : colors.textMuted}
                      />
                    </View>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScreenScrollView>
    </Screen>
  );
}
