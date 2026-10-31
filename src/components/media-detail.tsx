import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { ItemActionsMenu } from '@/components/item-actions-menu';
import { LibraryStatusControl } from '@/components/library-status-control';
import { MediaCover } from '@/components/media-cover';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { isChapteredMediaType, isPagedMediaType, isShowMediaType, type CatalogItem, type Item } from '@/lib/db';
import { creatorLabel, mediaTypeLabel, RELEASE_STATUS_LABELS } from '@/lib/status-labels';

export type MediaDetails = Pick<
  CatalogItem,
  | 'title'
  | 'mediaType'
  | 'coverImageUrl'
  | 'releaseStatus'
  | 'mangaOrigin'
  | 'totalEpisodes'
  | 'totalPages'
  | 'totalChapters'
  | 'globalRating'
  | 'season'
  | 'genres'
  | 'creator'
  | 'synopsis'
>;

export function MediaDetail({
  media,
  libraryItem,
  onLibraryItemChange,
  onRemoved,
}: {
  media: MediaDetails;
  libraryItem?: Item;
  onLibraryItemChange: (item: Item | undefined) => void;
  onRemoved: () => void;
}) {
  const totalEpisodes = media.totalEpisodes ?? libraryItem?.totalEpisodes;
  const totalPages = libraryItem?.totalPages ?? media.totalPages;
  const totalChapters = libraryItem?.totalChapters ?? media.totalChapters;
  const { width } = useWindowDimensions();
  const [showFullTitle, setShowFullTitle] = useState(false);

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Stack.Screen
        options={{
          title: media.title,
          headerTitle: () => (
            <Pressable
              onPress={() => setShowFullTitle((shown) => !shown)}
              accessibilityRole="button"
              accessibilityLabel={media.title}
              accessibilityHint="Shows the full title"
              hitSlop={8}
              style={{ maxWidth: width - 160 }}>
              <Text
                numberOfLines={showFullTitle ? 3 : 1}
                adjustsFontSizeToFit={showFullTitle}
                minimumFontScale={0.6}
                style={{
                  fontSize: showFullTitle ? 14 : 17,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                {media.title}
              </Text>
            </Pressable>
          ),
          headerRight: libraryItem
            ? () => (
                <ItemActionsMenu
                  item={libraryItem}
                  onRemoved={() => {
                    onLibraryItemChange(undefined);
                    onRemoved();
                  }}
                />
              )
            : () => null,
        }}
      />
      <View style={{ alignItems: 'center' }}>
        <MediaCover uri={media.coverImageUrl} width={140} height={200} />
      </View>
      <LibraryStatusControl
        media={media}
        libraryItem={libraryItem}
        onLibraryItemChange={onLibraryItemChange}
      />
      <Text>Type: {mediaTypeLabel(media.mediaType, media.mangaOrigin)}</Text>
      <Text>Season: {media.season ?? '—'}</Text>
      <Text>Genres: {media.genres ?? '—'}</Text>
      <Text>
        {creatorLabel(media.mediaType)}: {media.creator ?? '—'}
      </Text>
      {isShowMediaType(media.mediaType) ? (
        <Text>
          Status: {media.releaseStatus ? RELEASE_STATUS_LABELS[media.releaseStatus] : '—'}
        </Text>
      ) : null}
      {isShowMediaType(media.mediaType) ? (
        <Text>Episodes: {totalEpisodes ?? '—'}</Text>
      ) : null}
      {isChapteredMediaType(media.mediaType, media.mangaOrigin) ? (
        <Text>Chapters: {totalChapters ?? '—'}</Text>
      ) : null}
      {isPagedMediaType(media.mediaType, media.mangaOrigin) ? (
        <Text>Pages: {totalPages ?? '—'}</Text>
      ) : null}
      <Text>
        Global rating:{' '}
        {media.globalRating != null ? `${Math.round(media.globalRating * 10)}%` : '—'}
      </Text>
      {media.synopsis ? (
        <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{media.synopsis}</Text>
      ) : null}
    </ScreenScrollView>
  );
}
