import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  addCatalogItemToLibrary,
  ITEM_STATUSES,
  updateItem,
  type CatalogItem,
  type Item,
  type ItemStatus,
} from '@/lib/db';
import { STATUS_LABELS } from '@/lib/status-labels';

type LibraryMedia = Pick<CatalogItem, 'title' | 'mediaType' | 'coverImageUrl' | 'releaseStatus'>;

export function LibraryStatusControl({
  media,
  libraryItem,
  onLibraryItemChange,
}: {
  media: LibraryMedia;
  libraryItem?: Item;
  onLibraryItemChange: (item: Item) => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ItemStatus | null>(libraryItem?.status ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setSelected(libraryItem?.status ?? null);
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setOpen(false);
  }

  async function handleSave() {
    if (!selected || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = libraryItem
        ? await updateItem(libraryItem.id, { status: selected })
        : await addCatalogItemToLibrary(media, selected);

      if (!saved) {
        throw new Error('Failed to save status');
      }

      onLibraryItemChange(saved);
      setOpen(false);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={openModal}
        style={{
          marginTop: 8,
          backgroundColor: colors.searchBarBackground,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          alignItems: 'center',
        }}>
        <Text>{libraryItem ? STATUS_LABELS[libraryItem.status] : 'Add to library'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeModal}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
            <Text style={{ fontSize: 18 }}>Library status</Text>

            {ITEM_STATUSES.map((status) => {
              const isSelected = selected === status;

              return (
                <Pressable
                  key={status}
                  onPress={() => setSelected(status)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? colors.searchBarBackground : colors.background,
                    borderColor: isSelected ? colors.text : colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}>
                  <Text style={{ flex: 1 }}>{STATUS_LABELS[status]}</Text>
                  {isSelected ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
                </Pressable>
              );
            })}

            {error ? <Text>{error}</Text> : null}

            <Pressable
              onPress={handleSave}
              disabled={!selected || saving}
              style={{
                marginTop: 6,
                backgroundColor: colors.searchBarBackground,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: !selected || saving ? 0.5 : 1,
              }}>
              <Text>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
