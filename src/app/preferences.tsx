import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { useAppSettings } from '@/components/app-settings';
import { ScreenScrollView, Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import {
  COLLECTION_VIEWS,
  ITEM_STATUSES,
  RATING_SYSTEMS,
  type CollectionView,
  type ItemStatus,
  type RatingSystem,
} from '@/lib/db';
import { STATUS_LABELS } from '@/lib/status-labels';

const PREFERENCE_TABS = ['appearance', 'feed', 'library', 'explore', 'profile'] as const;

type PreferenceTab = (typeof PREFERENCE_TABS)[number];

const PREFERENCE_TAB_LABELS: Record<PreferenceTab, string> = {
  appearance: 'Appearance',
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
  const colors = useColors();
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

function MultiChoiceRow<T extends string>({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: T[];
  options: { id: T; title: string }[];
  onChange: (values: T[]) => void;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
      }}>
      <Text>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const selected = values.includes(option.id);

          return (
            <Pressable
              key={option.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() =>
                onChange(
                  selected
                    ? values.filter((value) => value !== option.id)
                    : options.map((o) => o.id).filter((id) => id === option.id || values.includes(id)),
                )
              }
              style={{
                flexBasis: '45%',
                flexGrow: 1,
                alignItems: 'center',
                backgroundColor: selected ? colors.background : colors.surface,
                borderColor: selected ? colors.accent : colors.border,
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

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}>
      <Text>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

export default function PreferencesScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<PreferenceTab>('library');
  const {
    ratingSystem,
    setRatingSystem,
    libraryView,
    setLibraryView,
    exploreView,
    setExploreView,
    colorScheme,
    setColorScheme,
    libraryExpanded,
    setLibraryExpanded,
  } = useAppSettings();

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Screen options={{ title: 'Preferences' }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ flexGrow: 1, gap: 8 }}>
        {PREFERENCE_TABS.map((preferenceTab) => {
          const selected = tab === preferenceTab;

          return (
            <Pressable
              key={preferenceTab}
              onPress={() => setTab(preferenceTab)}
              style={{
                flexGrow: 1,
                alignItems: 'center',
                paddingHorizontal: 12,
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
      </ScrollView>

      {tab === 'appearance' ? (
        <ToggleRow
          label="Dark mode"
          value={colorScheme === 'dark'}
          onChange={(dark) => setColorScheme(dark ? 'dark' : 'light')}
        />
      ) : null}

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
          <MultiChoiceRow<ItemStatus>
            label="Expanded by default"
            values={libraryExpanded}
            options={ITEM_STATUSES.map((status) => ({
              id: status,
              title: STATUS_LABELS[status],
            }))}
            onChange={setLibraryExpanded}
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
