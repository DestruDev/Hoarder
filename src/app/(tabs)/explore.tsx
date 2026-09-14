import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaSearch } from '@/components/media-search';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { getCatalogItems, type CatalogItem, type MediaType } from '@/lib/db';
import { matchesMediaName } from '@/lib/media-search';

const TRENDING_SECTIONS: { id: string; title: string; types: MediaType[] }[] = [
  { id: 'tv', title: 'Trending TV', types: ['tv'] },
  { id: 'game', title: 'Trending Games', types: ['game'] },
  { id: 'anime', title: 'Trending Anime', types: ['anime'] },
  { id: 'manga-manhwa', title: 'Trending Manga / Manhwa', types: ['manga', 'manhwa'] },
  { id: 'book', title: 'Trending Books', types: ['book'] },
];

export default function ExploreScreen() {
  const { query } = useMediaSearch();
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
  const sections = TRENDING_SECTIONS.map((section) => ({
    ...section,
    items: visibleItems.filter((item) => section.types.includes(item.mediaType)),
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
            {section.items.map((item) => (
              <Link
                key={item.id}
                href={{ pathname: '/catalog/[id]', params: { id: String(item.id) } }}
                asChild>
                <Pressable>
                  <View>
                    <Text>{item.title}</Text>
                    <Text style={{ color: colors.textMuted }}>{item.mediaType}</Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        ))
      )}
    </ScreenScrollView>
  );
}
