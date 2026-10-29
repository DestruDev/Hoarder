import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { Screen, ScreenScrollView, Text, TextInput } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  ITEM_STATUSES,
  getItemById,
  isChapteredMediaType,
  isPagedMediaType,
  isShowMediaType,
  updateItem,
  type Item,
  type ItemStatus,
} from '@/lib/db';
import { ScorePickerModal } from '@/components/score-picker';
import { STATUS_LABELS } from '@/lib/status-labels';

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
  const { formatScoreOutOfTen } = useAppSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const scrollRef = useRef<ScrollView>(null);
  const notesOffset = useRef(0);

  const [item, setItem] = useState<Item | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<ItemStatus>('planning');
  const [score, setScore] = useState<number | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [currentEpisodes, setCurrentEpisodes] = useState('');
  const [currentPages, setCurrentPages] = useState('');
  const [currentChapters, setCurrentChapters] = useState('');
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
          setScore(row.rating);
          setCurrentEpisodes(row.currentEpisodes != null ? String(row.currentEpisodes) : '');
          setCurrentPages(row.currentPages != null ? String(row.currentPages) : '');
          setCurrentChapters(row.currentChapters != null ? String(row.currentChapters) : '');
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

  async function handleSave() {
    if (!item || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    Keyboard.dismiss();

    try {
      const parsedCurrentEpisodes = isShowMediaType(item.mediaType)
        ? parseWholeNumber(currentEpisodes, 'Episodes watched')
        : null;
      const parsedCurrentPages = isPagedMediaType(item.mediaType, item.mangaOrigin)
        ? parseWholeNumber(currentPages, 'Pages read')
        : null;
      const parsedCurrentChapters = isChapteredMediaType(item.mediaType, item.mangaOrigin)
        ? parseWholeNumber(currentChapters, 'Chapters read')
        : null;
      const isCompleted = status === 'completed';

      const saved = await updateItem(item.id, {
        status,
        rating: score,
        notes: notes.trim() || null,
        dateAdded: parseDate(startDate, 'Start date'),
        finishDate: parseOptionalDate(finishDate, 'Finish date'),
        currentEpisodes: isShowMediaType(item.mediaType)
          ? isCompleted && item.totalEpisodes != null
            ? item.totalEpisodes
            : parsedCurrentEpisodes
          : null,
        currentPages: isPagedMediaType(item.mediaType, item.mangaOrigin)
          ? isCompleted && item.totalPages != null
            ? item.totalPages
            : parsedCurrentPages
          : null,
        currentChapters: isChapteredMediaType(item.mediaType, item.mangaOrigin)
          ? isCompleted && item.totalChapters != null
            ? item.totalChapters
            : parsedCurrentChapters
          : null,
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

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Edit',
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={!item || saving}
              hitSlop={8}
              accessibilityLabel="Save"
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !item || saving ? 0.5 : 1,
              }}>
              <Ionicons name="checkmark" size={24} color={colors.text} />
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
        <ScreenScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}>
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

            {isPagedMediaType(item.mediaType, item.mangaOrigin) ? (
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
                  <Text style={{ minWidth: 40 }}>{item.totalPages ?? '—'}</Text>
                </View>
              </>
            ) : null}

            {isChapteredMediaType(item.mediaType, item.mangaOrigin) ? (
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
                  <Text style={{ minWidth: 40 }}>{item.totalChapters ?? '—'}</Text>
                </View>
              </>
            ) : null}

            <Text style={{ color: colors.textMuted, marginTop: 6 }}>Score</Text>
            <Pressable
              onPress={() => setScoreOpen(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.searchBarBackground,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}>
              <Text>{score == null ? 'Unscored' : formatScoreOutOfTen(score)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
            </Pressable>
            <ScorePickerModal
              visible={scoreOpen}
              value={score}
              onChange={setScore}
              onClose={() => setScoreOpen(false)}
            />

            <View
              onLayout={(event) => {
                notesOffset.current = event.nativeEvent.layout.y;
              }}>
              <Text style={{ color: colors.textMuted, marginTop: 6 }}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes"
                multiline
                style={{ minHeight: 96, textAlignVertical: 'top' }}
                onFocus={() => {
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({
                      y: Math.max(0, notesOffset.current - 24),
                      animated: true,
                    });
                  });
                }}
              />
            </View>

            {error ? <Text>{error}</Text> : null}
          </ScreenScrollView>
      )}
    </Screen>
  );
}
