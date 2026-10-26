import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import {
  ExploreSearchHeader,
  LibrarySearchHeader,
  MediaSearchRoot,
  SettingsSearchHeader,
} from '@/components/media-search';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  return (
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
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            header: LibrarySearchHeader,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            header: ExploreSearchHeader,
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
            header: SettingsSearchHeader,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </MediaSearchRoot>
  );
}
