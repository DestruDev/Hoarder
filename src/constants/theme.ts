import { DarkTheme } from '@react-navigation/native';

// Core tokens: build new screens from these. Values are placeholders.
export const colors = {
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
};

export const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.text,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.text,
  },
};
