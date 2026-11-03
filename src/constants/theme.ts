import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { ColorScheme } from '@/lib/db/types';

// Core tokens: build new screens from these. Values are placeholders.
const darkColors = {
  background: '#000000',
  surface: '#161616',
  text: '#ffffff',
  accent: '#4f8cff',
  border: '#333333',
  textMuted: '#aaaaaa',
  inputBackground: '#111111',
  searchBarBackground: '#2a2a2a',
  placeholder: '#888888',
  danger: '#ff4d4d',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export type ThemeColors = typeof darkColors;

const lightColors: ThemeColors = {
  background: '#ffffff',
  surface: '#f2f2f5',
  text: '#111111',
  accent: '#2f6fe0',
  border: '#d4d4d8',
  textMuted: '#666666',
  inputBackground: '#f7f7f8',
  searchBarBackground: '#ececef',
  placeholder: '#8a8a8a',
  danger: '#d92d2d',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

export const palettes: Record<ColorScheme, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};

export function navigationThemeFor(scheme: ColorScheme): Theme {
  const colors = palettes[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.text,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.text,
    },
  };
}
