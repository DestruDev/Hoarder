import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { MediaCover } from '@/components/media-cover';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Text } from '@/components/themed';
import { useColors } from '@/components/theme-colors';
import { findCatalogItemByTitleAndType } from '@/lib/db';
import { STATUS_LABELS, mediaTypeLabel } from '@/lib/status-labels';
import { displayNameFor, getLikesPreview, type FeedActivity, type UserSummary } from '@/lib/social';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LONG_PRESS_MS = 400;

export function timeAgo(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());

  if (elapsed < MINUTE) {
    return 'just now';
  }
  if (elapsed < HOUR) {
    return `${Math.round(elapsed / MINUTE)}m ago`;
  }
  if (elapsed < DAY) {
    return `${Math.round(elapsed / HOUR)}h ago`;
  }

  const days = Math.round(elapsed / DAY);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  return new Date(iso).toLocaleDateString();
}

function activityVerb(activity: FeedActivity): string {
  if (activity.kind === 'added') {
    return `added to ${STATUS_LABELS[activity.status] ?? 'their library'}`;
  }

  switch (activity.status) {
    case 'completed':
      return 'completed';
    case 'dropped':
      return 'dropped';
    case 'planning':
      return 'plans to start';
    default:
      return `moved to ${STATUS_LABELS[activity.status] ?? activity.status}`;
  }
}

export function ActivityRow({
  activity,
  onToggleLike,
  onDelete,
  showAuthor = true,
}: {
  activity: FeedActivity;
  onToggleLike: (activity: FeedActivity) => void;
  // Offered in the hold menu on your own activity only.
  onDelete?: (activity: FeedActivity) => Promise<void>;
  showAuthor?: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const { session } = useAuth();
  const name = displayNameFor(activity);
  const canDelete = onDelete != null && activity.userId === session?.user.id;

  // Activity carries a snapshot, not a catalog id, so match it to this device's
  // catalog when tapped. Titles not in the local catalog just don't open.
  async function openTitle() {
    const match = await findCatalogItemByTitleAndType(activity.title, activity.mediaType);
    if (match) {
      router.push({
        pathname: '/catalog/[id]',
        params: { id: String(match.id), title: match.title },
      });
    }
  }

  // Press and hold anywhere on the row (touch, or mouse button on web) to preview
  // who liked it. Inner pressables claim their own touches, so each one gets the
  // same long-press handler too. The row stays lit while the preview is open.
  const rowRef = useRef<View>(null);
  const highlight = useRef(new Animated.Value(0)).current;
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const showLikes = () => {
    rowRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      highlight.stopAnimation();
      Animated.timing(highlight, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    });
  };

  const hideLikes = () => {
    setAnchor(null);
    highlight.stopAnimation();
    Animated.timing(highlight, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  return (
    <>
      <Pressable
        ref={rowRef}
        onLongPress={showLikes}
        delayLongPress={LONG_PRESS_MS}
        accessibilityActions={[{ name: 'longpress', label: 'See who liked this' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') {
            showLikes();
          }
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: -8,
            right: -8,
            borderRadius: 10,
            backgroundColor: colors.surface,
            opacity: highlight,
          }}
        />
        <Pressable
          onPress={openTitle}
          onLongPress={showLikes}
          delayLongPress={LONG_PRESS_MS}
          accessibilityRole="button"
          accessibilityLabel={activity.title}>
          <MediaCover uri={activity.coverImageUrl} width={48} height={68} />
        </Pressable>

        <View style={{ flex: 1, gap: 3 }}>
          {showAuthor ? (
            <Link href={{ pathname: '/user/[id]', params: { id: activity.userId } }} asChild>
              <Pressable
                onLongPress={showLikes}
                delayLongPress={LONG_PRESS_MS}
                accessibilityRole="link"
                accessibilityLabel={`${name}'s profile`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                <ProfileAvatar uri={activity.avatarUrl} size={20} />
                <Text style={{ fontWeight: '600' }} numberOfLines={1}>
                  {name}
                </Text>
              </Pressable>
            </Link>
          ) : null}
          <Text numberOfLines={2}>
            <Text style={{ color: colors.textMuted }}>{activityVerb(activity)} </Text>
            <Text
              style={{ fontWeight: '600' }}
              onPress={openTitle}
              onLongPress={showLikes}>
              {activity.title}
            </Text>
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {mediaTypeLabel(activity.mediaType, activity.mangaOrigin)} · {timeAgo(activity.createdAt)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', height: 32 }}>
          {activity.likeCount > 0 ? (
            <Pressable
              onPress={showLikes}
              onLongPress={showLikes}
              delayLongPress={LONG_PRESS_MS}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`${activity.likeCount} ${activity.likeCount === 1 ? 'like' : 'likes'}. See who liked this`}
              style={{ height: 32, justifyContent: 'center', paddingRight: 2 }}>
              <Text style={{ color: activity.liked ? colors.danger : colors.textMuted }}>
                {activity.likeCount}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onToggleLike(activity)}
            onLongPress={showLikes}
            delayLongPress={LONG_PRESS_MS}
            hitSlop={{ top: 8, bottom: 8, left: 2, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={activity.liked ? 'Unlike' : 'Like'}
            style={{ height: 32, minWidth: 26, alignItems: 'flex-end', justifyContent: 'center' }}>
            <Ionicons
              name={activity.liked ? 'heart' : 'heart-outline'}
              size={22}
              color={activity.liked ? colors.danger : colors.textMuted}
            />
          </Pressable>
        </View>
      </Pressable>
      {/* Outside the row: React events bubble out of a Modal on web, and a hold
          inside the popover mustn't reach the row's long-press handler. */}
      {anchor ? (
      <LikesPreview
        activity={activity}
        anchor={anchor}
        onClose={hideLikes}
        onDelete={canDelete ? () => onDelete(activity) : undefined}
      />
    ) : null}
    </>
  );
}

type Anchor = { x: number; y: number; width: number; height: number };

const PREVIEW_LIMIT = 3;
const PREVIEW_WIDTH = 240;
const PREVIEW_ROW_HEIGHT = 44;
const SCREEN_MARGIN = 8;

// A small popover under (or above, near the bottom of the screen) an activity:
// the first few likers, plus a footer ("N more…" or "See all") that opens the
// full list.
function LikesPreview({
  activity,
  anchor,
  onClose,
  onDelete,
}: {
  activity: FeedActivity;
  anchor: Anchor;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [likers, setLikers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // First tap arms the delete button, second tap deletes. (Alert.alert has no
  // buttons on web, so the confirmation lives in the popover itself.)
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle');

  async function handleDelete() {
    if (!onDelete || deleteState === 'deleting') {
      return;
    }
    if (deleteState === 'idle') {
      setDeleteState('confirm');
      return;
    }

    setDeleteState('deleting');
    try {
      await onDelete();
      onClose();
    } catch (deleteError: unknown) {
      setDeleteState('idle');
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete activity');
    }
  }

  useEffect(() => {
    let cancelled = false;
    getLikesPreview(activity.id, PREVIEW_LIMIT)
      .then((rows) => {
        if (!cancelled) {
          setLikers(rows);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load likes');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  const remaining = Math.max(0, activity.likeCount - (likers?.length ?? 0));
  const rowCount =
    (likers ? Math.max(likers.length, 1) + (likers.length > 0 ? 1 : 0) : 1) + (onDelete ? 1 : 0);
  const estimatedHeight = rowCount * PREVIEW_ROW_HEIGHT + 36;
  const below = anchor.y + anchor.height;
  const fitsBelow = below + estimatedHeight <= window.height - insets.bottom - SCREEN_MARGIN;
  const left = Math.min(
    Math.max(SCREEN_MARGIN, anchor.x + anchor.width - PREVIEW_WIDTH),
    window.width - PREVIEW_WIDTH - SCREEN_MARGIN,
  );

  function go(href: Parameters<typeof router.push>[0]) {
    onClose();
    router.push(href);
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close likes"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left,
          width: PREVIEW_WIDTH,
          ...(fitsBelow ? { top: below - 4 } : { bottom: window.height - anchor.y - 4 }),
          backgroundColor: colors.searchBarBackground,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          overflow: 'hidden',
        }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
          Liked by
        </Text>

        {error ? (
          <Text style={{ color: colors.danger, paddingHorizontal: 14, paddingVertical: 12 }}>{error}</Text>
        ) : !likers ? (
          <View style={{ height: PREVIEW_ROW_HEIGHT, justifyContent: 'center' }}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : likers.length === 0 ? (
          <Text style={{ color: colors.textMuted, paddingHorizontal: 14, paddingVertical: 12 }}>No likes yet.</Text>
        ) : (
          likers.map((user) => (
            <Pressable
              key={user.userId}
              onPress={() => go({ pathname: '/user/[id]', params: { id: user.userId } })}
              accessibilityRole="link"
              style={{
                height: PREVIEW_ROW_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
              }}>
              <ProfileAvatar uri={user.avatarUrl} size={26} />
              <Text style={{ flex: 1 }} numberOfLines={1}>
                {displayNameFor(user)}
              </Text>
            </Pressable>
          ))
        )}

        {likers && likers.length > 0 ? (
          <Pressable
            onPress={() => go({ pathname: '/likes/[id]', params: { id: String(activity.id) } })}
            accessibilityRole="button"
            accessibilityLabel={`See all ${activity.likeCount} ${activity.likeCount === 1 ? 'like' : 'likes'}`}
            style={{
              height: PREVIEW_ROW_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            <Text style={{ flex: 1, color: colors.accent, fontWeight: '600' }}>
              {remaining > 0 ? `${remaining} more…` : 'See all'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </Pressable>
        ) : null}

        {onDelete ? (
          <Pressable
            onPress={handleDelete}
            disabled={deleteState === 'deleting'}
            accessibilityRole="button"
            accessibilityLabel={deleteState === 'confirm' ? 'Confirm delete activity' : 'Delete activity'}
            accessibilityHint="Removes this from your feed and your followers' feeds. Your library is unchanged."
            style={{
              height: PREVIEW_ROW_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            {deleteState === 'deleting' ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            )}
            <Text style={{ flex: 1, color: colors.danger, fontWeight: '600' }}>
              {deleteState === 'confirm' ? 'Tap again to delete' : 'Delete activity'}
            </Text>
          </Pressable>
        ) : null}
        {likers || error || onDelete ? <View style={{ height: 6 }} /> : null}
      </View>
    </Modal>
  );
}

// "12 followers · 3 following"; each count opens that list.
export function FollowCounts({
  userId,
  name,
  followerCount,
  followingCount,
}: {
  userId: string;
  name: string;
  followerCount: number;
  followingCount: number;
}) {
  const colors = useColors();
  const counts = [
    { list: 'followers', value: followerCount, label: followerCount === 1 ? 'follower' : 'followers' },
    { list: 'following', value: followingCount, label: 'following' },
  ] as const;

  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      {counts.map((count) => (
        <Link
          key={count.list}
          href={{ pathname: '/follows/[id]', params: { id: userId, list: count.list, name } }}
          asChild>
          <Pressable hitSlop={8} accessibilityRole="link" accessibilityLabel={`${count.value} ${count.label}`}>
            <Text>
              <Text style={{ fontWeight: '600' }}>{count.value}</Text>
              <Text style={{ color: colors.textMuted }}> {count.label}</Text>
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

export function FollowButton({
  following,
  busy = false,
  onPress,
}: {
  following: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={following ? 'Unfollow' : 'Follow'}
      style={{
        minWidth: 96,
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: following ? colors.surface : colors.accent,
        borderWidth: 1,
        borderColor: following ? colors.border : colors.accent,
        opacity: busy ? 0.6 : 1,
      }}>
      {busy ? (
        <ActivityIndicator size="small" color={following ? colors.text : colors.onAccent} />
      ) : (
        <Text style={{ fontWeight: '600', color: following ? colors.text : colors.onAccent }}>
          {following ? 'Following' : 'Follow'}
        </Text>
      )}
    </Pressable>
  );
}

export function UserRow({
  user,
  busy,
  onToggleFollow,
  showFollow = true,
}: {
  user: UserSummary;
  busy: boolean;
  onToggleFollow: (user: UserSummary) => void;
  // False to hide the Follow button. Your own row never has one; it says "You".
  showFollow?: boolean;
}) {
  const colors = useColors();
  const { session } = useAuth();
  const isSelf = user.userId === session?.user.id;
  const primary = user.displayName ?? (user.username ? `@${user.username}` : 'No name yet');
  const secondary = user.displayName && user.username ? `@${user.username}` : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
      <Link href={{ pathname: '/user/[id]', params: { id: user.userId } }} asChild>
        <Pressable
          accessibilityRole="link"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ProfileAvatar uri={user.avatarUrl} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }} numberOfLines={1}>
              {primary}
            </Text>
            {secondary ? (
              <Text style={{ color: colors.textMuted }} numberOfLines={1}>
                {secondary}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>
      {isSelf ? (
        <View
          style={{
            minWidth: 96,
            height: 34,
            paddingHorizontal: 14,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Text style={{ color: colors.textMuted, fontWeight: '600' }}>You</Text>
        </View>
      ) : showFollow ? (
        <FollowButton following={user.isFollowing} busy={busy} onPress={() => onToggleFollow(user)} />
      ) : null}
    </View>
  );
}
