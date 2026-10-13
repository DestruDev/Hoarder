import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaCover } from '@/components/media-cover';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { MEDIA_TYPES, type MediaType } from '@/lib/db';
import { MEDIA_TYPE_LABELS } from '@/lib/status-labels';

type FeedKind = 'media' | 'friend';
type FeedFilter = MediaType | 'friend' | null;

const PLACEHOLDER_NOTIFICATIONS: {
  id: string;
  title: string;
  body: string;
  mediaType: MediaType;
  kind: FeedKind;
}[] = [
  {
    id: '1',
    title: 'New episode available',
    body: 'Frieren: Beyond Journey’s End — Episode 28 is out.',
    mediaType: 'anime',
    kind: 'media',
  },
  {
    id: '2',
    title: 'New chapter available',
    body: 'One Piece — Chapter 1128 is out.',
    mediaType: 'comic',
    kind: 'media',
  },
  {
    id: '3',
    title: 'Release reminder',
    body: 'Dune: Part Three has a new trailer.',
    mediaType: 'movie',
    kind: 'media',
  },
  {
    id: '4',
    title: 'Game update',
    body: 'Hades II left early access.',
    mediaType: 'game',
    kind: 'media',
  },
  {
    id: '5',
    title: 'Book update',
    body: 'The next Stormlight Archive novel has a release date.',
    mediaType: 'book',
    kind: 'media',
  },
  {
    id: '6',
    title: 'Friend activity',
    body: 'Alex completed Frieren: Beyond Journey’s End.',
    mediaType: 'anime',
    kind: 'friend',
  },
  {
    id: '7',
    title: 'Friend activity',
    body: 'Sam started One Piece.',
    mediaType: 'comic',
    kind: 'friend',
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

  const notifications = useMemo(() => {
    if (!feedFilter) {
      return PLACEHOLDER_NOTIFICATIONS;
    }

    if (feedFilter === 'friend') {
      return PLACEHOLDER_NOTIFICATIONS.filter((item) => item.kind === 'friend');
    }

    return PLACEHOLDER_NOTIFICATIONS.filter(
      (item) => item.kind === 'media' && item.mediaType === feedFilter,
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
          notifications.map((notification) => (
            <View
              key={notification.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
              <MediaCover width={48} height={68} />
              <View style={{ flex: 1 }}>
                <Text>{notification.title}</Text>
                <Text>{notification.body}</Text>
              </View>
            </View>
          ))
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
