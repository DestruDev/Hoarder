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
import { COMIC_ORIGINS, deleteItem, ITEM_STATUSES, isComicMediaType, isShowMediaType, RELEASE_STATUSES, updateItem, type ComicOrigin, type Item, type ItemStatus, type ReleaseStatus } from '@/lib/db';
import { COMIC_ORIGIN_LABELS, RELEASE_STATUS_LABELS, STATUS_LABELS } from '@/lib/status-labels';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function parseTotalEpisodes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== trimmed) {
    throw new Error('Total episodes must be a whole number');
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
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus | null>(item.releaseStatus);
  const [mangaOrigin, setMangaOrigin] = useState<ComicOrigin | null>(item.mangaOrigin);
  const [score, setScore] = useState<number | null>(item.rating);
  const [totalEpisodes, setTotalEpisodes] = useState(
    item.totalEpisodes != null ? String(item.totalEpisodes) : '',
  );
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
    setReleaseStatus(item.releaseStatus);
    setMangaOrigin(item.mangaOrigin);
    setScore(item.rating);
    setTotalEpisodes(item.totalEpisodes != null ? String(item.totalEpisodes) : '');
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
        releaseStatus: isShowMediaType(item.mediaType) ? releaseStatus : null,
        mangaOrigin: isComicMediaType(item.mediaType) ? mangaOrigin : null,
        totalEpisodes: isShowMediaType(item.mediaType) ? parseTotalEpisodes(totalEpisodes) : null,
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
                        <Text style={{ flex: 1 }}>{`Comic (${COMIC_ORIGIN_LABELS[value]})`}</Text>
                        {isSelected ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
                      </Pressable>
                    );
                  })}
                </>
              ) : null}

              {isShowMediaType(item.mediaType) ? (
                <>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>Release</Text>
                  {RELEASE_STATUSES.map((value) => {
                    const isSelected = releaseStatus === value;

                    return (
                      <Pressable
                        key={value}
                        onPress={() => setReleaseStatus(value)}
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
                        <Text style={{ flex: 1 }}>{RELEASE_STATUS_LABELS[value]}</Text>
                        {isSelected ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
                      </Pressable>
                    );
                  })}
                </>
              ) : null}

              {isShowMediaType(item.mediaType) ? (
                <>
                  <Text style={{ color: colors.textMuted, marginTop: 6 }}>Total episodes</Text>
                  <TextInput
                    value={totalEpisodes}
                    onChangeText={setTotalEpisodes}
                    placeholder="e.g. 12"
                    keyboardType="number-pad"
                  />
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
