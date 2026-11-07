import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { UserRow } from '@/components/social';
import { Screen, Text, TextInput } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { normalizeUsername, searchUsers, type UserSummary } from '@/lib/social';
import { useFollowToggle } from '@/lib/use-follow-toggle';

const SEARCH_DEBOUNCE_MS = 250;

export default function PeopleScreen() {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { busyIds, toggleFollow } = useFollowToggle(setResults, setError);
  const normalized = normalizeUsername(query);

  useEffect(() => {
    if (!normalized) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchUsers(normalized)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
            setError(null);
          }
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setError(searchError instanceof Error ? searchError.message : 'Search failed');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized]);

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 8, gap: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by @username"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          style={{ borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
        />
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      </View>
      <FlatList
        data={results}
        keyExtractor={(user) => user.userId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <UserRow user={item} busy={busyIds.has(item.userId)} onToggleFollow={toggleFollow} />
        )}
        ListEmptyComponent={
          searching ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={colors.text} />
          ) : (
            <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>
              {normalized ? `No one matches @${normalized}.` : 'Find people by their username.'}
            </Text>
          )
        }
      />
    </Screen>
  );
}
