import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { UserRow } from '@/components/social';
import { Screen, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { getFollowList, type FollowList, type UserSummary } from '@/lib/social';
import { useFollowToggle } from '@/lib/use-follow-toggle';

const LISTS: { value: FollowList; label: string }[] = [
  { value: 'followers', label: 'Followers' },
  { value: 'following', label: 'Following' },
];

export default function FollowsScreen() {
  const colors = useColors();
  const { session } = useAuth();
  const myId = session?.user.id ?? null;
  const params = useLocalSearchParams<{ id: string; list?: string; name?: string }>();
  const userId = params.id;
  const isSelf = myId === userId;
  const [list, setList] = useState<FollowList>(params.list === 'following' ? 'following' : 'followers');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadedList, setLoadedList] = useState<FollowList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busyIds, toggleFollow } = useFollowToggle(setUsers, setError);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getFollowList(userId, list)
        .then((rows) => {
          if (!cancelled) {
            setUsers(rows);
            setLoadedList(list);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setLoadedList(list);
            setError(loadError instanceof Error ? loadError.message : 'Failed to load list');
          }
        });

      return () => {
        cancelled = true;
      };
    }, [list, userId]),
  );

  const loading = loadedList !== list;
  const emptyMessage =
    list === 'followers'
      ? 'No followers yet.'
      : isSelf
        ? "You're not following anyone yet."
        : 'Not following anyone yet.';

  return (
    <Screen>
      <Stack.Screen options={{ title: params.name || (isSelf ? 'You' : 'Profile') }} />
      <View
        style={{
          flexDirection: 'row',
          margin: 16,
          marginBottom: 8,
          padding: 3,
          borderRadius: 10,
          backgroundColor: colors.surface,
        }}>
        {LISTS.map((option) => {
          const selected = option.value === list;
          return (
            <Pressable
              key={option.value}
              onPress={() => setList(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.background : 'transparent',
              }}>
              <Text style={{ fontWeight: selected ? '600' : '400', color: selected ? colors.text : colors.textMuted }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={{ color: colors.danger, paddingHorizontal: 16 }}>{error}</Text> : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(user) => user.userId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              busy={busyIds.has(item.userId)}
              onToggleFollow={toggleFollow}
              showFollow={item.userId !== myId}
            />
          )}
          ListEmptyComponent={
            error ? null : (
              <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>{emptyMessage}</Text>
            )
          }
        />
      )}
    </Screen>
  );
}
