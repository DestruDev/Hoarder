import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/themed';
import { colors } from '@/constants/theme';
import { COMIC_ORIGINS, deleteItem, ITEM_STATUSES, isChapteredMediaType, isComicMediaType, isPagedMediaType, isShowMediaType, updateItem, type ComicOrigin, type Item, type ItemStatus } from '@/lib/db';
import { COMIC_ORIGIN_LABELS, STATUS_LABELS } from '@/lib/status-labels';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function toDateInput(value?: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function parseDate(value: string, label: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${label} must be a valid date`);
  }

  return parsed.toISOString();
}

function parseOptionalDate(value: string, label: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return parseDate(value, label);
}

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

export function ItemActionsMenu({
  item,
  onItemChange,
  onRemoved,
}: {
  item: Item;
  onItemChange: (item: Item) => void;
  onRemoved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [mangaOrigin, setMangaOrigin] = useState<ComicOrigin>(item.mangaOrigin ?? 'american');
  const [score, setScore] = useState<number | null>(item.rating);
  const [currentEpisodes, setCurrentEpisodes] = useState(
    item.currentEpisodes != null ? String(item.currentEpisodes) : '',
  );
  const [currentPages, setCurrentPages] = useState(
    item.currentPages != null ? String(item.currentPages) : '',
  );
  const [totalPages, setTotalPages] = useState(
    item.totalPages != null ? String(item.totalPages) : '',
  );
  const [currentChapters, setCurrentChapters] = useState(
    item.currentChapters != null ? String(item.currentChapters) : '',
  );
  const [totalChapters, setTotalChapters] = useState(
    item.totalChapters != null ? String(item.totalChapters) : '',
  );
  const [startDate, setStartDate] = useState(toDateInput(item.dateAdded));
  const [finishDate, setFinishDate] = useState(toDateInput(item.finishDate));
  const [notes, setNotes] = useState(item.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function openEdit() {
    setStatus(item.status);
    setMangaOrigin(item.mangaOrigin ?? 'american');
    setScore(item.rating);
    setCurrentEpisodes(item.currentEpisodes != null ? String(item.currentEpisodes) : '');
    setCurrentPages(item.currentPages != null ? String(item.currentPages) : '');
    setTotalPages(item.totalPages != null ? String(item.totalPages) : '');
    setCurrentChapters(item.currentChapters != null ? String(item.currentChapters) : '');
    setTotalChapters(item.totalChapters != null ? String(item.totalChapters) : '');
    setStartDate(toDateInput(item.dateAdded));
    setFinishDate(toDateInput(item.finishDate));
    setNotes(item.notes ?? '');
    setError(null);
    setMenuOpen(false);
    setEditOpen(true);
  }

  function closeEdit() {
    if (saving) {
      return;
    }

    setEditOpen(false);
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = await updateItem(item.id, {
        status,
        rating: score,
        notes: notes.trim() || null,
        dateAdded: parseDate(startDate, 'Start date'),
        finishDate: parseOptionalDate(finishDate, 'Finish date'),
        mangaOrigin: isComicMediaType(item.mediaType) ? mangaOrigin : null,
        currentEpisodes: isShowMediaType(item.mediaType)
          ? parseWholeNumber(currentEpisodes, 'Episodes watched')
          : null,
        currentPages: isPagedMediaType(item.mediaType, mangaOrigin)
          ? parseWholeNumber(currentPages, 'Pages read')
          : null,
        totalPages: isPagedMediaType(item.mediaType, mangaOrigin)
          ? parseWholeNumber(totalPages, 'Total pages')
          : null,
        currentChapters: isChapteredMediaType(item.mediaType, mangaOrigin)
          ? parseWholeNumber(currentChapters, 'Chapters read')
          : null,
        totalChapters: isChapteredMediaType(item.mediaType, mangaOrigin)
          ? parseWholeNumber(totalChapters, 'Total chapters')
          : null,
      });

      if (!saved) {
        throw new Error('Failed to save changes');
      }

      onItemChange(saved);
      setEditOpen(false);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (removing) {
      return;
    }

    setRemoving(true);
    setMenuOpen(false);

    try {
      await deleteItem(item.id);
      onRemoved();
    } catch {
      setRemoving(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={openMenu}
        hitSlop={8}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <MaterialIcons name="more-horiz" size={24} color={colors.text} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={closeMenu}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: insets.top + 44,
              right: 12,
              minWidth: 168,
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
            <Pressable onPress={openEdit} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text>Edit</Text>
            </Pressable>
            <Pressable
              onPress={handleRemove}
              disabled={removing}
              style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text style={{ color: colors.danger }}>{removing ? 'Removing…' : 'Remove'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            onPress={closeEdit}
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
              maxHeight: '88%',
              backgroundColor: colors.inputBackground,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderColor: colors.border,
              borderWidth: 1,
              borderBottomWidth: 0,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 16),
            }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
              <Text style={{ fontSize: 18 }}>Edit</Text>

              <Text style={{ color: colors.textMuted }}>Status</Text>
              {ITEM_STATUSES.map((value) => {
                const isSelected = status === value;

                return (
                  <Pressable
                    key={value}
                    onPress={() => setStatus(value)}
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
                    <Text style={{ flex: 1 }}>{STATUS_LABELS[value]}</Text>
                    {isSelected ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
                  </Pressable>
                );
              })}

              <Text style={{ color: colors.textMuted, marginTop: 6 }}>Start Date</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={{ color: colors.textMuted, marginTop: 6 }}>Finish Date</Text>
              <TextInput
                value={finishDate}
                onChangeText={setFinishDate}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {isComicMediaType(item.mediaType) ? (
                <>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>Type</Text>
                  {COMIC_ORIGINS.map((value) => {
                    const isSelected = mangaOrigin === value;

                    return (
                      <Pressable
                        key={value}
                        onPress={() => setMangaOrigin(value)}
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
                        <Text style={{ flex: 1 }}>{COMIC_ORIGIN_LABELS[value]}</Text>
                        {isSelected ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
                      </Pressable>
                    );
                  })}
                </>
              ) : null}

              {isShowMediaType(item.mediaType) ? (
                <>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>Episodes</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={currentEpisodes}
                      onChangeText={setCurrentEpisodes}
                      placeholder="watched"
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                    <Text style={{ color: colors.textMuted }}>/</Text>
                    <Text style={{ minWidth: 40 }}>{item.totalEpisodes ?? '—'}</Text>
                  </View>
                </>
              ) : null}

              {isPagedMediaType(item.mediaType, mangaOrigin) ? (
                <>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>Pages</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={currentPages}
                      onChangeText={setCurrentPages}
                      placeholder="read"
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                    <Text style={{ color: colors.textMuted }}>/</Text>
                    <TextInput
                      value={totalPages}
                      onChangeText={setTotalPages}
                      placeholder="total"
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : null}

              {isChapteredMediaType(item.mediaType, mangaOrigin) ? (
                <>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>Chapters</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={currentChapters}
                      onChangeText={setCurrentChapters}
                      placeholder="read"
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                    <Text style={{ color: colors.textMuted }}>/</Text>
                    <TextInput
                      value={totalChapters}
                      onChangeText={setTotalChapters}
                      placeholder="total"
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : null}

              <Text style={{ color: colors.textMuted, marginTop: 6 }}>Score</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SCORES.map((value) => {
                  const isSelected = score === value;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => setScore(isSelected ? null : value)}
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

              <Text style={{ color: colors.textMuted, marginTop: 6 }}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes"
                multiline
                style={{ minHeight: 96, textAlignVertical: 'top' }}
              />

              {error ? <Text>{error}</Text> : null}

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={{
                  marginTop: 6,
                  backgroundColor: colors.searchBarBackground,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: saving ? 0.5 : 1,
                }}>
                <Text>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
