/**
 * CommuteAlertRow — a single commute leg (출근/퇴근) in the 알림 시간대 screen.
 *
 * Layout (Wanted handoff):
 *   [Pill 출근]  출발 시점부터 알림
 *   [ 시작  HH:MM ] —  [ 종료  HH:MM ]
 *
 * Honesty contract: both time boxes are **read-only**. The window is derived
 * from the commute's single `departureTime`, which is owned by CommuteSettings
 * (the canonical commute editor, used app-wide) — not editable here, so this
 * screen can't fork or desync that value. When the commute isn't set
 * (`locked`), the start box becomes a CTA: tapping it fires `onLockedPress`
 * (route the user to set the commute up). The end box is always plain display.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pill, type PillTone } from '@/components/design/Pill';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useSemanticTokens } from '@/services/theme';
import TimeFieldBox from '@/components/settings/TimeFieldBox';

interface CommuteAlertRowProps {
  /** Short badge text, e.g. "출근" / "퇴근". */
  badgeLabel: string;
  badgeTone?: PillTone;
  /** Caption beside the badge describing when alerts fire. */
  caption: string;
  /** Read-only window start ("HH:MM") — the commute's departure time. */
  startTime: string;
  /** Read-only window end ("HH:MM") — derived from the start. */
  endTime: string;
  /**
   * Whether the commute is unset. When true the start box becomes a tappable
   * CTA (fires `onLockedPress`) instead of plain read-only display.
   */
  locked?: boolean;
  /** Tap handler for the locked start box — route to commute setup. */
  onLockedPress?: () => void;
  testID?: string;
}

export const CommuteAlertRow: React.FC<CommuteAlertRowProps> = ({
  badgeLabel,
  badgeTone = 'primary',
  caption,
  startTime,
  endTime,
  locked = false,
  onLockedPress,
  testID,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerRow}>
        <Pill tone={badgeTone} size="sm">
          {badgeLabel}
        </Pill>
        <Text style={styles.caption}>{caption}</Text>
      </View>

      <View style={styles.boxesRow}>
        <TimeFieldBox
          label="시작"
          value={startTime}
          locked={locked}
          onLockedPress={onLockedPress}
          accessibilityLabel={
            locked
              ? `${badgeLabel} 경로 미설정, 출퇴근 설정으로 이동하려면 누르세요`
              : `${badgeLabel} 알림 시작 시간 ${startTime}`
          }
          testID={testID ? `${testID}-start` : undefined}
        />
        <Text style={styles.dash} accessible={false}>
          —
        </Text>
        <TimeFieldBox
          label="종료"
          value={endTime}
          accessibilityLabel={`${badgeLabel} 알림 종료 시간 ${endTime}`}
          testID={testID ? `${testID}-end` : undefined}
        />
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    caption: {
      flexShrink: 1,
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    boxesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    dash: {
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
  });

export default CommuteAlertRow;
