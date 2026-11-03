import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { SettingsSearchHeader, useMediaQuery } from '@/components/media-search';
import { Screen, ScreenScrollView, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { matchesSearchText } from '@/lib/media-search';

type SettingItem = {
  id: string;
  title: string;
  onPress: () => void;
};

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { query } = useMediaQuery();
  const { session, signOut } = useAuth();

  const settings: SettingItem[] = [
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
          'Preferences rating system decimal whole library explore list card view',
          query,
        )
      : matchesSearchText(setting.title, query),
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
              <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
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
