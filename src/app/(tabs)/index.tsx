import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { FeedHeader, useMediaQuery } from '@/components/media-search';
import { ActivityRow } from '@/components/social';
import { Screen, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { feedScopeFor } from '@/lib/media-search';
import { syncNow, usePushVersion } from '@/lib/sync';
import { useActivityFeed } from '@/lib/use-activity-feed';

const EMPTY_MESSAGES = {
  all: 'Nothing here yet. Follow people to see what they add, finish and drop, or update your library.',
  your: 'Your activity shows up here when you add, complete, drop or plan to start something.',
  following: "No activity from people you follow yet.",
};

export default function FeedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { feedFilter } = useMediaQuery();
  const scope = feedScopeFor(feedFilter);

  const feed = useActivityFeed({
    author: scope === 'your' ? userId ?? undefined : undefined,
    followingOnly: scope === 'following',
  });
  const { refresh } = feed;

  // Push pending library edits first so your own new activity is in the result.
  const refreshWithSync = useCallback(
    () => refresh(userId ? () => syncNow(userId) : undefined),
    [refresh, userId],
  );

  // Focus refreshes run silently; the pull-to-refresh spinner is only for a
  // user's pull, so it never shifts the list on its own.
  useFocusEffect(
    useCallback(() => {
      void refreshWithSync();
    }, [refreshWithSync]),
  );

  // Your library edits reach the server a couple of seconds after you make them
  // (sync is debounced). Refetch in the background once they do, so a status
  // change shows up here without revisiting the tab. Tabs stay mounted, so this
  // runs while you're on Library or an item screen too.
  const pushVersion = usePushVersion();
  const seenPushVersion = useRef(pushVersion);
  useEffect(() => {
    if (pushVersion !== seenPushVersion.current) {
      seenPushVersion.current = pushVersion;
      void refresh();
    }
  }, [pushVersion, refresh]);

  const [pulling, setPulling] = useState(false);
  const handlePull = useCallback(async () => {
    setPulling(true);
    try {
      await refreshWithSync();
    } finally {
      setPulling(false);
    }
  }, [refreshWithSync]);

  const findPeople = () => router.push('/people');

  return (
    <Screen>
      <FeedHeader onFindPeople={findPeople} />
      {!feed.loaded ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={feed.activities}
          keyExtractor={(activity) => String(activity.id)}
          renderItem={({ item }) => (
            <ActivityRow activity={item} onToggleLike={feed.toggleLike} onDelete={feed.removeActivity} />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={handlePull} tintColor={colors.text} />
          }
          onEndReached={() => void feed.loadMore()}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            feed.error ? (
              <Text style={{ color: colors.danger, paddingVertical: 12 }}>{feed.error}</Text>
            ) : null
          }
          ListFooterComponent={
            feed.loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.text} /> : null
          }
          ListEmptyComponent={
            feed.error ? null : (
              <View style={{ paddingVertical: 24, gap: 16, alignItems: 'flex-start' }}>
                <Text style={{ color: colors.textMuted }}>{EMPTY_MESSAGES[scope]}</Text>
                {scope !== 'your' ? (
                  <Pressable
                    onPress={findPeople}
                    accessibilityRole="button"
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: colors.accent,
                    }}>
                    <Text style={{ color: colors.onAccent, fontWeight: '600' }}>Find people</Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}
