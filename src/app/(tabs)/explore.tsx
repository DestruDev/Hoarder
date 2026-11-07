import { Link, useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, SectionList, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { MediaPoster, MediaRow } from '@/components/media-cover';
import { ExploreSearchHeader, useMediaQuery } from '@/components/media-search';
import { useSyncRefreshControl } from '@/components/sync-refresh-control';
import { Screen, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import {
  CATALOG_SECTION_LIMIT,
  CATALOG_SECTIONS,
  SEARCH_SECTIONS,
  type CatalogSection,
} from '@/lib/catalog-sections';
import { hydrateSearchEntry } from '@/lib/catalog-sources/search';
import {
  getCatalogItems,
  getItems,
  peekCatalogItems,
  saveCatalogEntry,
  type CatalogItem,
  type CollectionView,
  type Item,
  type NewCatalogItem,
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
import { useDataVersion } from '@/lib/sync';
import { useRemoteSearch } from '@/lib/use-remote-search';

// A row in Explore: a saved catalog row, or an online search result that gets saved
// to the catalog when opened.
type ExploreItem = {
  key: string;
  media: NewCatalogItem;
  catalogId?: number;
};

type RemoteOpener = {
  prefetch: (entry: ExploreItem) => Promise<number | null>;
  open: (entry: ExploreItem) => void;
};

function sourceKey(media: NewCatalogItem): string | null {
  return media.source && media.externalId ? `${media.source}:${media.externalId}` : null;
}

function inSection(section: CatalogSection, media: NewCatalogItem): boolean {
  if (!section.types.includes(media.mediaType)) {
    return false;
  }

  return !section.origin || (media.mangaOrigin ?? 'american') === section.origin;
}

// Saves a search result (with its full details) to the catalog and opens its page.
// The save starts on touch-down so it's usually done by the time the press ends.
function useRemoteOpener(): RemoteOpener {
  const router = useRouter();
  const pending = useRef(new Map<string, Promise<number | null>>());
  const opening = useRef(false);

  const prefetch = useCallback((entry: ExploreItem) => {
    let saved = pending.current.get(entry.key);
    if (!saved) {
      saved = hydrateSearchEntry(entry.media)
        .then(saveCatalogEntry)
        .then((row) => row.id)
        .catch((reason: unknown) => {
          pending.current.delete(entry.key);
          console.warn('[Hoarder search] open failed:', reason);
          return null;
        });
      pending.current.set(entry.key, saved);
    }
    return saved;
  }, []);

  const open = useCallback(
    (entry: ExploreItem) => {
      if (opening.current) {
        return;
      }

      opening.current = true;
      prefetch(entry)
        .then((id) => {
          if (id != null) {
            router.push({ pathname: '/catalog/[id]', params: { id: String(id), title: entry.media.title } });
          }
        })
        .finally(() => {
          // Save fresh next time; a debug reset may have cleared the catalog meanwhile.
          pending.current.delete(entry.key);
          opening.current = false;
        });
    },
    [prefetch, router],
  );

  return useMemo(() => ({ prefetch, open }), [prefetch, open]);
}

const ExploreEntry = memo(function ExploreEntry({
  entry,
  view,
  opener,
}: {
  entry: ExploreItem;
  view: CollectionView;
  opener: RemoteOpener;
}) {
  const { media, catalogId } = entry;
  const content =
    view === 'list' ? (
      <MediaRow
        title={media.title}
        subtitle={mediaTypeLabel(media.mediaType, media.mangaOrigin)}
        coverImageUrl={media.coverImageUrl}
      />
    ) : (
      <MediaPoster title={media.title} coverImageUrl={media.coverImageUrl} />
    );

  if (catalogId == null) {
    return (
      <Pressable
        onPressIn={() => void opener.prefetch(entry)}
        onPress={() => opener.open(entry)}
        accessibilityRole="button"
        accessibilityLabel={media.title}>
        {content}
      </Pressable>
    );
  }

  return (
    <Link href={{ pathname: '/catalog/[id]', params: { id: String(catalogId), title: media.title } }} asChild>
      <Pressable>{content}</Pressable>
    </Link>
  );
});

export default function ExploreScreen() {
  const colors = useColors();
  const { query, browse } = useMediaQuery();
  const { filter, sort, statusFilter, releaseFilter, genreFilter, dateRules } = browse.explore;
  const deferredQuery = useDeferredValue(query);
  const { exploreView } = useAppSettings();
  const [items, setItems] = useState<CatalogItem[] | null>(() => peekCatalogItems());
  const [libraryByKey, setLibraryByKey] = useState<Map<string, Item>>(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const searching = deferredQuery.trim().length > 0;
  const remote = useRemoteSearch(deferredQuery, filter);
  const opener = useRemoteOpener();

  // Library status reloads on every write, even while hidden behind a pushed
  // screen, so it's current before the back animation ends and focus fires.
  const dataVersion = useDataVersion();
  const refreshControl = useSyncRefreshControl();
  useEffect(() => {
    let cancelled = false;

    getItems()
      .then((libraryRows) => {
        if (!cancelled) {
          setLibraryByKey(new Map(libraryRows.map((row) => [catalogKey(row), row])));
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
  }, [dataVersion]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      getCatalogItems()
        .then((rows) => {
          if (!cancelled) {
            setItems(rows);
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
    const libraryStatus = (media: NewCatalogItem) => libraryByKey.get(catalogKey(media))?.status;
    const passesFilters = (media: NewCatalogItem) =>
      matchesMediaTypeFilter(media, filter) &&
      matchesStatusFilter(libraryStatus(media), statusFilter) &&
      matchesReleaseFilter(media.releaseStatus, releaseFilter) &&
      matchesGenreFilter(media.genres, genreFilter) &&
      matchesDateRules(releaseDateOf(media), dateRules);

    // Without a search, only chart rows; titles saved from search or Related stay
    // findable but don't crowd the charts.
    const visibleItems = sortEntries(
      (items ?? []).filter(
        (item) =>
          (searching || item.featured) &&
          matchesMediaName(item.title, deferredQuery) &&
          passesFilters(item),
      ),
      sort,
      (item) => ({ title: item.title, catalog: item, library: libraryByKey.get(catalogKey(item)) }),
    );

    const localKeys = new Set<string>();
    for (const item of visibleItems) {
      localKeys.add(catalogKey(item));
      const id = sourceKey(item);
      if (id) {
        localKeys.add(id);
      }
    }

    // Online results go after local matches, in the order the APIs ranked them.
    const remoteItems = searching
      ? remote.items.filter((media) => {
          const id = sourceKey(media);
          return (
            !localKeys.has(catalogKey(media)) && !(id && localKeys.has(id)) && passesFilters(media)
          );
        })
      : [];

    return (searching ? SEARCH_SECTIONS : CATALOG_SECTIONS)
      .map((section) => ({
        ...section,
        items: [
          ...visibleItems
            .filter((item) => inSection(section, item))
            .slice(0, CATALOG_SECTION_LIMIT)
            .map((item): ExploreItem => ({ key: String(item.id), media: item, catalogId: item.id })),
          ...remoteItems
            .filter((media) => inSection(section, media))
            .map((media): ExploreItem => ({
              key: `remote:${sourceKey(media) ?? catalogKey(media)}`,
              media,
            })),
        ],
      }))
      .filter((section) => section.items.length > 0);
  }, [
    deferredQuery,
    filter,
    genreFilter,
    items,
    libraryByKey,
    releaseFilter,
    remote.items,
    searching,
    sort,
    statusFilter,
    dateRules,
  ]);

  let searchStatus: ReactNode = null;
  if (searching && remote.loading) {
    searchStatus = <Text style={{ color: colors.textMuted, marginTop: 16 }}>Searching online…</Text>;
  } else if (searching && remote.failed.length > 0) {
    searchStatus = (
      <Text style={{ color: colors.textMuted, marginTop: 16 }}>
        {`Couldn't reach ${remote.failed.join(', ')}. Some results may be missing.`}
      </Text>
    );
  }

  const emptyState = (
    <View style={{ gap: 8 }}>
      {error ? <Text>{error}</Text> : null}
      <Text>
        {items == null
          ? 'Loading…'
          : searching && remote.loading
            ? 'Searching…'
            : items.length === 0 && !searching
              ? 'No catalog titles yet.'
              : 'No matching titles.'}
      </Text>
    </View>
  );

  const footer = sections.length > 0 ? searchStatus : null;

  return (
    <Screen>
      <ExploreSearchHeader />
      {exploreView === 'list' ? (
        <SectionList
          sections={sections.map((section) => ({ ...section, data: section.items }))}
          keyExtractor={(entry) => entry.key}
          renderItem={({ item }) => <ExploreEntry entry={item} view="list" opener={opener} />}
          renderSectionHeader={({ section }) => (
            <SectionTitle title={section.title} first={section.id === sections[0]?.id} />
          )}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={emptyState}
          ListFooterComponent={footer}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          initialNumToRender={8}
          windowSize={7}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.id}
          renderItem={({ item: section }) => <PosterSection section={section} opener={opener} />}
          ItemSeparatorComponent={SectionSeparator}
          ListEmptyComponent={emptyState}
          ListFooterComponent={footer}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          initialNumToRender={4}
          windowSize={5}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        />
      )}
    </Screen>
  );
}

type ExploreSection = CatalogSection & { items: ExploreItem[] };

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

const PosterSection = memo(function PosterSection({
  section,
  opener,
}: {
  section: ExploreSection;
  opener: RemoteOpener;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 18 }}>{section.title}</Text>
      <FlatList
        horizontal
        data={section.items}
        keyExtractor={(entry) => entry.key}
        renderItem={({ item }) => <ExploreEntry entry={item} view="card" opener={opener} />}
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
