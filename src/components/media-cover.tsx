import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';

const PLACEHOLDER_COVER = require('../../assets/images/cover-placeholder.png');

export function MediaCover({
  uri,
  width = 72,
  height = 100,
}: {
  uri?: string | null;
  width?: number;
  height?: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.searchBarBackground,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <Image
        source={uri ? { uri } : PLACEHOLDER_COVER}
        style={{ width, height }}
        contentFit="cover"
      />
    </View>
  );
}

export function MediaRow({
  title,
  subtitle,
  coverImageUrl,
}: {
  title: string;
  subtitle: string;
  coverImageUrl?: string | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <MediaCover uri={coverImageUrl} width={72} height={100} />
      <View style={{ flex: 1 }}>
        <Text>{title}</Text>
        <Text style={{ color: colors.textMuted }}>{subtitle}</Text>
      </View>
    </View>
  );
}
