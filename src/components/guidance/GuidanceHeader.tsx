/**
 * GuidanceHeader — top section of the live guidance screen.
 *
 * Visual spec from the claude.ai/design handoff (live-nav.jsx): top bar with
 * dismiss + "실시간 길안내" live badge, then the destination ETA as the
 * single largest piece of information (big clock time + remaining minutes),
 * and a whole-journey progress bar with a knob.
 */
import React, { memo, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface GuidanceHeaderProps {
  fromStationName: string;
  toStationName: string;
  /** Estimated arrival, epoch ms. */
  etaMs: number;
  /** Estimated seconds to destination. */
  remainingSeconds: number;
  /** Whole-journey progress, 0..1. */
  progress: number;
  onClose: () => void;
}

const formatEta = (ms: number): { meridiem: string; time: string } => {
  const d = new Date(ms);
  const hours = d.getHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return {
    meridiem: hours < 12 ? '오전' : '오후',
    time: `${h12}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
};

const GuidanceHeaderImpl: React.FC<GuidanceHeaderProps> = ({
  fromStationName,
  toStationName,
  etaMs,
  remainingSeconds,
  progress,
  onClose,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const eta = formatEta(etaMs);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const clamped = Math.max(0.02, Math.min(0.99, progress));

  return (
    <View>
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={styles.topBarButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="길안내 닫기"
          testID="guidance-close"
        >
          <ChevronDown size={24} color={semantic.labelNeutral} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.titleWrap}>
          <View style={styles.liveDot} />
          <Text style={styles.title}>실시간 길안내</Text>
        </View>
        <View style={styles.topBarButton} />
      </View>

      <View style={styles.etaSection}>
        <View style={styles.etaRow}>
          <View>
            <View style={styles.etaLabelRow}>
              <View style={styles.etaLabelDot} />
              <Text style={styles.etaLabel}>{`${toStationName} 도착 예정`}</Text>
            </View>
            <View style={styles.etaTimeRow}>
              <Text style={styles.etaTime} testID="guidance-eta-time">
                {eta.time}
              </Text>
              <Text style={styles.etaMeridiem}>{eta.meridiem}</Text>
            </View>
          </View>
          <View style={styles.remainWrap}>
            <View style={styles.remainRow}>
              <Text style={styles.remainNumber} testID="guidance-remaining-min">
                {remainingMinutes}
              </Text>
              <Text style={styles.remainUnit}>분</Text>
            </View>
            <Text style={styles.remainCaption}>남음</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${clamped * 100}%` }]} />
            <View style={[styles.progressKnob, { left: `${clamped * 100}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{fromStationName}</Text>
            <Text style={styles.progressLabel}>{toStationName}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const GuidanceHeader = memo(GuidanceHeaderImpl);
GuidanceHeader.displayName = 'GuidanceHeader';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    // Horizontal padding comes from the screen's list container.
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      marginHorizontal: -WANTED_TOKENS.spacing.s2,
    },
    topBarButton: {
      width: 44,
      height: 44,
      borderRadius: WANTED_TOKENS.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.statusPositive,
    },
    title: {
      fontSize: 15,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.15,
    },
    etaSection: {
      paddingTop: 6,
      paddingBottom: WANTED_TOKENS.spacing.s4,
    },
    etaRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    etaLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    etaLabelDot: {
      width: 7,
      height: 7,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.primaryNormal,
    },
    etaLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    etaTimeRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 4,
    },
    etaTime: {
      fontSize: 40,
      lineHeight: 44,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -1.2,
    },
    etaMeridiem: {
      fontSize: 15,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
    remainWrap: {
      alignItems: 'flex-end',
    },
    remainRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    remainNumber: {
      fontSize: 26,
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
      letterSpacing: -0.5,
    },
    remainUnit: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryNormal,
    },
    remainCaption: {
      fontSize: 11.5,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    progressWrap: {
      marginTop: 14,
    },
    progressTrack: {
      height: 6,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.lineNormal,
    },
    progressFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.primaryNormal,
    },
    progressKnob: {
      position: 'absolute',
      top: -4,
      width: 14,
      height: 14,
      marginLeft: -7,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 3,
      borderColor: semantic.primaryNormal,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 7,
    },
    progressLabel: {
      fontSize: 11,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
  });
