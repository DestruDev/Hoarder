import { ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AppSettingsProvider, useAppSettings } from '@/components/app-settings';
import { AuthProvider, useAuth } from '@/components/auth-provider';
import { Screen, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { navigationThemeFor } from '@/constants/theme';
import migrations from '@/drizzle/migrations';
import { catalogSectionKey } from '@/lib/catalog-sections';
import {
  db,
  enrichCatalogMetadataIfNeeded,
  getCatalogItems,
  seedCatalogIfEmpty,
  type CatalogItem,
  type SeedProgress,
} from '@/lib/db';

SplashScreen.preventAutoHideAsync();

const PREFETCH_PER_SECTION = 6;

function prefetchExploreCovers(items: CatalogItem[]) {
  const counts = new Map<string, number>();
  const urls: string[] = [];

  for (const item of items) {
    const key = catalogSectionKey(item);
    const count = counts.get(key) ?? 0;
    if (!item.featured || !item.coverImageUrl || count >= PREFETCH_PER_SECTION) {
      continue;
    }

    counts.set(key, count + 1);
    urls.push(item.coverImageUrl);
  }

  void Image.prefetch(urls, 'disk').catch(() => undefined);
}

function LoadingScreen({ progress }: { progress: SeedProgress | null }) {
  const colors = useColors();
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
      <ActivityIndicator size="large" color={colors.text} />
      <Text>{progress?.label ?? 'Loading…'}</Text>
      {percent != null ? <Text style={{ color: colors.textMuted }}>{percent}%</Text> : null}
    </Screen>
  );
}

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<SeedProgress | null>(null);

  useEffect(() => {
    if (error) {
      SplashScreen.hideAsync();
      return;
    }

    if (!success) {
      return;
    }

    SplashScreen.hideAsync();

    seedCatalogIfEmpty(setProgress)
      .then(() => getCatalogItems())
      .then(prefetchExploreCovers)
      .catch((seedError) => {
        console.error('[Hoarder DB] Catalog seed failed:', seedError);
      })
      .finally(() => {
        setReady(true);
      })
      .then(() =>
        enrichCatalogMetadataIfNeeded().catch((enrichError: unknown) => {
          console.warn('[Hoarder DB] Catalog metadata enrich failed:', enrichError);
        }),
      );
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
    return <LoadingScreen progress={{ label: 'Preparing database…', current: 0, total: 0 }} />;
  }

  if (!ready) {
    return <LoadingScreen progress={progress} />;
  }

  return (
    <ThemeProvider value={navigationThemeFor('dark')}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen progress={{ label: 'Signing in…', current: 0, total: 0 }} />;
  }

  const userId = session?.user.id ?? null;

  return (
    // Keyed by account so settings reset to defaults instead of leaking between users.
    <AppSettingsProvider key={userId ?? 'signed-out'} userId={userId}>
      <AppStack signedIn={userId != null} />
    </AppSettingsProvider>
  );
}

function AppStack({ signedIn }: { signedIn: boolean }) {
  const colors = useColors();
  const { colorScheme } = useAppSettings();

  return (
    <ThemeProvider value={navigationThemeFor(colorScheme)}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Feed' }} />
          <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
          <Stack.Screen name="catalog/[id]" options={{ title: 'Title' }} />
          <Stack.Screen
            name="edit/[id]"
            options={{
              title: 'Edit',
              presentation: 'transparentModal',
              animation: 'none',
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="form" options={{ title: 'Item' }} />
          <Stack.Screen name="debug" options={{ title: 'Debug' }} />
          <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
          <Stack.Screen name="people" options={{ title: 'Find People' }} />
          <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
          <Stack.Screen name="follows/[id]" options={{ title: 'Profile' }} />
          <Stack.Screen name="likes/[id]" options={{ title: 'Likes' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </ThemeProvider>
  );
}
