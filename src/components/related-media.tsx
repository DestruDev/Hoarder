import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { MediaPoster } from '@/components/media-cover';
import { Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { fetchRelatedMedia, type RelatedMedia, type RelatedSource } from '@/lib/catalog-sources/related';
import { findItemByTitleAndType, upsertCatalogItems, type NewCatalogItem } from '@/lib/db';

const POSTER_WIDTH = 100;
const POSTER_HEIGHT = 140;

function entryKey(entry: Pick<NewCatalogItem, 'title' | 'mediaType'>) {
  return `${entry.mediaType}:${entry.title.trim().toLowerCase()}`;
}

function sameTitle(a: Pick<NewCatalogItem, 'title' | 'mediaType'>, b: Pick<NewCatalogItem, 'title' | 'mediaType'>) {
  return a.mediaType === b.mediaType && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
}

export function RelatedMediaSection({ media }: { media: RelatedSource }) {
  const colors = useColors();
  const router = useRouter();
  const [related, setRelated] = useState<RelatedMedia[] | null>(null);
  const [opening, setOpening] = useState(false);
  const targets = useRef(new Map<string, Promise<Href | null>>());

  useEffect(() => {
    let cancelled = false;
    setRelated(null);

    fetchRelatedMedia(media).then((rows) => {
      if (!cancelled) {
        setRelated(rows);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.title, media.mediaType, media.mangaOrigin, media.season]);

  // Library entry if the user has it; otherwise save it to the catalog so it gets a
  // detail page they can add from.
  async function resolveTarget(entry: NewCatalogItem): Promise<Href | null> {
    const owned = await findItemByTitleAndType(entry.title, entry.mediaType);
    if (owned) {
      return { pathname: '/item/[id]', params: { id: String(owned.id), title: owned.title } };
    }

    const catalogRows = await upsertCatalogItems([entry]);
    const saved = catalogRows.find((row) => sameTitle(row, entry));
    return saved
      ? { pathname: '/catalog/[id]', params: { id: String(saved.id), title: saved.title } }
      : null;
  }

  // Start on touch-down so the lookup (and the next page's Related row) is under way
  // before the press is released.
  function prefetch(entry: NewCatalogItem): Promise<Href | null> {
    const key = entryKey(entry);
    let pending = targets.current.get(key);
    if (!pending) {
      pending = resolveTarget(entry).catch((reason: unknown) => {
        targets.current.delete(key);
        console.warn('[Hoarder related] open failed:', reason);
        return null;
      });
      targets.current.set(key, pending);
      void fetchRelatedMedia(entry);
    }
    return pending;
  }

  async function openRelated(entry: NewCatalogItem) {
    if (opening) {
      return;
    }

    setOpening(true);
    try {
      const href = await prefetch(entry);
      if (href) {
        router.push(href);
      }
    } finally {
      // Look it up fresh next time; the user may add or remove it from the library meanwhile.
      targets.current.delete(entryKey(entry));
      setOpening(false);
    }
  }

  if (related?.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: '600' }}>Related</Text>
      {related == null ? (
        <Text style={{ color: colors.textMuted }}>Loading...</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {related.map(({ relation, entry }) => (
            <Pressable
              key={entryKey(entry)}
              onPressIn={() => void prefetch(entry)}
              onPress={() => openRelated(entry)}
              accessibilityRole="button"
              accessibilityLabel={`${relation}: ${entry.title}`}
              style={{ width: POSTER_WIDTH, gap: 2 }}>
              <MediaPoster
                title={entry.title}
                coverImageUrl={entry.coverImageUrl}
                width={POSTER_WIDTH}
                height={POSTER_HEIGHT}
              />
              <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
                {relation}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
