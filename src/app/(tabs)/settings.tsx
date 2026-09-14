import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaSearch } from '@/components/media-search';
import { ScreenScrollView, Text } from '@/components/themed';
import { resetAndSeed, resetAndSeedCatalog } from '@/lib/db';
import { matchesSearchText } from '@/lib/media-search';

type SettingItem = {
  id: string;
  group: string;
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function SettingsScreen() {
  const { query } = useMediaSearch();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleResetAndSeed() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const seeded = await resetAndSeed();
      setMessage(`Reset complete. Seeded ${seeded.length} sample items.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to reset and seed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetCatalog() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const seeded = await resetAndSeedCatalog();
      setMessage(`Catalog reset complete. Seeded ${seeded.length} titles.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to reset catalog.');
    } finally {
      setBusy(false);
    }
  }

  const settings: SettingItem[] = __DEV__
    ? [
        {
          id: 'reset-library',
          group: 'Development',
          title: 'Reset & seed sample library items',
          onPress: handleResetAndSeed,
          disabled: busy,
        },
        {
          id: 'reset-catalog',
          group: 'Development',
          title: 'Reset & seed catalog',
          onPress: handleResetCatalog,
          disabled: busy,
        },
      ]
    : [];

  const visibleSettings = settings.filter((setting) =>
    matchesSearchText(`${setting.group} ${setting.title}`, query),
  );

  const groups = [...new Set(visibleSettings.map((setting) => setting.group))];

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 12 }}>
      {settings.length === 0 ? (
        <Text>No settings yet.</Text>
      ) : visibleSettings.length === 0 ? (
        <Text>No matching settings.</Text>
      ) : (
        groups.map((group) => (
          <View key={group} style={{ gap: 8 }}>
            <Text>{group}</Text>
            {visibleSettings
              .filter((setting) => setting.group === group)
              .map((setting) => (
                <Pressable key={setting.id} onPress={setting.onPress} disabled={setting.disabled}>
                  <Text>{busy ? 'Seeding…' : setting.title}</Text>
                </Pressable>
              ))}
          </View>
        ))
      )}
      {message ? <Text>{message}</Text> : null}
    </ScreenScrollView>
  );
}
