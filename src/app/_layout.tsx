import { ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Screen, Text } from '@/components/themed';
import { colors, navigationTheme } from '@/constants/theme';
import migrations from '@/drizzle/migrations';
import { db, seedCatalogIfEmpty } from '@/lib/db';

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

    seedCatalogIfEmpty()
      .catch((seedError) => {
        console.error('[Hoarder DB] Catalog seed failed:', seedError);
      })
      .finally(() => {
        SplashScreen.hideAsync();
      });
  }, [success, error]);

  if (error) {
    return (
      <Screen style={{ justifyContent: 'center', padding: 24 }}>
        <Text>Database migration failed.</Text>
        <Text>{error.message}</Text>
      </Screen>
    );
  }

  if (!success) {
    return (
      <Screen style={{ justifyContent: 'center', padding: 24 }}>
        <Text>Preparing database...</Text>
      </Screen>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
        <Stack.Screen name="catalog/[id]" options={{ title: 'Title' }} />
        <Stack.Screen name="form" options={{ title: 'Item' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </ThemeProvider>
  );
}
