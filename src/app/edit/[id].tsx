import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, PanResponder, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { ScreenScrollView, Text, TextInput } from '@/components/themed';
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
  const navigation = useNavigation();
  const { height: windowHeight } = useWindowDimensions();
  const { formatScoreOutOfTen } = useAppSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const scrollRef = useRef<ScrollView>(null);
  const notesOffset = useRef(0);
  const closing = useRef(false);
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const currentY = useRef(windowHeight);
  const dragOrigin = useRef(0);
  const dragVelocity = useRef(0);
  const sheetHeight = Math.round(windowHeight * 0.9);

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

  const animateSheetTo = useCallback(
    (toValue: number, onEnd?: (finished: boolean) => void) => {
      const velocity = dragVelocity.current;
      dragVelocity.current = 0;

      Animated.spring(translateY, {
        toValue,
        velocity: velocity * 1000,
        tension: 72,
        friction: 11,
        overshootClamping: true,
        restDisplacementThreshold: 1,
        restSpeedThreshold: 1,
        useNativeDriver: false,
      }).start(({ finished }) => {
        onEnd?.(finished);
      });
    },
    [translateY],
  );

  const dismiss = useCallback(
    (afterClose?: () => void) => {
      if (closing.current) {
        return;
      }

      closing.current = true;
      requestAnimationFrame(() => {
        Keyboard.dismiss();
      });
      animateSheetTo(windowHeight, (finished) => {
        if (finished) {
          afterClose ? afterClose() : router.back();
        } else {
          closing.current = false;
        }
      });
    },
    [animateSheetTo, router, windowHeight],
  );

  const snapBack = useCallback(() => {
    animateSheetTo(0);
  }, [animateSheetTo]);

  const snapBackRef = useRef(snapBack);
  const dismissFromDragRef = useRef(() => {});
  const sheetHeightRef = useRef(sheetHeight);
  snapBackRef.current = snapBack;
  sheetHeightRef.current = sheetHeight;

  function settleFromDrag(velocityY: number) {
    dragVelocity.current = velocityY;
    const projectedY = currentY.current + velocityY * 220;
    if (projectedY > sheetHeightRef.current / 2) {
      dismissFromDragRef.current();
    } else {
      snapBackRef.current();
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation((value) => {
          dragOrigin.current = value;
          currentY.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, dragOrigin.current + gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        translateY.stopAnimation((value) => {
          currentY.current = value;
          settleFromDrag(gesture.vy);
        });
      },
      onPanResponderTerminate: (_, gesture) => {
        translateY.stopAnimation((value) => {
          currentY.current = value;
          settleFromDrag(gesture.vy);
        });
      },
    }),
  ).current;

  useEffect(() => {
    const listener = translateY.addListener(({ value }) => {
      currentY.current = value;
    });
    return () => {
      translateY.removeListener(listener);
    };
  }, [translateY]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [translateY]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (closing.current) {
        return;
      }

      event.preventDefault();
      dismiss(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [dismiss, navigation]);

  function buildSaveInput() {
    if (!item) {
      throw new Error('Item not found.');
    }

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

    return {
      id: item.id,
      input: {
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
      },
    };
  }

  async function persistChanges() {
    const payload = buildSaveInput();
    const saved = await updateItem(payload.id, payload.input);
    if (!saved) {
      throw new Error('Failed to save changes');
    }
  }

  async function handleSave() {
    if (!item || saving) {
      snapBack();
      return;
    }

    setSaving(true);
    setError(null);
    Keyboard.dismiss();

    try {
      await persistChanges();
      dismiss();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save changes');
      setSaving(false);
      snapBack();
    }
  }

  dismissFromDragRef.current = () => {
    try {
      buildSaveInput();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save changes');
      snapBack();
      return;
    }

    dismiss();
    void persistChanges().catch((saveError: unknown) => {
      console.error('[Hoarder] Failed to save on dismiss:', saveError);
    });
  };

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Stack.Screen
        options={{
          title: 'Edit',
          presentation: 'transparentModal',
          animation: 'none',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close edit"
        onPress={() => dismiss()}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            opacity: translateY.interpolate({
              inputRange: [0, sheetHeight],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          }}
        />
      </Pressable>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <View
          style={{
            height: sheetHeight,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}>
        <View {...panResponder.panHandlers}>
          <EditHeader onSave={handleSave} disabled={!item || saving} />
        </View>
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
              onDone={(nextScore) => {
                setScore(nextScore);
                if (!item) {
                  return;
                }

                void updateItem(item.id, { rating: nextScore }).then((saved) => {
                  if (saved) {
                    setItem(saved);
                  }
                });
              }}
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
        </View>
      </Animated.View>
    </View>
  );
}

function EditHeader({
  onSave,
  disabled,
}: {
  onSave: () => void;
  disabled: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const popping = useRef(false);

  function handlePress() {
    if (disabled || popping.current) {
      return;
    }

    popping.current = true;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.22,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();
    onSave();
  }

  return (
    <View style={{ backgroundColor: colors.background, paddingTop: 8 }}>
      <View
        style={{
          alignItems: 'center',
          paddingBottom: 8,
        }}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
          }}
        />
      </View>
      <View style={{ height: 48, justifyContent: 'center' }}>
        <Text
          style={{
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '600',
            marginHorizontal: 56,
          }}>
          Edit
        </Text>
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          hitSlop={8}
          accessibilityLabel="Save"
          style={{
            position: 'absolute',
            right: 16,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}>
          <Animated.View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.text,
              opacity: disabled ? 0.5 : 1,
              transform: [{ scale }],
            }}>
            <Ionicons name="checkmark" size={26} color={colors.background} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
