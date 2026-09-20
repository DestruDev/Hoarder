import { Stack } from 'expo-router';

import { ItemActionsMenu } from '@/components/item-actions-menu';
import { LibraryStatusControl } from '@/components/library-status-control';
import { MediaCover } from '@/components/media-cover';
import { ScreenScrollView, Text } from '@/components/themed';
import { isShowMediaType, type CatalogItem, type Item } from '@/lib/db';
import { mediaTypeLabel, RELEASE_STATUS_LABELS } from '@/lib/status-labels';

export type MediaDetails = Pick<
  CatalogItem,
  'title' | 'mediaType' | 'coverImageUrl' | 'releaseStatus' | 'mangaOrigin' | 'totalEpisodes'
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
  const totalEpisodes = libraryItem?.totalEpisodes ?? media.totalEpisodes;

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Stack.Screen
        options={{
          title: media.title,
          headerRightContainerStyle: { justifyContent: 'center' },
          headerRight: libraryItem
            ? () => (
                <ItemActionsMenu
                  item={libraryItem}
                  onItemChange={onLibraryItemChange}
                  onRemoved={() => {
                    onLibraryItemChange(undefined);
                    onRemoved();
                  }}
                />
              )
            : () => null,
        }}
      />
      <MediaCover uri={media.coverImageUrl} width={140} height={200} />
      <Text>Title: {media.title}</Text>
      <Text>Type: {mediaTypeLabel(media.mediaType, media.mangaOrigin)}</Text>
      {isShowMediaType(media.mediaType) ? (
        <Text>
          Status: {media.releaseStatus ? RELEASE_STATUS_LABELS[media.releaseStatus] : '—'}
        </Text>
      ) : null}
      {isShowMediaType(media.mediaType) ? (
        <Text>Episodes: {totalEpisodes ?? '—'}</Text>
      ) : null}
      <Text>Rating: {libraryItem?.rating ?? '—'}</Text>
      <LibraryStatusControl
        media={media}
        libraryItem={libraryItem}
        onLibraryItemChange={onLibraryItemChange}
      />
    </ScreenScrollView>
  );
}
