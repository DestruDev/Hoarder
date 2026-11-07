import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { SettingsSearchHeader, useMediaQuery } from '@/components/media-search';
import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { matchesSearchText } from '@/lib/media-search';
import { getPublicProfile } from '@/lib/social';

type SettingItem = {
  id: string;
  title: string;
  // Shown muted on the right, e.g. the current value.
  detail?: string;
  // Extra words the settings search should match.
  keywords?: string;
  onPress: () => void;
};

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { query } = useMediaQuery();
  const { session, signOut } = useAuth();
  const userId = session?.user.id ?? null;
  const [username, setUsername] = useState<string | null>(null);

  // Refetched on focus so a username change made on the Account screen shows on return.
  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        return;
      }
      let cancelled = false;
      getPublicProfile(userId)
        .then((profile) => {
          if (!cancelled) {
            setUsername(profile.username);
          }
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const settings: SettingItem[] = [
    {
      id: 'account',
      title: 'Account',
      detail: username ? `@${username}` : undefined,
      keywords: 'account username handle social follow',
      onPress: () => router.push('/account'),
    },
    {
      id: 'preferences',
      title: 'Preferences',
      onPress: () => router.push('/preferences'),
    },
    {
      id: 'debug',
      title: 'Debug',
      onPress: () => router.push('/debug'),
    },
  ];

  const visibleSettings = settings.filter((setting) =>
    setting.id === 'preferences'
      ? matchesSearchText(
          'Preferences appearance dark light mode theme rating system decimal whole library explore list card view expanded collapsed sections',
          query,
        )
      : matchesSearchText(`${setting.title} ${setting.keywords ?? ''} ${setting.detail ?? ''}`, query),
  );

  return (
    <Screen>
      <SettingsSearchHeader />
      <ScreenScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12 }}>
      {visibleSettings.length === 0 ? (
        <Text>No matching settings.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {visibleSettings.map((setting) => (
            <Pressable
              key={setting.id}
              onPress={setting.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.searchBarBackground,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}>
              <Text>{setting.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                {setting.detail ? (
                  <Text style={{ color: colors.textMuted, flexShrink: 1 }} numberOfLines={1}>
                    {setting.detail}
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {session ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Text style={{ color: colors.textMuted }}>Signed in as {session.user.email}</Text>
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            style={{
              alignItems: 'center',
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 14,
            }}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}
      </ScreenScrollView>
    </Screen>
  );
}
