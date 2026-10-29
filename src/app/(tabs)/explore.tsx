import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { MediaPoster, MediaRow } from '@/components/media-cover';
import { useMediaSearch } from '@/components/media-search';
import { ScreenScrollView, Text } from '@/components/themed';
import { CATALOG_SECTION_LIMIT, CATALOG_SECTIONS } from '@/lib/catalog-sections';
import { getCatalogItems, type CatalogItem } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';
import { mediaTypeLabel } from '@/lib/status-labels';

export default function ExploreScreen() {
  const { query } = useMediaSearch();
  const { exploreView } = useAppSettings();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const visibleItems = items.filter((item) => matchesMediaName(item.title, query));
  const sections = CATALOG_SECTIONS.map((section) => ({
    ...section,
    items: visibleItems.filter((item) => {
      if (!section.types.includes(item.mediaType)) {
        return false;
      }

      if (!section.origin) {
        return true;
      }

      return (item.mangaOrigin ?? 'american') === section.origin;
    }).slice(0, CATALOG_SECTION_LIMIT),
  })).filter((section) => section.items.length > 0);

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 20 }}>
      {error ? <Text>{error}</Text> : null}

      {items.length === 0 ? (
        <Text>No catalog titles yet.</Text>
      ) : sections.length === 0 ? (
        <Text>No matching titles.</Text>
      ) : (
        sections.map((section) => (
          <View key={section.id} style={{ gap: 10 }}>
            <Text style={{ fontSize: 18 }}>{section.title}</Text>
            {exploreView === 'list' ? (
              <View style={{ gap: 8 }}>
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={{ pathname: '/catalog/[id]', params: { id: String(item.id) } }}
                    asChild>
                    <Pressable>
                      <MediaRow
                        title={item.title}
                        subtitle={mediaTypeLabel(item.mediaType, item.mangaOrigin)}
                        coverImageUrl={item.coverImageUrl}
                      />
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={{ pathname: '/catalog/[id]', params: { id: String(item.id) } }}
                    asChild>
                    <Pressable>
                      <MediaPoster title={item.title} coverImageUrl={item.coverImageUrl} />
                    </Pressable>
                  </Link>
                ))}
              </ScrollView>
            )}
          </View>
        ))
      )}
    </ScreenScrollView>
  );
}
