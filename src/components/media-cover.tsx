import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import { formatScore } from '@/lib/status-labels';

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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

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
        source={!failed && uri ? { uri } : PLACEHOLDER_COVER}
        style={{ width, height }}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

export function MediaRow({
  title,
  subtitle,
  rating,
  coverImageUrl,
}: {
  title: string;
  subtitle: string;
  rating?: number | null;
  coverImageUrl?: string | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <MediaCover uri={coverImageUrl} width={72} height={100} />
      <View style={{ flex: 1 }}>
        <Text>{title}</Text>
        <Text style={{ color: colors.textMuted }}>{subtitle}</Text>
        {rating != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={12} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted }}>{formatScore(rating)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function MediaPoster({
  title,
  coverImageUrl,
  width = 120,
  height = 168,
}: {
  title: string;
  coverImageUrl?: string | null;
  width?: number;
  height?: number;
}) {
  return (
    <View style={{ width, gap: 8 }}>
      <MediaCover uri={coverImageUrl} width={width} height={height} />
      <Text numberOfLines={2}>{title}</Text>
    </View>
  );
}
