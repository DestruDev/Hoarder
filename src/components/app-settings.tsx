import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  type CollectionView,
  type RatingSystem,
} from '@/lib/db';
import { formatScore, formatScoreOutOfTen } from '@/lib/status-labels';

type AppSettingsContextValue = AppSettings & {
  setRatingSystem: (ratingSystem: RatingSystem) => void;
  setLibraryView: (libraryView: CollectionView) => void;
  setExploreView: (exploreView: CollectionView) => void;
  formatScore: (rating: number) => string;
  formatScoreOutOfTen: (rating: number) => string;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;

    getAppSettings()
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
        }
      })
      .catch((error: unknown) => {
        console.error('[Hoarder] Failed to load settings:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const patchSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    saveAppSettings(next).catch((error: unknown) => {
      console.error('[Hoarder] Failed to save settings:', error);
    });
  }, []);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...settings,
      setRatingSystem: (ratingSystem) => patchSettings({ ratingSystem }),
      setLibraryView: (libraryView) => patchSettings({ libraryView }),
      setExploreView: (exploreView) => patchSettings({ exploreView }),
      formatScore: (rating) => formatScore(rating, settings.ratingSystem),
      formatScoreOutOfTen: (rating) => formatScoreOutOfTen(rating, settings.ratingSystem),
    }),
    [patchSettings, settings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);
  if (!value) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }

  return value;
}
