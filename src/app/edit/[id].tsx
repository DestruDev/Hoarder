import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { Screen, ScreenScrollView, Text, TextInput } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  COMIC_ORIGINS,
  ITEM_STATUSES,
  getItemById,
  isChapteredMediaType,
  isComicMediaType,
  isPagedMediaType,
  isShowMediaType,
  updateItem,
  type ComicOrigin,
  type Item,
  type ItemStatus,
} from '@/lib/db';
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

export default function ItemEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [item, setItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [status, setStatus] = useState<ItemStatus>('planning');
  const [mangaOrigin, setMangaOrigin] = useState<ComicOrigin>('american');
  const [score, setScore] = useState<number | null>(null);
  const [currentEpisodes, setCurrentEpisodes] = useState('');
  const [currentPages, setCurrentPages] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [currentChapters, setCurrentChapters] = useState('');
  const [totalChapters, setTotalChapters] = useState('');
  const [startDate, setStartDate] = useState('');
  const [finishDate, setFinishDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isFinite(itemId)) {
      setLoadError('Invalid item id');
      setLoaded(true);
      return;
    }

    getItemById(itemId)
      .then((row) => {
        if (cancelled) {
          return;
        }

        setItem(row);
        if (row) {
          setStatus(row.status);
          setMangaOrigin(row.mangaOrigin ?? 'american');
          setScore(row.rating);
          setCurrentEpisodes(row.currentEpisodes != null ? String(row.currentEpisodes) : '');
          setCurrentPages(row.currentPages != null ? String(row.currentPages) : '');
          setTotalPages(row.totalPages != null ? String(row.totalPages) : '');
          setCurrentChapters(row.currentChapters != null ? String(row.currentChapters) : '');
          setTotalChapters(row.totalChapters != null ? String(row.totalChapters) : '');
          setStartDate(toDateInput(row.dateAdded));
          setFinishDate(toDateInput(row.finishDate));
          setNotes(row.notes ?? '');
        }
        setLoadError(null);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setLoadError(nextError instanceof Error ? nextError.message : 'Failed to load item');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
      }
    };
  }, []);

  const inputFocusProps = {
    onFocus: () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
      setInputFocused(true);
    },
    onBlur: () => {
      blurTimeout.current = setTimeout(() => {
        setInputFocused(false);
      }, 150);
    },
  };

  async function handleSave() {
    if (!item || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    Keyboard.dismiss();
    setInputFocused(false);

    try {
      const parsedCurrentEpisodes = isShowMediaType(item.mediaType)
        ? parseWholeNumber(currentEpisodes, 'Episodes watched')
        : null;
      const parsedCurrentPages = isPagedMediaType(item.mediaType, mangaOrigin)
        ? parseWholeNumber(currentPages, 'Pages read')
        : null;
      const parsedTotalPages = isPagedMediaType(item.mediaType, mangaOrigin)
        ? parseWholeNumber(totalPages, 'Total pages')
        : null;
      const parsedCurrentChapters = isChapteredMediaType(item.mediaType, mangaOrigin)
        ? parseWholeNumber(currentChapters, 'Chapters read')
        : null;
      const parsedTotalChapters = isChapteredMediaType(item.mediaType, mangaOrigin)
        ? parseWholeNumber(totalChapters, 'Total chapters')
        : null;
      const isCompleted = status === 'completed';

      const saved = await updateItem(item.id, {
        status,
        rating: score,
        notes: notes.trim() || null,
        dateAdded: parseDate(startDate, 'Start date'),
        finishDate: parseOptionalDate(finishDate, 'Finish date'),
        mangaOrigin: isComicMediaType(item.mediaType) ? mangaOrigin : null,
        currentEpisodes: isShowMediaType(item.mediaType)
          ? isCompleted && item.totalEpisodes != null
            ? item.totalEpisodes
            : parsedCurrentEpisodes
          : null,
        currentPages: isPagedMediaType(item.mediaType, mangaOrigin)
          ? isCompleted && parsedTotalPages != null
            ? parsedTotalPages
            : parsedCurrentPages
          : null,
        totalPages: parsedTotalPages,
        currentChapters: isChapteredMediaType(item.mediaType, mangaOrigin)
          ? isCompleted && parsedTotalChapters != null
            ? parsedTotalChapters
            : parsedCurrentChapters
          : null,
        totalChapters: parsedTotalChapters,
      });

      if (!saved) {
        throw new Error('Failed to save changes');
      }

      router.back();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  const showCheckmark = inputFocused && !!item;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Edit',
          headerRight: () =>
            showCheckmark ? (
              <Pressable
                onPress={handleSave}
                disabled={saving}
                hitSlop={8}
                accessibilityLabel="Save"
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.5 : 1,
                }}>
                <Ionicons name="checkmark" size={24} color={colors.text} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                accessibilityLabel="Close"
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            ),
        }}
      />

      {!loaded ? (
        <Text style={{ padding: 16 }}>Loading...</Text>
      ) : loadError ? (
        <Text style={{ padding: 16 }}>{loadError}</Text>
      ) : !item ? (
        <Text style={{ padding: 16 }}>Item not found.</Text>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScreenScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
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
              {...inputFocusProps}
            />

            <Text style={{ color: colors.textMuted, marginTop: 6 }}>Finish Date</Text>
            <TextInput
              value={finishDate}
              onChangeText={setFinishDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              {...inputFocusProps}
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
                    {...inputFocusProps}
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
                    {...inputFocusProps}
                  />
                  <Text style={{ color: colors.textMuted }}>/</Text>
                  <TextInput
                    value={totalPages}
                    onChangeText={setTotalPages}
                    placeholder="total"
                    keyboardType="number-pad"
                    style={{ flex: 1 }}
                    {...inputFocusProps}
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
                    {...inputFocusProps}
                  />
                  <Text style={{ color: colors.textMuted }}>/</Text>
                  <TextInput
                    value={totalChapters}
                    onChangeText={setTotalChapters}
                    placeholder="total"
                    keyboardType="number-pad"
                    style={{ flex: 1 }}
                    {...inputFocusProps}
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
              {...inputFocusProps}
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
          </ScreenScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
