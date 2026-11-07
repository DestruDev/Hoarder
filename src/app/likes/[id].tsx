import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { UserRow } from '@/components/social';
import { Screen, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { getActivityLikers, type UserSummary } from '@/lib/social';
import { useFollowToggle } from '@/lib/use-follow-toggle';

export default function LikesScreen() {
  const colors = useColors();
  const { session } = useAuth();
  const myId = session?.user.id ?? null;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { busyIds, toggleFollow } = useFollowToggle(setUsers, setError);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getActivityLikers(Number(id))
        .then((rows) => {
          if (!cancelled) {
            setUsers(rows);
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load likes');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoaded(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (!loaded) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.text} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={users}
        keyExtractor={(user) => user.userId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        ListHeaderComponent={
          error ? <Text style={{ color: colors.danger, paddingVertical: 12 }}>{error}</Text> : <View style={{ height: 8 }} />
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            busy={busyIds.has(item.userId)}
            onToggleFollow={toggleFollow}
            showFollow={item.userId !== myId}
          />
        )}
        ListEmptyComponent={
          error ? null : <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>No likes yet.</Text>
        }
      />
    </Screen>
  );
}
