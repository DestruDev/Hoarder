import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { useColors } from '@/components/theme-colors';

type ProfileAvatarProps = {
  uri: string | null;
  size?: number;
};

export function ProfileAvatar({ uri, size = 32 }: ProfileAvatarProps) {
  const colors = useColors();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.border,
      }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Ionicons name="person" size={size * 0.6} color={colors.text} />
      )}
    </View>
  );
}
