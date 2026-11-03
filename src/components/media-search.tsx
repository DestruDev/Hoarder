import Ionicons from '@expo/vector-icons/Ionicons';
import { useSegments } from 'expo-router';
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import {
  FEED_FILTER_OPTIONS,
  DEFAULT_STATUS_FILTER,
  collectGenres,
  createDateRule,
  DATE_OPERATORS,
  type DateRule,
  toggleGenreFilter,
  DEFAULT_MEDIA_FILTER,
  DEFAULT_RELEASE_FILTER,
  isReleaseFilterActive,
  RELEASE_FILTER_OPTIONS,
  toggleReleaseFilter,
  getMediaFilterOptions,
  getStatusFilterOptions,
  isFeedFilterSelected,
  isMediaFilterActive,
  isStatusFilterActive,
  toggleFeedFilter,
  toggleMediaFilter,
  toggleStatusFilter,
  type FeedFilter,
  type MediaBrowseFilter,
  type StatusFilterValue,
} from '@/lib/media-search';
import { peekCatalogItems } from '@/lib/db/catalog-store';
import type { ReleaseStatus } from '@/lib/db/types';
import { WheelPicker, type WheelOption } from '@/components/score-picker';
import {
  browseTabFor,
  DEFAULT_SORTS,
  type BrowseTab,
  flipSortDirection,
  isSortActive,
  selectSort,
  SORT_OPTIONS,
  sortLabel,
  type MediaSort,
  type SortKey,
} from '@/lib/media-sort';

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
  sort: MediaSort;
  setSort: (sort: MediaSort) => void;
  statusFilter: StatusFilterValue[];
  setStatusFilter: (filter: StatusFilterValue[]) => void;
  releaseFilter: ReleaseStatus[];
  setReleaseFilter: (filter: ReleaseStatus[]) => void;
  genreFilter: string[];
  setGenreFilter: (filter: string[]) => void;
  dateRules: DateRule[];
  setDateRules: (rules: DateRule[]) => void;
  openFilter: () => void;
};

export type BrowseFilters = {
  filter: MediaBrowseFilter;
  sort: MediaSort;
  statusFilter: StatusFilterValue[];
  releaseFilter: ReleaseStatus[];
  genreFilter: string[];
  dateRules: DateRule[];
};

function defaultBrowseFilters(tab: BrowseTab): BrowseFilters {
  return {
    filter: DEFAULT_MEDIA_FILTER,
    sort: DEFAULT_SORTS[tab],
    statusFilter: DEFAULT_STATUS_FILTER,
    releaseFilter: DEFAULT_RELEASE_FILTER,
    genreFilter: [],
    dateRules: [],
  };
}

type MediaQueryContextValue = Pick<MediaSearchContextValue, 'query' | 'feedFilter'> & {
  browse: Record<BrowseTab, BrowseFilters>;
};

const MediaSearchContext = createContext<MediaSearchContextValue | null>(null);
const MediaQueryContext = createContext<MediaQueryContextValue | null>(null);

export function useMediaSearch() {
  const value = useContext(MediaSearchContext);
  if (!value) {
    throw new Error('useMediaSearch must be used within MediaSearchRoot');
  }
  return value;
}

export function useMediaQuery() {
  const value = useContext(MediaQueryContext);
  if (!value) {
    throw new Error('useMediaQuery must be used within MediaSearchRoot');
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
  const [feedFilter, setFeedFilter] = useState<FeedFilter>([]);
  const [browse, setBrowse] = useState<Record<BrowseTab, BrowseFilters>>(() => ({
    library: defaultBrowseFilters('library'),
    explore: defaultBrowseFilters('explore'),
  }));
  const browseTab = browseTabFor(tab);
  const { filter, sort, statusFilter, releaseFilter, genreFilter, dateRules } = browse[browseTab];
  const [filterOpen, setFilterOpen] = useState(false);

  const setters = useMemo(() => {
    function setField<K extends keyof BrowseFilters>(key: K) {
      return (next: BrowseFilters[K]) =>
        setBrowse((current) => ({
          ...current,
          [browseTab]: { ...current[browseTab], [key]: next },
        }));
    }

    return {
      setFilter: setField('filter'),
      setSort: setField('sort'),
      setStatusFilter: setField('statusFilter'),
      setReleaseFilter: setField('releaseFilter'),
      setGenreFilter: setField('genreFilter'),
      setDateRules: setField('dateRules'),
    };
  }, [browseTab]);

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
      feedFilter,
      setFeedFilter,
      filter,
      sort,
      statusFilter,
      releaseFilter,
      genreFilter,
      dateRules,
      ...setters,
      openFilter,
    }),
    [
      closeSearch,
      dateRules,
      feedFilter,
      filter,
      genreFilter,
      isSearching,
      openFilter,
      openSearch,
      query,
      releaseFilter,
      setters,
      sort,
      statusFilter,
    ],
  );
  const queryValue = useMemo(() => ({ query, feedFilter, browse }), [browse, feedFilter, query]);

  return (
    <MediaSearchContext.Provider value={value}>
      <MediaQueryContext.Provider value={queryValue}>
        <View style={{ flex: 1 }}>
          {children}
          <HeaderFilterMenu visible={filterOpen} onClose={() => setFilterOpen(false)} />
        </View>
      </MediaQueryContext.Provider>
    </MediaSearchContext.Provider>
  );
}

export function HeaderSearchButton() {
  const colors = useColors();
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
  const colors = useColors();
  const tab = useActiveTab();
  const { filter, feedFilter, sort, statusFilter, releaseFilter, genreFilter, dateRules, openFilter } =
    useMediaSearch();
  const active =
    tab === 'index'
      ? feedFilter.length > 0
      : isMediaFilterActive(filter) ||
        isSortActive(sort, browseTabFor(tab)) ||
        genreFilter.length > 0 ||
        dateRules.length > 0 ||
        isStatusFilterActive(statusFilter, tab === 'explore') ||
        isReleaseFilterActive(releaseFilter);

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

function FeedFilterDropdown({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { feedFilter, setFeedFilter } = useMediaSearch();

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
          {FEED_FILTER_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setFeedFilter(toggleFeedFilter(feedFilter, option.value))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}>
              <Text style={{ flex: 1 }}>{option.label}</Text>
              {isFeedFilterSelected(feedFilter, option.value) ? (
                <Ionicons name="checkmark" size={18} color={colors.text} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function selectionSummary(selected: number, total: number): string {
  if (selected === total) {
    return 'All';
  }

  return selected === 0 ? 'None' : `${selected} of ${total}`;
}

function SheetSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const colors = useColors();
  const [collapsed, setCollapsed] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  function toggle() {
    const next = !collapsed;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotation, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setCollapsed(next);
  }

  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
        accessibilityState={{ expanded: !collapsed }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: colors.textMuted, fontWeight: '600' }}>{title}</Text>
        {collapsed ? <Text style={{ color: colors.textMuted }}>{summary}</Text> : null}
        <Animated.View
          style={{
            transform: [
              {
                rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] }),
              },
            ],
          }}>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
      {collapsed ? null : children}
    </View>
  );
}

function SheetOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: selected ? colors.searchBarBackground : colors.background,
        borderColor: selected ? colors.text : colors.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
      }}>
      <Text style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
    </Pressable>
  );
}

function SheetGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];

  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }

  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: 10 }}>
          {row}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function MediaFilterSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.9);
  const {
    filter,
    setFilter,
    sort,
    setSort,
    statusFilter,
    setStatusFilter,
    releaseFilter,
    setReleaseFilter,
    genreFilter,
    setGenreFilter,
    dateRules,
    setDateRules,
  } = useMediaSearch();
  const genres = useMemo(() => (visible ? collectGenres(peekCatalogItems() ?? []) : []), [visible]);
  const tab = useActiveTab();
  const statusOptions = getStatusFilterOptions(tab === 'explore');
  const options = getMediaFilterOptions();
  const hasActiveFilters =
    isSortActive(sort, browseTabFor(tab)) ||
    isStatusFilterActive(statusFilter, tab === 'explore') ||
    isReleaseFilterActive(releaseFilter) ||
    isMediaFilterActive(filter) ||
    genreFilter.length > 0 ||
    dateRules.length > 0;

  const resetFilters = () => {
    setSort(DEFAULT_SORTS[browseTabFor(tab)]);
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setReleaseFilter(DEFAULT_RELEASE_FILTER);
    setFilter(DEFAULT_MEDIA_FILTER);
    setGenreFilter([]);
    setDateRules([]);
  };
  const [sortPickerOpen, setSortPickerOpen] = useState(false);
  const [datePicker, setDatePicker] = useState<{ ruleId: string; field: DateField } | null>(null);
  const datePickerRule = datePicker
    ? (dateRules.find((rule) => rule.id === datePicker.ruleId) ?? null)
    : null;

  const updateDateRule = (next: DateRule) => {
    setDateRules(dateRules.map((rule) => (rule.id === next.id ? next : rule)));
  };

  const sheetScrollRef = useRef<ScrollView>(null);
  const scrollToEndOnResize = useRef(false);

  const addDateRule = () => {
    scrollToEndOnResize.current = true;
    setDateRules([...dateRules, createDateRule()]);
  };

  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const currentY = useRef(windowHeight);
  const dragOrigin = useRef(0);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  const sheetHeightRef = useRef(sheetHeight);
  onCloseRef.current = onClose;
  sheetHeightRef.current = sheetHeight;

  const animateTo = useCallback(
    (toValue: number, velocity = 0, onEnd?: (finished: boolean) => void) => {
      Animated.spring(translateY, {
        toValue,
        velocity: velocity * 1000,
        tension: 72,
        friction: 11,
        overshootClamping: true,
        restDisplacementThreshold: 1,
        restSpeedThreshold: 1,
        useNativeDriver: false,
      }).start(({ finished }) => onEnd?.(finished));
    },
    [translateY],
  );

  const dismiss = useCallback(
    (velocity = 0) => {
      if (closing.current) {
        return;
      }

      closing.current = true;
      animateTo(sheetHeightRef.current, velocity, (finished) => {
        closing.current = false;
        if (finished) {
          onCloseRef.current();
        }
      });
    },
    [animateTo],
  );

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!visible) {
      return;
    }

    closing.current = false;
    translateY.setValue(sheetHeightRef.current);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [translateY, visible]);

  useEffect(() => {
    const listener = translateY.addListener(({ value }) => {
      currentY.current = value;
    });
    return () => translateY.removeListener(listener);
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation((value) => {
          dragOrigin.current = value;
          currentY.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, dragOrigin.current + gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => settle(gesture.vy),
      onPanResponderTerminate: (_, gesture) => settle(gesture.vy),
    }),
  ).current;

  function settle(velocityY: number) {
    translateY.stopAnimation((value) => {
      currentY.current = value;
      const projectedY = value + velocityY * 220;
      if (projectedY > sheetHeightRef.current / 2) {
        dismissRef.current(velocityY);
      } else {
        animateTo(0, velocityY);
      }
    });
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss()}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filter"
          onPress={() => dismiss()}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              opacity: translateY.interpolate({
                inputRange: [0, sheetHeight],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            }}
          />
        </Pressable>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <View
            style={{
              height: sheetHeight,
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }}>
            <View {...panResponder.panHandlers} style={{ paddingTop: 8 }}>
              <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                <View
                  style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }}
                />
              </View>
              <View style={{ height: 48, justifyContent: 'center' }}>
                <Text
                  style={{ textAlign: 'center', fontSize: 17, fontWeight: '600', marginHorizontal: 120 }}>
                  Filter
                </Text>
                <Pressable
                  onPress={() => dismiss()}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close filter"
                  style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <Ionicons name="close" size={28} color={colors.text} />
                </Pressable>
                <View
                  style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <ResetButton dimmed={!hasActiveFilters} onPress={resetFilters} />
                </View>
              </View>
            </View>
            <ScrollView
              ref={sheetScrollRef}
              onContentSizeChange={() => {
                if (scrollToEndOnResize.current) {
                  scrollToEndOnResize.current = false;
                  sheetScrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{
                padding: 16,
                gap: 10,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: colors.textMuted, fontWeight: '600' }}>Sort</Text>
                <SortChip
                  icon={sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'}
                  label={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
                  accessibilityLabel="Switch sort direction"
                  onPress={() => setSort(flipSortDirection(sort))}
                />
                <SortChip
                  icon="chevron-down"
                  iconAfter
                  label={sortLabel(sort.key)}
                  accessibilityLabel="Choose sort"
                  onPress={() => setSortPickerOpen(true)}
                />
              </View>

              <SheetSection
                title="Status"
                summary={selectionSummary(
                  statusOptions.filter((option) => statusFilter.includes(option.value)).length,
                  statusOptions.length,
                )}>
                <SheetGrid>
                  {statusOptions.map((option) => (
                    <SheetOption
                      key={option.value}
                      label={option.label}
                      selected={statusFilter.includes(option.value)}
                      onPress={() => setStatusFilter(toggleStatusFilter(statusFilter, option.value))}
                    />
                  ))}
                </SheetGrid>
              </SheetSection>

              <SheetSection
                title="Series Status"
                summary={selectionSummary(releaseFilter.length, RELEASE_FILTER_OPTIONS.length)}>
                <SheetGrid>
                  {RELEASE_FILTER_OPTIONS.map((option) => (
                    <SheetOption
                      key={option.value}
                      label={option.label}
                      selected={releaseFilter.includes(option.value)}
                      onPress={() => setReleaseFilter(toggleReleaseFilter(releaseFilter, option.value))}
                    />
                  ))}
                </SheetGrid>
              </SheetSection>

              <SheetSection
                title="Type"
                summary={selectionSummary(
                  options.filter((option) => filter.includes(option.value)).length,
                  options.length,
                )}>
                <SheetGrid>
                  {options.map((option) => (
                    <SheetOption
                      key={option.value}
                      label={option.label}
                      selected={filter.includes(option.value)}
                      onPress={() => setFilter(toggleMediaFilter(filter, option.value))}
                    />
                  ))}
                </SheetGrid>
              </SheetSection>

              <SheetSection
                title="Genre"
                summary={genreFilter.length === 0 ? 'Any' : `${genreFilter.length} selected`}>
                {genres.length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>No genres available yet.</Text>
                ) : (
                  <SheetGrid>
                    <SheetOption
                      key="any"
                      label="Any"
                      selected={genreFilter.length === 0}
                      onPress={() => setGenreFilter([])}
                    />
                    {genres.map((genre) => (
                      <SheetOption
                        key={genre}
                        label={genre}
                        selected={genreFilter.includes(genre.toLowerCase())}
                        onPress={() => setGenreFilter(toggleGenreFilter(genreFilter, genre))}
                      />
                    ))}
                  </SheetGrid>
                )}
              </SheetSection>

              <SheetSection
                title="Release Date"
                summary={dateRules.length === 0 ? 'Any' : dateRules.map(formatDateRule).join(', ')}>
                {dateRules.map((rule) => (
                  <DateRuleCard
                    key={rule.id}
                    rule={rule}
                    onChange={updateDateRule}
                    onRemove={() => setDateRules(dateRules.filter((entry) => entry.id !== rule.id))}
                    onPick={(field) => setDatePicker({ ruleId: rule.id, field })}
                  />
                ))}
                <Pressable
                  onPress={addDateRule}
                  accessibilityRole="button"
                  accessibilityLabel="Add release date"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderRadius: 10,
                    paddingVertical: 12,
                  }}>
                  <Ionicons name="add" size={18} color={colors.text} />
                  <Text>Add release date</Text>
                </Pressable>
              </SheetSection>
            </ScrollView>
          </View>
        </Animated.View>
        <WheelPickerModal
          title="Sort"
          visible={visible && sortPickerOpen}
          options={SORT_WHEEL_OPTIONS}
          value={sort.key}
          onChange={(key) => setSort(selectSort(sort, key))}
          onClose={() => setSortPickerOpen(false)}
        />
        <WheelPickerModal
          title={datePicker ? DATE_FIELD_TITLES[datePicker.field] : ''}
          visible={visible && datePickerRule != null}
          options={datePicker ? DATE_FIELD_OPTIONS[datePicker.field] : []}
          value={datePickerRule && datePicker ? datePickerRule[datePicker.field] : null}
          onChange={(value) => {
            if (datePickerRule && datePicker) {
              updateDateRule(setDateRuleField(datePickerRule, datePicker.field, value));
            }
          }}
          onClose={() => setDatePicker(null)}
        />
      </View>
    </Modal>
  );
}

const SORT_WHEEL_OPTIONS = SORT_OPTIONS.map((option) => ({
  value: option.key as SortKey,
  label: option.label,
  key: option.key,
}));

type DateField = 'year' | 'month' | 'day';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_FIELD_TITLES: Record<DateField, string> = { year: 'Year', month: 'Month', day: 'Day' };

const DATE_FIELD_OPTIONS: Record<DateField, WheelOption<number | null>[]> = {
  year: Array.from({ length: new Date().getFullYear() + 6 - 1900 }, (_, index) => {
    const year = 1900 + index;
    return { value: year, label: String(year), key: String(year) };
  }),
  month: [
    { value: null, label: 'Any month', key: 'any' },
    ...MONTH_NAMES.map((name, index) => ({
      value: index + 1,
      label: `${index + 1} (${name})`,
      key: String(index + 1),
    })),
  ],
  day: [
    { value: null, label: 'Any day', key: 'any' },
    ...Array.from({ length: 31 }, (_, index) => ({
      value: index + 1,
      label: String(index + 1),
      key: String(index + 1),
    })),
  ],
};

function setDateRuleField(rule: DateRule, field: DateField, value: number | null): DateRule {
  switch (field) {
    case 'year':
      return { ...rule, year: value ?? rule.year };
    case 'month':
      return { ...rule, month: value, day: value == null ? null : rule.day };
    case 'day':
      return { ...rule, day: value };
  }
}

function formatDateRule(rule: DateRule): string {
  const month = rule.month == null ? '' : ` ${MONTH_NAMES[rule.month - 1]}`;
  const day = rule.month == null || rule.day == null ? '' : ` ${rule.day}`;
  return `${rule.operator} ${rule.year}${month}${day}`;
}

function DateRuleCard({
  rule,
  onChange,
  onRemove,
  onPick,
}: {
  rule: DateRule;
  onChange: (rule: DateRule) => void;
  onRemove: () => void;
  onPick: (field: DateField) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        gap: 10,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {DATE_OPERATORS.map((operator) => {
          const selected = rule.operator === operator;

          return (
            <Pressable
              key={operator}
              onPress={() => onChange({ ...rule, operator })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: selected ? colors.text : 'transparent',
                backgroundColor: selected ? colors.searchBarBackground : 'transparent',
              }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: selected ? '700' : '400',
                  color: selected ? colors.text : colors.textMuted,
                }}>
                {operator}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove release date"
          style={{ paddingHorizontal: 6 }}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <DateFieldButton label={String(rule.year)} onPress={() => onPick('year')} />
        <DateFieldButton
          label={rule.month == null ? 'Any month' : `${rule.month} (${MONTH_NAMES[rule.month - 1]})`}
          onPress={() => onPick('month')}
        />
        <DateFieldButton
          label={rule.month == null || rule.day == null ? 'Any day' : String(rule.day)}
          disabled={rule.month == null}
          onPress={() => onPick('day')}
        />
      </View>
    </View>
  );
}

function DateFieldButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.searchBarBackground,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        opacity: disabled ? 0.4 : 1,
      }}>
      <Text style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

function WheelPickerModal<T>({
  title,
  visible,
  options,
  value,
  onChange,
  onClose,
}: {
  title: string;
  visible: boolean;
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()} picker`}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.overlay,
          }}
        />
        <View
          style={{
            backgroundColor: colors.inputBackground,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderColor: colors.border,
            borderWidth: 1,
            borderBottomWidth: 0,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 10,
          }}>
          <Text style={{ fontSize: 18 }}>{title}</Text>
          {visible ? (
            <WheelPicker
              options={options}
              value={value}
              onChange={onChange}
              onSelect={onClose}
              fontSize={22}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ResetButton({ dimmed, onPress }: { dimmed: boolean; onPress: () => void }) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  function animateScale(toValue: number) {
    Animated.spring(scale, { toValue, friction: 5, tension: 300, useNativeDriver: true }).start();
  }

  function handlePress() {
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => animateScale(0.9)}
      onPressOut={() => animateScale(1)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Reset filters">
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.searchBarBackground,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 6,
          opacity: dimmed ? 0.4 : 1,
          transform: [{ scale }],
        }}>
        <Animated.View
          style={{
            transform: [
              { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) },
            ],
          }}>
          <Ionicons name="refresh" size={16} color={colors.text} />
        </Animated.View>
        <Text style={{ fontWeight: '600' }}>Reset</Text>
      </Animated.View>
    </Pressable>
  );
}

function SortChip({
  icon,
  iconAfter = false,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: 'arrow-up' | 'arrow-down' | 'chevron-down';
  iconAfter?: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const iconNode = <Ionicons name={icon} size={16} color={colors.text} />;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.searchBarBackground,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}>
      {iconAfter ? null : iconNode}
      <Text>{label}</Text>
      {iconAfter ? iconNode : null}
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
  const tab = useActiveTab();

  return tab === 'index' ? (
    <FeedFilterDropdown visible={visible} onClose={onClose} />
  ) : (
    <MediaFilterSheet visible={visible} onClose={onClose} />
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
  const colors = useColors();
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
  const colors = useColors();
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
