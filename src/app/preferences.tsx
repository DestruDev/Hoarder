import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { ScreenScrollView, Text } from '@/components/themed';
import { colors } from '@/constants/theme';
import {
  COLLECTION_VIEWS,
  RATING_SYSTEMS,
  type CollectionView,
  type RatingSystem,
} from '@/lib/db';

const PREFERENCE_TABS = ['feed', 'library', 'explore', 'profile'] as const;

type PreferenceTab = (typeof PREFERENCE_TABS)[number];

const PREFERENCE_TAB_LABELS: Record<PreferenceTab, string> = {
  feed: 'Feed',
  library: 'Library',
  explore: 'Explore',
  profile: 'Profile',
};

const RATING_SYSTEM_LABELS: Record<RatingSystem, string> = {
  decimal: 'Decimal',
  whole: 'Whole',
};

const COLLECTION_VIEW_LABELS: Record<CollectionView, string> = {
  list: 'List',
  card: 'Card',
};

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; title: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.searchBarBackground,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
      }}>
      <Text>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map((option) => {
          const selected = value === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              style={{
                flex: 1,
                alignItems: 'center',
                backgroundColor: selected ? colors.background : colors.searchBarBackground,
                borderColor: selected ? colors.text : colors.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingVertical: 12,
              }}>
              <Text>{option.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const [tab, setTab] = useState<PreferenceTab>('library');
  const {
    ratingSystem,
    setRatingSystem,
    libraryView,
    setLibraryView,
    exploreView,
    setExploreView,
  } = useAppSettings();

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Screen options={{ title: 'Preferences' }} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {PREFERENCE_TABS.map((preferenceTab) => {
          const selected = tab === preferenceTab;

          return (
            <Pressable
              key={preferenceTab}
              onPress={() => setTab(preferenceTab)}
              style={{
                flex: 1,
                alignItems: 'center',
                backgroundColor: selected ? colors.searchBarBackground : colors.background,
                borderColor: selected ? colors.text : colors.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingVertical: 10,
              }}>
              <Text numberOfLines={1} style={{ fontSize: 13 }}>
                {PREFERENCE_TAB_LABELS[preferenceTab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'library' ? (
        <View style={{ gap: 8 }}>
          <ChoiceRow
            label="View"
            value={libraryView}
            options={COLLECTION_VIEWS.map((view) => ({
              id: view,
              title: COLLECTION_VIEW_LABELS[view],
            }))}
            onChange={setLibraryView}
          />
          <ChoiceRow
            label="Rating system"
            value={ratingSystem}
            options={RATING_SYSTEMS.map((system) => ({
              id: system,
              title: RATING_SYSTEM_LABELS[system],
            }))}
            onChange={setRatingSystem}
          />
        </View>
      ) : null}

      {tab === 'explore' ? (
        <ChoiceRow
          label="View"
          value={exploreView}
          options={COLLECTION_VIEWS.map((view) => ({
            id: view,
            title: COLLECTION_VIEW_LABELS[view],
          }))}
          onChange={setExploreView}
        />
      ) : null}

      {tab === 'feed' || tab === 'profile' ? (
        <Text style={{ color: colors.textMuted }}>
          No {PREFERENCE_TAB_LABELS[tab].toLowerCase()} preferences yet.
        </Text>
      ) : null}
    </ScreenScrollView>
  );
}
