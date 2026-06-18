/**
 * GuidanceNowCard — the "지금 무엇을 해야 하는가" card of the live guidance
 * screen (claude.ai/design handoff: line-color header + 탑승 중 pill, next
 * stop countdown, in-leg mini rail, stations-to-alight footer).
 *
 * The handoff only drew the riding state; waiting states (board/transfer)
 * reuse the same card grammar with a live next-train chip instead of the
 * estimated countdown — platform wait is realtime data, never estimated.
 */
import React, { memo, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DoorOpen, Footprints, MapPin, TrainFront } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { computeRideProgress } from '@/services/guidance/guidanceSteps';
import type { GuidanceStep, RideStep } from '@/models/guidance';

/** Callbacks for the "탑승하셨나요?" soft-confirm row. */
export interface SoftConfirmHandlers {
  readonly onYes: () => void;
  readonly onNotYet: () => void;
}

interface GuidanceNowCardProps {
  step: GuidanceStep;
  /** Seconds spent inside the current step (drives ride countdown). */
  elapsedInStepSec: number;
  /** Live next-train text for waiting steps (e.g. "3분 24초 후 도착"), null when unknown. */
  liveWaitText?: string | null;
  /** When set, renders the soft-confirm row (board/transfer waiting steps only). */
  softConfirm?: SoftConfirmHandlers | null;
}

const formatMinSec = (totalSec: number): string => {
  const safe = Math.max(0, Math.round(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`;
};

/** Window of rail stations around the next stop (≤4 like the handoff). */
const railWindow = (
  ride: RideStep,
  nextHopIndex: number
): { names: readonly string[]; nextPos: number; alightPos: number | null } => {
  const names = [ride.fromStationName, ...ride.hops.map(h => h.toStationName)];
  const nextPos = nextHopIndex + 1;
  const start = Math.max(0, Math.min(nextPos - 1, names.length - 4));
  const windowNames = names.slice(start, start + 4);
  const alightAbsolute = names.length - 1;
  const alightPos =
    alightAbsolute >= start && alightAbsolute < start + 4 ? alightAbsolute - start : null;
  return { names: windowNames, nextPos: nextPos - start, alightPos };
};

const GuidanceNowCardImpl: React.FC<GuidanceNowCardProps> = ({
  step,
  elapsedInStepSec,
  liveWaitText,
  softConfirm,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const lineId = step.kind === 'transfer' ? step.toLineId : step.lineId;
  const lineColor = getSubwayLineColor(lineId);

  const headerTitle =
    step.kind === 'board' || step.kind === 'ride'
      ? `${step.lineName}${step.direction ? ` · ${step.direction} 방면` : ''}`
      : step.kind === 'transfer'
        ? `${step.toLineName} 환승${step.direction ? ` · ${step.direction} 방면` : ''}`
        : '목적지 도착';

  const headerBadge =
    step.kind === 'board'
      ? '탑승 대기'
      : step.kind === 'ride'
        ? '탑승 중'
        : step.kind === 'transfer'
          ? '환승 중'
          : '도착';

  return (
    <View style={styles.card} testID="guidance-now-card">
      <View style={[styles.cardHeader, { backgroundColor: lineColor }]}>
        <TrainFront size={19} color={WANTED_TOKENS.light.labelOnColor} strokeWidth={2.2} />
        <Text style={styles.cardHeaderTitle}>{headerTitle}</Text>
        <View style={styles.cardHeaderBadge}>
          <View style={styles.cardHeaderBadgeDot} />
          <Text style={styles.cardHeaderBadgeText}>{headerBadge}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {step.kind === 'alight' && (
          <View style={styles.arrivedRow}>
            <View style={styles.arrivedIconWrap}>
              <DoorOpen size={22} color={semantic.primaryNormal} strokeWidth={2.2} />
            </View>
            <View style={styles.arrivedTextWrap}>
              <Text style={styles.arrivedTitle}>{`${step.stationName} 도착 · 하차하세요`}</Text>
              <Text style={styles.arrivedSub}>목적지에 도착했어요. 안내를 종료해 주세요</Text>
            </View>
          </View>
        )}

        {(step.kind === 'board' || step.kind === 'transfer') && (
          <View>
            <Text style={styles.smallLabel}>
              {step.kind === 'board' ? '탑승할 역' : '환승할 역'}
            </Text>
            <Text style={styles.bigStation}>{step.stationName}</Text>
            {step.kind === 'transfer' && (
              <View style={styles.walkRow}>
                <Footprints size={14} color={semantic.labelAlt} strokeWidth={2.2} />
                <Text style={styles.walkText}>
                  {`환승 도보 약 ${Math.max(1, Math.ceil(step.durationMinutes))}분 — ${formatMinSec(step.durationMinutes * 60 - elapsedInStepSec)} 남음`}
                </Text>
              </View>
            )}
            <View style={styles.liveChip} testID="guidance-live-chip">
              <View style={[styles.liveChipDot, { backgroundColor: lineColor }]} />
              <Text style={styles.liveChipText}>
                {liveWaitText ?? '실시간 도착 정보를 불러오는 중'}
              </Text>
            </View>
            {softConfirm && (
              <View style={styles.softConfirmRow} testID="guidance-soft-confirm">
                <Text style={styles.softConfirmLabel}>탑승하셨나요?</Text>
                <View style={styles.softConfirmButtons}>
                  <Pressable
                    onPress={softConfirm.onNotYet}
                    style={styles.softConfirmNotYet}
                    accessibilityRole="button"
                    accessibilityLabel="아직 탑승하지 않았어요"
                    testID="guidance-soft-confirm-notyet"
                  >
                    <Text style={styles.softConfirmNotYetText}>아직이에요</Text>
                  </Pressable>
                  <Pressable
                    onPress={softConfirm.onYes}
                    style={styles.softConfirmYes}
                    accessibilityRole="button"
                    accessibilityLabel="탑승했어요"
                    testID="guidance-soft-confirm-yes"
                  >
                    <Text style={styles.softConfirmYesText}>예</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {step.kind === 'ride' && (
          <RideBody
            step={step}
            elapsedInStepSec={elapsedInStepSec}
            lineColor={lineColor}
            semantic={semantic}
            styles={styles}
          />
        )}
      </View>
    </View>
  );
};

interface RideBodyProps {
  step: RideStep;
  elapsedInStepSec: number;
  lineColor: string;
  semantic: WantedSemanticTheme;
  styles: ReturnType<typeof createStyles>;
}

const RideBody: React.FC<RideBodyProps> = ({
  step,
  elapsedInStepSec,
  lineColor,
  semantic,
  styles,
}) => {
  const { nextHopIndex, secToNextStop } = computeRideProgress(step, elapsedInStepSec);
  const stopsLeft = step.hops.length - nextHopIndex;
  const isNextAlight = nextHopIndex === step.hops.length - 1;
  const nextStationName = step.hops[nextHopIndex]?.toStationName ?? step.toStationName;
  const rail = railWindow(step, nextHopIndex);
  const remainingRideSec =
    secToNextStop +
    step.hops.slice(nextHopIndex + 1).reduce((acc, h) => acc + h.minutes * 60, 0);

  return (
    <View>
      <View style={styles.rideTopRow}>
        <View>
          <Text style={styles.smallLabel}>{isNextAlight ? '곧 하차역' : '다음 정차'}</Text>
          <View style={styles.nextStationRow}>
            <Text style={styles.bigStation} testID="guidance-next-station">
              {nextStationName}
            </Text>
            {isNextAlight && (
              <View style={styles.alightBadge}>
                <Text style={styles.alightBadgeText}>하차</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.countdownWrap}>
          <Text style={[styles.countdown, { color: lineColor }]} testID="guidance-countdown">
            {formatMinSec(secToNextStop)}
          </Text>
          <Text style={styles.countdownCaption}>후 도착</Text>
        </View>
      </View>

      <View style={styles.railWrap}>
        <View style={styles.railTrack} />
        <View
          style={[
            styles.railFill,
            {
              backgroundColor: lineColor,
              width: `${rail.names.length <= 1 ? 0 : (Math.max(0, rail.nextPos - 1) / (rail.names.length - 1)) * 100}%`,
            },
          ]}
        />
        <View style={styles.railStops}>
          {rail.names.map((name, i) => {
            const passed = i < rail.nextPos;
            const isNow = i === rail.nextPos;
            const isAlight = rail.alightPos !== null && i === rail.alightPos;
            return (
              <View key={`${name}-${i}`} style={styles.railStop}>
                <View
                  style={[
                    styles.railDot,
                    (passed || isNow) && !isAlight && { backgroundColor: lineColor, borderWidth: 0 },
                    isAlight && styles.railDotAlight,
                  ]}
                >
                  {isAlight && <View style={styles.railDotAlightInner} />}
                </View>
                <Text
                  style={[
                    styles.railStopName,
                    isNow && styles.railStopNameNow,
                    isAlight && styles.railStopNameAlight,
                  ]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.alightSummaryRow}>
        <MapPin size={14} color={semantic.primaryNormal} strokeWidth={2.2} />
        <Text style={styles.alightSummaryText}>
          {`${step.toStationName} 하차까지 `}
          <Text style={styles.alightSummaryStrong}>{`${stopsLeft}개 역`}</Text>
          {` · 약 ${Math.max(1, Math.ceil(remainingRideSec / 60))}분`}
        </Text>
      </View>
    </View>
  );
};

export const GuidanceNowCard = memo(GuidanceNowCardImpl);
GuidanceNowCard.displayName = 'GuidanceNowCard';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: 12,
    },
    cardHeaderTitle: {
      flex: 1,
      fontSize: 14,
      fontFamily: weightToFontFamily('800'),
      color: WANTED_TOKENS.light.labelOnColor,
      letterSpacing: -0.14,
    },
    cardHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    cardHeaderBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: WANTED_TOKENS.light.labelOnColor,
    },
    cardHeaderBadgeText: {
      fontSize: 11.5,
      fontFamily: weightToFontFamily('800'),
      color: WANTED_TOKENS.light.labelOnColor,
    },
    cardBody: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s4,
      paddingBottom: 18,
    },
    smallLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    bigStation: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.56,
      marginTop: 3,
    },
    nextStationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    alightBadge: {
      backgroundColor: semantic.primaryBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    alightBadgeText: {
      fontSize: 11,
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
    },
    rideTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    countdownWrap: {
      alignItems: 'flex-end',
    },
    countdown: {
      fontSize: 22,
      fontFamily: weightToFontFamily('800'),
      letterSpacing: -0.44,
    },
    countdownCaption: {
      fontSize: 11,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 1,
    },
    railWrap: {
      marginTop: 18,
      marginBottom: 4,
    },
    railTrack: {
      position: 'absolute',
      left: 8,
      right: 8,
      top: 7,
      height: 3,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.lineNormal,
    },
    railFill: {
      position: 'absolute',
      left: 8,
      top: 7,
      height: 3,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    railStops: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    railStop: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    railDot: {
      width: 14,
      height: 14,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 2,
      borderColor: semantic.lineNormal,
    },
    railDotAlight: {
      width: 18,
      height: 18,
      backgroundColor: semantic.bgBase,
      borderWidth: 3,
      borderColor: semantic.primaryNormal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    railDotAlightInner: {
      width: 6,
      height: 6,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.primaryNormal,
    },
    railStopName: {
      fontSize: 11,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    railStopNameNow: {
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    railStopNameAlight: {
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
    },
    alightSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
    },
    alightSummaryText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
    alightSummaryStrong: {
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    walkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    walkText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
    liveChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      alignSelf: 'flex-start',
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: WANTED_TOKENS.radius.pill,
      marginTop: 12,
    },
    liveChipDot: {
      width: 7,
      height: 7,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    liveChipText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    softConfirmRow: {
      marginTop: 14,
      gap: 8,
    },
    softConfirmLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.14,
    },
    softConfirmButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    softConfirmNotYet: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: semantic.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    softConfirmNotYetText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
    softConfirmYes: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: semantic.primaryNormal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    softConfirmYesText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelOnColor,
    },
    arrivedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    arrivedIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: semantic.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrivedTextWrap: {
      flex: 1,
    },
    arrivedTitle: {
      fontSize: 19,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.19,
    },
    arrivedSub: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
  });
