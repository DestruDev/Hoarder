import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import migrations from '@/drizzle/migrations';
import { db, seedDummyItemIfEmpty } from '@/lib/db';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (error) {
      SplashScreen.hideAsync();
      return;
    }

    if (!success) {
      return;
    }

    seedDummyItemIfEmpty()
      .catch((seedError) => {
        console.error('[Hoarder DB] Seed failed:', seedError);
      })
      .finally(() => {
        SplashScreen.hideAsync();
      });
  }, [success, error]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Database migration failed.</Text>
        <Text>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Preparing database...</Text>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Hoarder' }} />
      <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
      <Stack.Screen name="form" options={{ title: 'Item' }} />
      <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
    </Stack>
  );
}
