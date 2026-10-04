/**
 * GuidanceControls — fixed bottom bar of the live guidance screen.
 *
 * The design handoff only drew a neutral "안내 종료" button (auto-progress
 * prototype); the real app adds manual correction buttons because progress
 * is time-estimated and the rider is the ground truth ("탑승했어요" /
 * "환승 완료" rebase the tracking anchor).
 */
import React, { memo, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, Square } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface GuidanceControlsProps {
  /** Contextual confirm label ("탑승했어요" 등); null hides the pair (journey end). */
  nextLabel: string | null;
  prevDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  /**
   * Visual weight of the next button. 'primary' (default) is the bold CTA used
   * while holding on a board/transfer step (a real confirm). 'correction'
   * demotes it to a neutral surface (like 안내 종료) during ride/alight, where
   * the button only nudges the time estimate and isn't a required action.
   */
  nextEmphasis?: 'primary' | 'correction';
}

const GuidanceControlsImpl: React.FC<GuidanceControlsProps> = ({
  nextLabel,
  prevDisabled,
  onPrev,
  onNext,
  onExit,
  nextEmphasis = 'primary',
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  // Bottom-docked bar on a headerless root-stack screen: extend it behind the
  // Android navigation bar (edge-to-edge) instead of letting it be covered.
  const { bottom: bottomInset } = useSafeAreaInsets();

  return (
    <View testID="guidance-controls" style={[styles.bar, { paddingBottom: WANTED_TOKENS.spacing.s3 + bottomInset }]}>
      {nextLabel !== null && (
        <View style={styles.stepRow}>
          <Pressable
            onPress={onPrev}
            disabled={prevDisabled}
            style={[styles.prevButton, prevDisabled && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="이전 단계로 보정"
            accessibilityState={{ disabled: prevDisabled }}
            testID="guidance-prev"
          >
            <ChevronLeft
              size={18}
              color={prevDisabled ? semantic.labelDisabled : semantic.labelNeutral}
              strokeWidth={2.4}
            />
            <Text style={[styles.prevText, prevDisabled && styles.prevTextDisabled]}>이전</Text>
          </Pressable>
          <Pressable
            onPress={onNext}
            style={[styles.nextButton, nextEmphasis === 'correction' && styles.nextButtonCorrection]}
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            testID="guidance-next"
          >
            <Text style={[styles.nextText, nextEmphasis === 'correction' && styles.nextTextCorrection]}>
              {nextLabel}
            </Text>
          </Pressable>
        </View>
      )}
      <Pressable
        onPress={onExit}
        style={styles.exitButton}
        accessibilityRole="button"
        accessibilityLabel="안내 종료"
        testID="guidance-exit"
      >
        <Square size={14} color={semantic.labelNeutral} strokeWidth={2.4} />
        <Text style={styles.exitText}>안내 종료</Text>
      </Pressable>
    </View>
  );
};

export const GuidanceControls = memo(GuidanceControlsImpl);
GuidanceControls.displayName = 'GuidanceControls';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    bar: {
      backgroundColor: semantic.bgBase,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s3,
      paddingBottom: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    stepRow: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
    },
    prevButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      height: 52,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: 14,
      backgroundColor: semantic.bgSubtle,
    },
    disabled: {
      opacity: 0.5,
    },
    prevText: {
      fontSize: 15,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
    prevTextDisabled: {
      color: semantic.labelDisabled,
    },
    nextButton: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      backgroundColor: semantic.primaryNormal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextButtonCorrection: {
      backgroundColor: semantic.bgSubtle,
    },
    nextText: {
      fontSize: 15,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelOnColor,
      letterSpacing: -0.15,
    },
    nextTextCorrection: {
      color: semantic.labelStrong,
    },
    exitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 14,
      backgroundColor: semantic.bgSubtle,
    },
    exitText: {
      fontSize: 15,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.15,
    },
  });
