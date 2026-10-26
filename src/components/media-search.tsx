import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';

type MediaSearchContextValue = {
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

export function MediaSearchRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const openSearch = useCallback(() => {
    setIsSearching(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if ((pathname === '/' || pathname === '/profile') && isSearching) {
      setIsSearching(false);
      setQuery('');
    }
  }, [isSearching, pathname]);

  const value = useMemo(
    () => ({
      query,
      openSearch,
      closeSearch,
      setQuery,
    }),
    [closeSearch, openSearch, query],
  );

  return (
    <MediaSearchProvider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {isSearching ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              left: 0,
              zIndex: 100,
              elevation: 100,
            }}>
            <HeaderSearchBar />
          </View>
        ) : null}
      </View>
    </MediaSearchProvider>
  );
}

export function HeaderSearchButton() {
  const { openSearch } = useMediaSearch();

  return (
    <Pressable
      onPress={openSearch}
      onPressIn={openSearch}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
      }}>
      <Ionicons name="search" size={22} color={colors.text} />
    </Pressable>
  );
}

export function HeaderSearchBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const inputRef = useRef<TextInput>(null);
  const { query, setQuery, closeSearch } = useMediaSearch();
  const placeholder = pathname === '/settings' ? 'Search settings' : 'Search';

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, []);

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
            ref={inputRef}
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
          <Pressable
            onPress={closeSearch}
            onPressIn={closeSearch}
            hitSlop={8}
            style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function TabSearchHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ height: 44, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', fontSize: 17, fontWeight: '600' }}>{title}</Text>
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}>
          <HeaderSearchButton />
        </View>
      </View>
    </View>
  );
}

export function LibrarySearchHeader() {
  return <TabSearchHeader title="Library" />;
}

export function ExploreSearchHeader() {
  return <TabSearchHeader title="Explore" />;
}

export function SettingsSearchHeader() {
  return <TabSearchHeader title="Settings" />;
}
