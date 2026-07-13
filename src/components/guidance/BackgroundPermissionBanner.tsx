/**
 * BackgroundPermissionBanner — inline nudge to grant "Always" location so live
 * guidance + alerts keep running while the phone is locked.
 *
 * Presentational only: visibility and the request/dismiss/settings actions are
 * owned by `useGuidanceBackgroundPermissionPrompt`. Two copy modes:
 *   - 'prompt'   → first ask ("허용하기" / "나중에").
 *   - 'settings' → after denial, deep-link to Settings ("설정 열기" / "나중에").
 *
 * Honest copy (no over-promising): background location makes guidance *continue*
 * on lock; it does not claim perfect underground tracking.
 */
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSemanticTokens } from '@/services/theme';
import {
  WANTED_TOKENS,
  typeStyle,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';

interface BackgroundPermissionBannerProps {
  /** Copy/CTA mode — 'prompt' (first ask) or 'settings' (post-denial deep link). */
  readonly mode: 'prompt' | 'settings';
  /** Primary CTA — request permission ('prompt') or open Settings ('settings'). */
  readonly onPrimary: () => void;
  /** Secondary CTA — dismiss the nudge (never ask again). */
  readonly onDismiss: () => void;
  readonly testID?: string;
}

const TITLE = '잠금 화면에서도 길안내 유지';
const PROMPT_BODY =
  "위치 접근을 '항상 허용'으로 설정하면 화면이 꺼져도 안내와 알림이 이어져요.";
const SETTINGS_BODY = "설정 앱에서 위치를 '항상 허용'으로 변경할 수 있어요.";

const BackgroundPermissionBannerImpl: React.FC<BackgroundPermissionBannerProps> = ({
  mode,
  onPrimary,
  onDismiss,
  testID,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const body = mode === 'settings' ? SETTINGS_BODY : PROMPT_BODY;
  const primaryLabel = mode === 'settings' ? '설정 열기' : '허용하기';

  return (
    <View style={styles.card} testID={testID ?? 'guidance-bg-permission-banner'}>
      <Text style={styles.title}>{TITLE}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="나중에 하기"
          hitSlop={8}
          testID="guidance-bg-permission-dismiss"
        >
          <Text style={styles.secondaryLabel}>나중에</Text>
        </Pressable>
        <Pressable
          style={styles.primaryBtn}
          onPress={onPrimary}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          hitSlop={8}
          testID="guidance-bg-permission-primary"
        >
          <Text style={styles.primaryLabel}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const BackgroundPermissionBanner = memo(BackgroundPermissionBannerImpl);
BackgroundPermissionBanner.displayName = 'BackgroundPermissionBanner';

export default BackgroundPermissionBanner;

const createStyles = (
  semantic: WantedSemanticTheme
): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.primaryBg,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: semantic.lineNormal,
      padding: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    title: {
      ...typeStyle('label2'),
      color: semantic.labelNormal,
    },
    body: {
      ...typeStyle('caption1'),
      color: semantic.labelAlt,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    secondaryBtn: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryLabel: {
      ...typeStyle('label2'),
      color: semantic.labelAlt,
    },
    primaryBtn: {
      minHeight: 44,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: 10,
      backgroundColor: semantic.primaryNormal,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryLabel: {
      ...typeStyle('label2'),
      color: semantic.labelOnColor,
    },
  });
