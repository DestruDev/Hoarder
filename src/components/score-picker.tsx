import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, ScrollView, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSettings } from '@/components/app-settings';
import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import type { RatingSystem } from '@/lib/db';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SIDE_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

function buildScores(ratingSystem: RatingSystem): Array<number | null> {
  const scores: Array<number | null> = [null];
  if (ratingSystem === 'whole') {
    for (let score = 1; score <= 10; score += 1) {
      scores.push(score);
    }
    return scores;
  }

  for (let tenths = 10; tenths <= 100; tenths += 1) {
    scores.push(tenths / 10);
  }
  return scores;
}

function scoreEquals(left: number | null, right: number | null, ratingSystem: RatingSystem): boolean {
  if (left == null || right == null) {
    return left == right;
  }

  if (ratingSystem === 'whole') {
    return Math.round(left) === Math.round(right);
  }

  return Math.round(left * 10) === Math.round(right * 10);
}

function scoreIndex(scores: Array<number | null>, value: number | null, ratingSystem: RatingSystem): number {
  const index = scores.findIndex((score) => scoreEquals(score, value, ratingSystem));
  return index < 0 ? 0 : index;
}

function labelFor(score: number | null, ratingSystem: RatingSystem): string {
  if (score == null) {
    return 'Unscored';
  }

  return ratingSystem === 'whole' ? String(Math.round(score)) : score.toFixed(1);
}

function indexFromOffset(offsetY: number, length: number): number {
  const index = Math.round(offsetY / ITEM_HEIGHT);
  return Math.min(length - 1, Math.max(0, index));
}

export function ScorePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  const { ratingSystem } = useAppSettings();
  const scores = useMemo(() => buildScores(ratingSystem), [ratingSystem]);
  const listRef = useRef<ScrollView>(null);
  const initialOffset = useRef(scoreIndex(scores, value, ratingSystem) * ITEM_HEIGHT).current;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: initialOffset, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [initialOffset]);

  function commitOffset(event: NativeSyntheticEvent<NativeScrollEvent>) {
    onChange(scores[indexFromOffset(event.nativeEvent.contentOffset.y, scores.length)] ?? null);
  }

  return (
    <View style={{ height: PICKER_HEIGHT, overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: SIDE_PADDING,
          right: 0,
          left: 0,
          height: ITEM_HEIGHT,
          backgroundColor: colors.searchBarBackground,
          borderColor: colors.border,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderRadius: 10,
        }}
      />
      <ScrollView
        ref={listRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={commitOffset}
        onScrollEndDrag={commitOffset}
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingVertical: SIDE_PADDING }}>
        {scores.map((score, index) => {
          const selected = scoreEquals(score, value, ratingSystem);

          return (
            <Pressable
              key={score == null ? 'unscored' : String(score)}
              onPress={() => {
                onChange(score);
                listRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
              }}
              style={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: selected ? colors.text : colors.textMuted, fontSize: 18 }}>
                {labelFor(score, ratingSystem)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ScorePickerModal({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  onChange: (score: number | null) => void;
  onClose: () => void;
}) {
  const { ratingSystem } = useAppSettings();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close score picker"
          onPress={onClose}
          onPressIn={onClose}
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
          <Text style={{ fontSize: 18 }}>Score</Text>
          {visible ? <ScorePicker key={ratingSystem} value={value} onChange={onChange} /> : null}
          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: colors.searchBarBackground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}>
            <Text>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
