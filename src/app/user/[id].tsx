import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ActivityRow, FollowButton, FollowCounts } from '@/components/social';
import { Screen, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { displayNameFor, getPublicProfile, setFollowing, type PublicProfile } from '@/lib/social';
import { useActivityFeed } from '@/lib/use-activity-feed';

export default function UserScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const isSelf = session?.user.id === id;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const feed = useActivityFeed({ author: id });
  const { refresh } = feed;

  const load = useCallback(async () => {
    try {
      setProfile(await getPublicProfile(id));
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
    }
    await refresh();
  }, [id, refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleFollow() {
    if (!profile) {
      return;
    }

    const following = !profile.isFollowing;
    setFollowBusy(true);
    try {
      await setFollowing(profile.userId, following);
      setProfile({
        ...profile,
        isFollowing: following,
        followerCount: Math.max(0, profile.followerCount + (following ? 1 : -1)),
      });
      setError(null);
      // What we're allowed to see just changed.
      await refresh();
    } catch (followError: unknown) {
      setError(followError instanceof Error ? followError.message : 'Failed to update follow');
    } finally {
      setFollowBusy(false);
    }
  }

  const title = profile ? displayNameFor(profile) : 'Profile';
  const canSeeActivity = isSelf || profile?.isFollowing === true;

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={canSeeActivity ? feed.activities : []}
        keyExtractor={(activity) => String(activity.id)}
        renderItem={({ item }) => (
          <ActivityRow
            activity={item}
            onToggleLike={feed.toggleLike}
            onDelete={feed.removeActivity}
            showAuthor={false}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={feed.refreshing && feed.loaded} onRefresh={load} tintColor={colors.text} />
        }
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
            {!profile && !error ? <ActivityIndicator color={colors.text} /> : null}
            {profile ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <ProfileAvatar uri={profile.avatarUrl} size={64} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600' }} numberOfLines={1}>
                      {profile.displayName ?? (profile.username ? `@${profile.username}` : 'No name yet')}
                    </Text>
                    {profile.displayName && profile.username ? (
                      <Text style={{ color: colors.textMuted }}>@{profile.username}</Text>
                    ) : null}
                  </View>
                  {isSelf ? null : (
                    <FollowButton following={profile.isFollowing} busy={followBusy} onPress={toggleFollow} />
                  )}
                </View>
                {profile.description ? <Text>{profile.description}</Text> : null}
                <FollowCounts
                  userId={profile.userId}
                  name={displayNameFor(profile)}
                  followerCount={profile.followerCount}
                  followingCount={profile.followingCount}
                />
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          profile ? (
            <Text style={{ color: colors.textMuted, paddingVertical: 16 }}>
              {canSeeActivity
                ? feed.loaded
                  ? 'No activity yet.'
                  : ''
                : `Follow ${displayNameFor(profile)} to see their activity.`}
            </Text>
          ) : null
        }
        ListFooterComponent={
          feed.loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.text} /> : null
        }
      />
    </Screen>
  );
}
