import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, ScrollView, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSettings } from '@/components/app-settings';
import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import type { RatingSystem } from '@/lib/db';

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SIDE_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

export type WheelOption<T> = { value: T; label: string; key: string };

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

export function WheelPicker<T>({
  options,
  value,
  onChange,
  isEqual = (left, right) => left === right,
  fontSize = 26,
}: {
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  isEqual?: (left: T, right: T) => boolean;
  fontSize?: number;
}) {
  const listRef = useRef<ScrollView>(null);
  const initialIndex = Math.max(
    0,
    options.findIndex((option) => isEqual(option.value, value)),
  );
  const initialOffset = useRef(initialIndex * ITEM_HEIGHT).current;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: initialOffset, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [initialOffset]);

  function commitOffset(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const option = options[indexFromOffset(event.nativeEvent.contentOffset.y, options.length)];
    if (option) {
      onChange(option.value);
    }
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
        {options.map((option, index) => {
          const selected = isEqual(option.value, value);

          return (
            <Pressable
              key={option.key}
              onPress={() => {
                onChange(option.value);
                listRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
              }}
              style={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: selected ? colors.text : colors.textMuted, fontSize }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ScorePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  const { ratingSystem } = useAppSettings();
  const options = useMemo(
    () =>
      buildScores(ratingSystem).map((score) => ({
        value: score,
        label: labelFor(score, ratingSystem),
        key: score == null ? 'unscored' : String(score),
      })),
    [ratingSystem],
  );

  return (
    <WheelPicker
      options={options}
      value={value}
      onChange={onChange}
      isEqual={(left, right) => scoreEquals(left, right, ratingSystem)}
    />
  );
}

export function ScorePickerModal({
  visible,
  value,
  onChange,
  onClose,
  onDone,
}: {
  visible: boolean;
  value: number | null;
  onChange: (score: number | null) => void;
  onClose: () => void;
  onDone?: (score: number | null) => void;
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
            onPress={() => {
              onDone?.(value);
              onClose();
            }}
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
