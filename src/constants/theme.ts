import { DarkTheme } from '@react-navigation/native';

export const colors = {
  background: '#000000',
  text: '#ffffff',
  textMuted: '#aaaaaa',
  border: '#333333',
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
