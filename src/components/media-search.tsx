import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type MediaSearchContextValue = {
  isSearching: boolean;
  query: string;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
};

const MediaSearchContext = createContext<MediaSearchContextValue | null>(null);

export function MediaSearchProvider({
  value,
  children,
}: {
  value: MediaSearchContextValue;
  children: ReactNode;
}) {
  return <MediaSearchContext.Provider value={value}>{children}</MediaSearchContext.Provider>;
}

export function useMediaSearch() {
  const value = useContext(MediaSearchContext);
  if (!value) {
    throw new Error('useMediaSearch must be used within MediaSearchProvider');
  }
  return value;
}

export function HeaderSearchButton() {
  const { openSearch } = useMediaSearch();

  return (
    <Pressable onPress={openSearch} hitSlop={8} style={{ marginRight: 16 }}>
      <Ionicons name="search" size={22} color={colors.text} />
    </Pressable>
  );
}

export function HeaderSearchBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { query, setQuery, closeSearch } = useMediaSearch();
  const placeholder = pathname === '/settings' ? 'Search settings' : 'Search';

  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}>
      <View
        style={{
          height: 44,
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.searchBarBackground,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            paddingLeft: 10,
            minHeight: 36,
          }}>
          <Ionicons name="search" size={18} color={colors.placeholder} style={{ marginRight: 8 }} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            underlineColorAndroid="transparent"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 17,
              paddingVertical: 6,
            }}
          />
          <Pressable onPress={closeSearch} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function getSearchHeaderOptions(isSearching: boolean) {
  if (isSearching) {
    return {
      header: () => <HeaderSearchBar />,
    };
  }

  return {
    header: undefined,
    headerRight: () => <HeaderSearchButton />,
  };
}
