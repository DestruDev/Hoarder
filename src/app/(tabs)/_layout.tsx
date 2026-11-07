import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, Tabs } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { MediaSearchRoot } from '@/components/media-search';
import { useColors } from '@/components/theme-colors';
import { syncNow } from '@/lib/sync';

export default function TabLayout() {
  const colors = useColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [parentTitle, setParentTitle] = useState('Feed');

  return (
    <>
      <Stack.Screen options={{ title: parentTitle }} />
      <MediaSearchRoot>
        <Tabs
          // Sync whenever a tab is opened, so edits from other devices show up
          // without reopening the app. Overlapping requests share one pass, and
          // screens reload themselves when a sync brings in changes.
          screenListeners={{
            focus: () => {
              if (userId) {
                void syncNow(userId);
              }
            },
          }}
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
            listeners={{ focus: () => setParentTitle('Feed') }}
            options={{
              title: 'Feed',
              headerShown: false,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="library"
            listeners={{ focus: () => setParentTitle('Library') }}
            options={{
              title: 'Library',
              headerShown: false,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="explore"
            listeners={{ focus: () => setParentTitle('Explore') }}
            options={{
              title: 'Explore',
              headerShown: false,
              lazy: false,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            listeners={{ focus: () => setParentTitle('Profile') }}
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
            listeners={{ focus: () => setParentTitle('Settings') }}
            options={{
              title: 'Settings',
              headerShown: false,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </MediaSearchRoot>
    </>
  );
}
