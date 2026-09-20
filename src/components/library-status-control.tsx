import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  addCatalogItemToLibrary,
  ITEM_STATUSES,
  isChapteredMediaType,
  isPagedMediaType,
  isShowMediaType,
  updateItem,
  type CatalogItem,
  type Item,
  type ItemStatus,
} from '@/lib/db';
import { STATUS_LABELS } from '@/lib/status-labels';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type QuickEdit = 'status' | 'progress' | 'score';

type LibraryMedia = Pick<
  CatalogItem,
  'title' | 'mediaType' | 'coverImageUrl' | 'releaseStatus' | 'mangaOrigin' | 'totalEpisodes' | 'totalPages' | 'totalChapters'
>;

function parseWholeNumber(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== trimmed) {
    throw new Error(`${label} must be a whole number`);
  }

  return parsed;
}

const STATUS_BUTTON_LABELS: Record<ItemStatus, string> = {
  in_progress: 'IN PROGRESS',
  revisiting: 'REVISITING',
  completed: 'COMPLETED',
  on_hold: 'ON HOLD',
  dropped: 'DROPPED',
  planning: 'PLAN TO START',
};

function progressUnitLabel(tracksEpisodes: boolean, tracksChapters: boolean, tracksPages: boolean) {
  if (tracksEpisodes) {
    return 'EP';
  }

  if (tracksChapters) {
    return 'CH';
  }

  if (tracksPages) {
    return 'PG';
  }

  return null;
}

function QuickButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.searchBarBackground,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
      }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{ textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

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
  const [open, setOpen] = useState<QuickEdit | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | null>(libraryItem?.status ?? null);
  const [selectedScore, setSelectedScore] = useState<number | null>(libraryItem?.rating ?? null);
  const [progress, setProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = libraryItem?.mangaOrigin ?? media.mangaOrigin;
  const tracksEpisodes = isShowMediaType(media.mediaType);
  const tracksPages = isPagedMediaType(media.mediaType, origin);
  const tracksChapters = isChapteredMediaType(media.mediaType, origin);
  const tracksProgress = tracksEpisodes || tracksPages || tracksChapters;
  const totalProgress = tracksEpisodes
    ? (media.totalEpisodes ?? libraryItem?.totalEpisodes)
    : tracksChapters
      ? (libraryItem?.totalChapters ?? media.totalChapters)
      : (libraryItem?.totalPages ?? media.totalPages);

  function currentProgressValue() {
    if (!libraryItem) {
      return '';
    }

    if (tracksEpisodes) {
      return libraryItem.currentEpisodes != null ? String(libraryItem.currentEpisodes) : '';
    }

    if (tracksChapters) {
      return libraryItem.currentChapters != null ? String(libraryItem.currentChapters) : '';
    }

    if (tracksPages) {
      return libraryItem.currentPages != null ? String(libraryItem.currentPages) : '';
    }

    return '';
  }

  function openModal(edit: QuickEdit) {
    setSelectedStatus(libraryItem?.status ?? null);
    setSelectedScore(libraryItem?.rating ?? null);
    setProgress(currentProgressValue());
    setError(null);
    setOpen(edit);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setOpen(null);
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    if (open === 'status' && !selectedStatus) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let saved: Item | undefined;

      if (open === 'status' && selectedStatus) {
        const total = totalProgress ?? null;
        const completedProgress =
          selectedStatus === 'completed' && tracksProgress && total != null
            ? tracksEpisodes
              ? { currentEpisodes: total }
              : tracksChapters
                ? { currentChapters: total }
                : { currentPages: total }
            : {};

        saved = libraryItem
          ? await updateItem(libraryItem.id, { status: selectedStatus, ...completedProgress })
          : await addCatalogItemToLibrary(media, selectedStatus);

        if (!libraryItem && saved && total != null && tracksProgress) {
          saved = await updateItem(saved.id, completedProgress);
        }
      } else if (open === 'score') {
        const item = libraryItem ?? (await addCatalogItemToLibrary(media, 'planning'));
        saved = await updateItem(item.id, { rating: selectedScore });
      } else if (open === 'progress' && tracksProgress) {
        const parsed = parseWholeNumber(
          progress,
          tracksEpisodes ? 'Episodes watched' : tracksChapters ? 'Chapters read' : 'Pages read',
        );
        const item = libraryItem ?? (await addCatalogItemToLibrary(media, 'planning'));

        saved = await updateItem(item.id, {
          currentEpisodes: tracksEpisodes ? parsed : item.currentEpisodes,
          currentChapters: tracksChapters ? parsed : item.currentChapters,
          currentPages: tracksPages ? parsed : item.currentPages,
        });
      }

      if (!saved) {
        throw new Error('Failed to save changes');
      }

      onLibraryItemChange(saved);
      setOpen(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  const title =
    open === 'progress' ? 'Progress' : open === 'score' ? 'Score' : 'Library status';
  const canSave =
    open === 'status'
      ? Boolean(selectedStatus)
      : open === 'progress'
        ? tracksProgress
        : open === 'score';

  const unit = progressUnitLabel(tracksEpisodes, tracksChapters, tracksPages);
  const currentProgress = tracksEpisodes
    ? libraryItem?.currentEpisodes
    : tracksChapters
      ? libraryItem?.currentChapters
      : tracksPages
        ? libraryItem?.currentPages
        : null;
  const statusLabel = libraryItem ? STATUS_BUTTON_LABELS[libraryItem.status] : 'ADD TO LIB';
  const progressLabel = !unit
    ? '-/-'
    : !libraryItem
      ? `-/- ${unit}`
      : libraryItem.status === 'completed' && (totalProgress ?? currentProgress) != null
        ? `${totalProgress ?? currentProgress}/${totalProgress ?? currentProgress} ${unit}`
        : `${currentProgress ?? '-'}/${totalProgress ?? '-'} ${unit}`;
  const scoreLabel = libraryItem?.rating != null ? `${libraryItem.rating}/10` : 'UNSCORED';

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <QuickButton label={statusLabel} onPress={() => openModal('status')} />
        <QuickButton label={progressLabel} onPress={() => openModal('progress')} />
        <QuickButton label={scoreLabel} onPress={() => openModal('score')} />
      </View>

      <Modal visible={open != null} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            <Text style={{ fontSize: 18 }}>{title}</Text>

            {open === 'status'
              ? ITEM_STATUSES.map((status) => {
                  const isSelected = selectedStatus === status;

                  return (
                    <Pressable
                      key={status}
                      onPress={() => setSelectedStatus(status)}
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
                })
              : null}

            {open === 'progress' ? (
              tracksProgress ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={progress}
                    onChangeText={setProgress}
                    placeholder={tracksEpisodes ? 'watched' : 'read'}
                    keyboardType="number-pad"
                    style={{ flex: 1 }}
                  />
                  <Text style={{ color: colors.textMuted }}>/</Text>
                  <Text style={{ minWidth: 40 }}>{totalProgress ?? '—'}</Text>
                </View>
              ) : (
                <Text style={{ color: colors.textMuted }}>No progress tracking for this type.</Text>
              )
            ) : null}

            {open === 'score' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SCORES.map((value) => {
                  const isSelected = selectedScore === value;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => setSelectedScore(isSelected ? null : value)}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? colors.searchBarBackground : colors.background,
                        borderColor: isSelected ? colors.text : colors.border,
                        borderWidth: 1,
                        borderRadius: 10,
                      }}>
                      <Text>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {error ? <Text>{error}</Text> : null}

            <Pressable
              onPress={handleSave}
              disabled={!canSave || saving}
              style={{
                marginTop: 6,
                backgroundColor: colors.searchBarBackground,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: !canSave || saving ? 0.5 : 1,
              }}>
              <Text>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
