import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SIDE_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

function buildScores(): Array<number | null> {
  const scores: Array<number | null> = [null];
  for (let tenths = 10; tenths <= 100; tenths += 1) {
    scores.push(tenths / 10);
  }
  return scores;
}

const SCORES = buildScores();

function scoreEquals(left: number | null, right: number | null): boolean {
  if (left == null || right == null) {
    return left == right;
  }

  return Math.round(left * 10) === Math.round(right * 10);
}

function scoreIndex(value: number | null): number {
  const index = SCORES.findIndex((score) => scoreEquals(score, value));
  return index < 0 ? 0 : index;
}

function labelFor(score: number | null): string {
  if (score == null) {
    return 'Unscored';
  }

  return score.toFixed(1);
}

function indexFromOffset(offsetY: number): number {
  const index = Math.round(offsetY / ITEM_HEIGHT);
  return Math.min(SCORES.length - 1, Math.max(0, index));
}

export function ScorePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  const listRef = useRef<ScrollView>(null);
  const initialOffset = useRef(scoreIndex(value) * ITEM_HEIGHT).current;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: initialOffset, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [initialOffset]);

  function commitOffset(event: NativeSyntheticEvent<NativeScrollEvent>) {
    onChange(SCORES[indexFromOffset(event.nativeEvent.contentOffset.y)] ?? null);
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
        {SCORES.map((score, index) => {
          const selected = scoreEquals(score, value);

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
                {labelFor(score)}
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
          {visible ? <ScorePicker value={value} onChange={onChange} /> : null}
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
