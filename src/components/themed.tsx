import {
  ScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native';

import { colors } from '@/constants/theme';

export function Screen({ style, ...props }: ViewProps) {
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]} {...props} />;
}

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[{ color: colors.text }, style]} {...props} />;
}

export function TextInput({ style, placeholderTextColor, ...props }: TextInputProps) {
  return (
    <RNTextInput
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      style={[
        {
          color: colors.text,
          backgroundColor: colors.inputBackground,
          borderColor: colors.border,
          borderWidth: 1,
          padding: 8,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function ScreenScrollView({ style, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={contentContainerStyle}
      {...props}
    />
  );
}
