import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { ColorScheme } from '@/lib/db/types';

// Core tokens: build new screens from these. Values are placeholders.
const darkColors = {
  background: '#000000',
  surface: '#161616',
  text: '#ffffff',
  accent: '#4f8cff',
  // Text and icons drawn on an accent background (e.g. Follow buttons).
  onAccent: '#ffffff',
  border: '#333333',
  textMuted: '#aaaaaa',
  inputBackground: '#111111',
  searchBarBackground: '#2a2a2a',
  placeholder: '#888888',
  danger: '#ff4d4d',
  // Confirmation state, e.g. a button that just saved.
  success: '#2fa84f',
  overlay: 'rgba(0, 0, 0, 0.6)',
  // Badges drawn on top of cover art, so they stay the same in both themes.
  imageBadgeBackground: 'rgba(0, 0, 0, 0.55)',
  imageBadgeIcon: '#ffffff',
};

export type ThemeColors = typeof darkColors;

const lightColors: ThemeColors = {
  background: '#ffffff',
  surface: '#f2f2f5',
  text: '#111111',
  accent: '#2f6fe0',
  onAccent: '#ffffff',
  border: '#d4d4d8',
  textMuted: '#666666',
  inputBackground: '#f7f7f8',
  searchBarBackground: '#ececef',
  placeholder: '#8a8a8a',
  danger: '#d92d2d',
  success: '#23863d',
  overlay: 'rgba(0, 0, 0, 0.4)',
  imageBadgeBackground: 'rgba(0, 0, 0, 0.55)',
  imageBadgeIcon: '#ffffff',
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
