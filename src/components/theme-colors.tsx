import { createContext, useContext, type ReactNode } from 'react';

import { palettes, type ThemeColors } from '@/constants/theme';
import type { ColorScheme } from '@/lib/db/types';

// Screens outside AppSettingsProvider (startup loading) fall back to dark.
const ColorsContext = createContext<ThemeColors>(palettes.dark);

export function ColorsProvider({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  return <ColorsContext.Provider value={palettes[scheme]}>{children}</ColorsContext.Provider>;
}

export function useColors(): ThemeColors {
  return useContext(ColorsContext);
}
