import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, Tabs } from 'expo-router';
import { useState } from 'react';

import { MediaSearchRoot } from '@/components/media-search';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  const [parentTitle, setParentTitle] = useState('Feed');

  return (
    <>
      <Stack.Screen options={{ title: parentTitle }} />
      <MediaSearchRoot>
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
