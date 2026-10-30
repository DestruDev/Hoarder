import Ionicons from '@expo/vector-icons/Ionicons';
import { useSegments } from 'expo-router';
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
import { Animated, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  FEED_FILTER_OPTIONS,
  getMediaFilterOptions,
  isFeedFilterSelected,
  isMediaFilterSelected,
  toggleFeedFilter,
  toggleMediaFilter,
  type FeedFilter,
  type FeedFilterOption,
  type MediaBrowseFilter,
  type MediaFilterOption,
} from '@/lib/media-search';

type MediaSearchContextValue = {
  query: string;
  isSearching: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  filter: MediaBrowseFilter;
  setFilter: (filter: MediaBrowseFilter) => void;
  feedFilter: FeedFilter;
  setFeedFilter: (filter: FeedFilter) => void;
  openFilter: () => void;
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

function useActiveTab() {
  const segments = useSegments();
  const tabsIndex = segments.indexOf('(tabs)');
  if (tabsIndex >= 0) {
    return segments[tabsIndex + 1] ?? 'index';
  }

  return segments[0] ?? 'index';
}

function isSearchTab(tab: string) {
  return tab === 'library' || tab === 'explore' || tab === 'settings';
}

export function MediaSearchRoot({ children }: { children: ReactNode }) {
  const tab = useActiveTab();
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MediaBrowseFilter>([]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const openSearch = useCallback(() => {
    setFilterOpen(false);
    setIsSearching(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setQuery('');
  }, []);

  const openFilter = useCallback(() => {
    setFilterOpen(true);
  }, []);

  useEffect(() => {
    if (isSearchTab(tab)) {
      return;
    }

    if (isSearching) {
      setIsSearching(false);
      setQuery('');
    }
  }, [isSearching, tab]);

  useEffect(() => {
    setFilterOpen(false);
  }, [tab]);

  const value = useMemo(
    () => ({
      query,
      isSearching,
      openSearch,
      closeSearch,
      setQuery,
      filter,
      setFilter,
      feedFilter,
      setFeedFilter,
      openFilter,
    }),
    [closeSearch, feedFilter, filter, isSearching, openFilter, openSearch, query],
  );

  return (
    <MediaSearchProvider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <HeaderFilterMenu visible={filterOpen} onClose={() => setFilterOpen(false)} />
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
      accessibilityLabel="Search"
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

export function HeaderFilterButton() {
  const tab = useActiveTab();
  const { filter, feedFilter, openFilter } = useMediaSearch();
  const active = tab === 'index' ? feedFilter.length > 0 : filter.length > 0;

  return (
    <Pressable
      onPress={openFilter}
      onPressIn={openFilter}
      hitSlop={8}
      accessibilityLabel="Filter"
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={active ? 'funnel' : 'funnel-outline'} size={22} color={colors.text} />
    </Pressable>
  );
}

export function HeaderFilterMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tab = useActiveTab();
  const { filter, setFilter, feedFilter, setFeedFilter } = useMediaSearch();
  const isFeed = tab === 'index';
  const options = isFeed ? FEED_FILTER_OPTIONS : getMediaFilterOptions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: insets.top + 44,
            right: 12,
            minWidth: 188,
            backgroundColor: colors.searchBarBackground,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            overflow: 'hidden',
          }}>
          {options.map((option) => {
            const isSelected = isFeed
              ? isFeedFilterSelected(feedFilter, option.value as FeedFilterOption)
              : isMediaFilterSelected(filter, option.value as MediaFilterOption);

            return (
              <Pressable
                key={String(option.value ?? 'all')}
                onPress={() => {
                  if (isFeed) {
                    setFeedFilter(toggleFeedFilter(feedFilter, option.value as FeedFilterOption));
                    return;
                  }

                  setFilter(toggleMediaFilter(filter, option.value as MediaFilterOption));
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}>
                <Text style={{ flex: 1 }}>{option.label}</Text>
                {isSelected ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export function HeaderSearchBar({
  open,
  onHidden,
  autoFocus,
}: {
  open: boolean;
  onHidden: () => void;
  autoFocus: boolean;
}) {
  const tab = useActiveTab();
  const inputRef = useRef<TextInput>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const { query, setQuery, closeSearch } = useMediaSearch();
  const placeholder = tab === 'settings' ? 'Search settings' : 'Search';

  useEffect(() => {
    if (open) {
      Animated.spring(progress, {
        toValue: 1,
        friction: 6.5,
        tension: 68,
        useNativeDriver: false,
      }).start();
      return;
    }

    inputRef.current?.blur();
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onHidden();
      }
    });
  }, [onHidden, open, progress]);

  useEffect(() => {
    if (!open || !autoFocus) {
      return;
    }

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timeout);
  }, [autoFocus, open]);

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={{
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
        opacity: progress,
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
          onChangeText={(text) => setQuery(text)}
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
    </Animated.View>
  );
}

export function TabSearchHeader({
  title,
  showFilter = false,
  showSearch = true,
}: {
  title: string;
  showFilter?: boolean;
  showSearch?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tab = useActiveTab();
  const { isSearching } = useMediaSearch();
  const [barVisible, setBarVisible] = useState(showSearch && isSearching);
  const isCurrentTab =
    (title === 'Library' && tab === 'library') ||
    (title === 'Explore' && tab === 'explore') ||
    (title === 'Settings' && tab === 'settings');
  const showBar = showSearch && barVisible;

  useEffect(() => {
    if (showSearch && isSearching) {
      setBarVisible(true);
    }
  }, [isSearching, showSearch]);

  return (
    <View style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ height: 44, justifyContent: 'center' }}>
        {showBar ? (
          <HeaderSearchBar
            open={isSearching}
            autoFocus={isCurrentTab}
            onHidden={() => setBarVisible(false)}
          />
        ) : (
          <>
            <Text
              style={{
                textAlign: 'center',
                fontSize: 17,
                fontWeight: '600',
                marginHorizontal: showFilter && showSearch ? 96 : 52,
              }}>
              {title}
            </Text>
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              {showFilter ? <HeaderFilterButton /> : null}
              {showSearch ? <HeaderSearchButton /> : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export function FeedHeader() {
  return <TabSearchHeader title="Feed" showFilter showSearch={false} />;
}

export function LibrarySearchHeader() {
  return <TabSearchHeader title="Library" showFilter />;
}

export function ExploreSearchHeader() {
  return <TabSearchHeader title="Explore" showFilter />;
}

export function SettingsSearchHeader() {
  return <TabSearchHeader title="Settings" />;
}
