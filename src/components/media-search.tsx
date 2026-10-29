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
import { Animated, Pressable, TextInput, View } from 'react-native';
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
  const [barVisible, setBarVisible] = useState(false);
  const [query, setQuery] = useState('');

  const openSearch = useCallback(() => {
    setIsSearching(true);
    setBarVisible(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setQuery('');
  }, []);

  const hideSearchBar = useCallback(() => {
    setBarVisible(false);
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
        {barVisible ? (
          <HeaderSearchBar open={isSearching} onHidden={hideSearchBar} />
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

export function HeaderSearchBar({
  open,
  onHidden,
}: {
  open: boolean;
  onHidden: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const inputRef = useRef<TextInput>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const { query, setQuery, closeSearch } = useMediaSearch();
  const placeholder = pathname === '/settings' ? 'Search settings' : 'Search';

  useEffect(() => {
    if (open) {
      Animated.spring(progress, {
        toValue: 1,
        friction: 6.5,
        tension: 68,
        useNativeDriver: true,
      }).start();
      return;
    }

    inputRef.current?.blur();
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onHidden();
      }
    });
  }, [onHidden, open, progress]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timeout);
  }, [open]);

  return (
    <Animated.View
      pointerEvents={open ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        zIndex: 100,
        elevation: 100,
        opacity: progress,
      }}>
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
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingLeft: 10,
              minHeight: 36,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [28, 0],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
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
          </Animated.View>
        </View>
      </View>
    </Animated.View>
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
