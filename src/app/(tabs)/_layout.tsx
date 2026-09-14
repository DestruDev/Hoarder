import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import {
  getSearchHeaderOptions,
  MediaSearchProvider,
} from '@/components/media-search';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  const pathname = usePathname();
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onHomeOrProfile = pathname === '/' || pathname === '/profile';

    if (onHomeOrProfile && isSearching) {
      setIsSearching(false);
      setQuery('');
    }
  }, [isSearching, pathname]);

  const search = useMemo(
    () => ({
      isSearching,
      query,
      openSearch: () => setIsSearching(true),
      closeSearch: () => {
        setIsSearching(false);
        setQuery('');
      },
      setQuery,
    }),
    [isSearching, query],
  );

  const searchHeader = getSearchHeaderOptions(isSearching);

  return (
    <MediaSearchProvider value={search}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.placeholder,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            ...searchHeader,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            ...searchHeader,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            ...searchHeader,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </MediaSearchProvider>
  );
}
