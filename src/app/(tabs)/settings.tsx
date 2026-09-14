import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/themed';
import { resetAndSeed, resetAndSeedCatalog } from '@/lib/db';

export default function SettingsScreen() {
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

  return (
    <Screen style={{ padding: 16, gap: 12 }}>
      <Text>Settings screen</Text>

      {__DEV__ ? (
        <View style={{ gap: 8 }}>
          <Text>Development</Text>
          <Pressable onPress={handleResetAndSeed} disabled={busy}>
            <Text>{busy ? 'Seeding…' : 'Reset & seed sample library items'}</Text>
          </Pressable>
          <Pressable onPress={handleResetCatalog} disabled={busy}>
            <Text>{busy ? 'Seeding…' : 'Reset & seed catalog'}</Text>
          </Pressable>
          {message ? <Text>{message}</Text> : null}
        </View>
      ) : null}
    </Screen>
  );
}
