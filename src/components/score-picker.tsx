import { Pressable, View } from 'react-native';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';

const WHOLE_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TENTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function toScore(whole: number, tenth: number): number {
  return Number((whole + tenth / 10).toFixed(1));
}

function wholePart(score: number | null): number | null {
  if (score == null) {
    return null;
  }

  return score >= 10 ? 10 : Math.floor(score);
}

function tenthPart(score: number | null): number {
  if (score == null || score >= 10) {
    return 0;
  }

  return Math.round((score % 1) * 10);
}

function ScoreChip({
  label,
  selected,
  onPress,
  width = 40,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  width?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.searchBarBackground : colors.background,
        borderColor: selected ? colors.text : colors.border,
        borderWidth: 1,
        borderRadius: 10,
      }}>
      <Text>{label}</Text>
    </Pressable>
  );
}

export function ScorePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  const whole = wholePart(value);
  const tenth = tenthPart(value);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WHOLE_SCORES.map((nextWhole) => {
          const isSelected = whole === nextWhole;

          return (
            <ScoreChip
              key={nextWhole}
              label={String(nextWhole)}
              selected={isSelected}
              onPress={() => {
                if (isSelected) {
                  onChange(null);
                  return;
                }

                onChange(toScore(nextWhole, nextWhole === 10 ? 0 : tenth));
              }}
            />
          );
        })}
      </View>

      {whole != null && whole < 10 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TENTHS.map((nextTenth) => (
            <ScoreChip
              key={nextTenth}
              label={`.${nextTenth}`}
              selected={tenth === nextTenth}
              width={36}
              onPress={() => onChange(toScore(whole, nextTenth))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
