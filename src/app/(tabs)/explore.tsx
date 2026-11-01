import { Link, useFocusEffect } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, SectionList, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { MediaPoster, MediaRow } from '@/components/media-cover';
import { ExploreSearchHeader, useMediaQuery } from '@/components/media-search';
import { Screen, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { CATALOG_SECTION_LIMIT, CATALOG_SECTIONS } from '@/lib/catalog-sections';
import {
  getCatalogItems,
  getItems,
  peekCatalogItems,
  type CatalogItem,
  type CollectionView,
  type Item,
} from '@/lib/db';
import {
  matchesGenreFilter,
  matchesMediaName,
  matchesMediaTypeFilter,
  matchesReleaseFilter,
  matchesStatusFilter,
  matchesDateRules,
  releaseDateOf,
} from '@/lib/media-search';
import { catalogKey, sortEntries } from '@/lib/media-sort';
import { mediaTypeLabel } from '@/lib/status-labels';

const ExploreEntry = memo(function ExploreEntry({
  item,
  view,
}: {
  item: CatalogItem;
  view: CollectionView;
}) {
  return (
    <Link href={{ pathname: '/catalog/[id]', params: { id: String(item.id) } }} asChild>
      <Pressable>
        {view === 'list' ? (
          <MediaRow
            title={item.title}
            subtitle={mediaTypeLabel(item.mediaType, item.mangaOrigin)}
            coverImageUrl={item.coverImageUrl}
          />
        ) : (
          <MediaPoster title={item.title} coverImageUrl={item.coverImageUrl} />
        )}
      </Pressable>
    </Link>
  );
});

export default function ExploreScreen() {
  const { query, browse } = useMediaQuery();
  const { filter, sort, statusFilter, releaseFilter, genreFilter, dateRules } = browse.explore;
  const deferredQuery = useDeferredValue(query);
  const { exploreView } = useAppSettings();
  const [items, setItems] = useState<CatalogItem[] | null>(() => peekCatalogItems());
  const [libraryByKey, setLibraryByKey] = useState<Map<string, Item>>(() => new Map());
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      Promise.all([getCatalogItems(), getItems()])
        .then(([rows, libraryRows]) => {
          if (!cancelled) {
            setItems(rows);
            setLibraryByKey(new Map(libraryRows.map((row) => [catalogKey(row), row])));
            setError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load catalog');
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const sections = useMemo(() => {
    const visibleItems = sortEntries(
      (items ?? []).filter(
        (item) =>
          matchesMediaName(item.title, deferredQuery) &&
          matchesMediaTypeFilter(item, filter) &&
          matchesStatusFilter(libraryByKey.get(catalogKey(item))?.status, statusFilter) &&
          matchesReleaseFilter(item.releaseStatus, releaseFilter) &&
          matchesGenreFilter(item.genres, genreFilter) &&
          matchesDateRules(releaseDateOf(item), dateRules),
      ),
      sort,
      (item) => ({ title: item.title, catalog: item, library: libraryByKey.get(catalogKey(item)) }),
    );

    return CATALOG_SECTIONS.map((section) => ({
      ...section,
      items: visibleItems
        .filter((item) => {
          if (!section.types.includes(item.mediaType)) {
            return false;
          }

          if (!section.origin) {
            return true;
          }

          return (item.mangaOrigin ?? 'american') === section.origin;
        })
        .slice(0, CATALOG_SECTION_LIMIT),
    })).filter((section) => section.items.length > 0);
  }, [
    deferredQuery,
    filter,
    genreFilter,
    items,
    libraryByKey,
    releaseFilter,
    sort,
    statusFilter,
    dateRules,
  ]);

  const emptyState = (
    <View style={{ gap: 8 }}>
      {error ? <Text>{error}</Text> : null}
      <Text>
        {items == null
          ? 'Loading…'
          : items.length === 0
            ? 'No catalog titles yet.'
            : 'No matching titles.'}
      </Text>
    </View>
  );

  return (
    <Screen>
      <ExploreSearchHeader />
      {exploreView === 'list' ? (
        <SectionList
          sections={sections.map((section) => ({ ...section, data: section.items }))}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ExploreEntry item={item} view="list" />}
          renderSectionHeader={({ section }) => (
            <SectionTitle title={section.title} first={section.id === sections[0]?.id} />
          )}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={emptyState}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          windowSize={7}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.id}
          renderItem={({ item: section }) => <PosterSection section={section} />}
          ItemSeparatorComponent={SectionSeparator}
          ListEmptyComponent={emptyState}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={4}
          windowSize={5}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </Screen>
  );
}

type ExploreSection = (typeof CATALOG_SECTIONS)[number] & { items: CatalogItem[] };

const POSTER_STRIDE = 120 + 12;

function SectionTitle({ title, first }: { title: string; first: boolean }) {
  return <Text style={{ fontSize: 18, marginTop: first ? 0 : 20, marginBottom: 10 }}>{title}</Text>;
}

function RowSeparator() {
  return <View style={{ height: 8 }} />;
}

function SectionSeparator() {
  return <View style={{ height: 20 }} />;
}

function PosterSeparator() {
  return <View style={{ width: 12 }} />;
}

const PosterSection = memo(function PosterSection({ section }: { section: ExploreSection }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 18 }}>{section.title}</Text>
      <FlatList
        horizontal
        data={section.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ExploreEntry item={item} view="card" />}
        ItemSeparatorComponent={PosterSeparator}
        getItemLayout={(_, index) => ({ length: POSTER_STRIDE, offset: POSTER_STRIDE * index, index })}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={3}
        contentContainerStyle={{ paddingRight: 4 }}
      />
    </View>
  );
});
