import { Stack } from 'expo-router';

import { ItemActionsMenu } from '@/components/item-actions-menu';
import { LibraryStatusControl } from '@/components/library-status-control';
import { MediaCover } from '@/components/media-cover';
import { ScreenScrollView, Text } from '@/components/themed';
import { isShowMediaType, type CatalogItem, type Item } from '@/lib/db';
import { RELEASE_STATUS_LABELS } from '@/lib/status-labels';

export type MediaDetails = Pick<CatalogItem, 'title' | 'mediaType' | 'coverImageUrl' | 'releaseStatus'>;

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
      <Text>Type: {media.mediaType}</Text>
      {isShowMediaType(media.mediaType) ? (
        <Text>
          Status: {media.releaseStatus ? RELEASE_STATUS_LABELS[media.releaseStatus] : '—'}
        </Text>
      ) : null}
      <Text>Rating: {libraryItem?.rating ?? '—'}</Text>
      <Text>Notes: {libraryItem?.notes ?? '—'}</Text>
      <Text>Added: {libraryItem?.dateAdded ?? '—'}</Text>
      <LibraryStatusControl
        media={media}
        libraryItem={libraryItem}
        onLibraryItemChange={onLibraryItemChange}
      />
    </ScreenScrollView>
  );
}
