/**
 * SelectableTrainCard — a radio-selectable upcoming-train row for the
 * "탑승 열차 선택" screen (Wanted Design System).
 *
 * Mirrors the design handoff:
 *   ┌ (○) [2] 잠실 방면 [일반]              1분 47초 ┐
 *   │       정시 운행 · 10량 · 혼잡        추천 7번 칸 │
 *   │ ─ when selected ─────────────────────────────── │
 *   │ 탈 칸을 선택하세요        ← 잠실 진행 방향 →       │
 *   │ ▮▮▮▮▮▮▮★▮▮  (tap a bar to choose your car)       │
 *   │ ✨ 7번 칸이 가장 여유로워요 (탭해서 선택)          │
 *   └──────────────────────────────────────────────────┘
 *
 * Presentational only: all data (ETA, congestion %, recommended car) is
 * computed by the parent screen and passed in. The congestion strip renders
 * ONLY when `selected` — the screen subscribes to congestion for the selected
 * train alone to avoid N concurrent Firestore subscriptions.
 */
import React, { memo, useMemo, useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { WANTED_TOKENS, typeStyle, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { LineBadge, Pill, congFromPct, CONG_TONE, type LineId } from '@/components/design';
import type { TrainType } from '@/models/train';

export interface SelectableTrainCardProps {
  line: LineId;
  /** Final destination, rendered as "{destination} 방면". */
  destination: string;
  /** Minutes portion of the remaining time. */
  minutes: number;
  /** Seconds portion (0–59), padded to 2 digits. */
  seconds: number;
  /** Whether this train is the chosen boarding train (radio on + congestion strip). */
  selected: boolean;
  /** Selection handler (whole card is the touch target). */
  onSelect: () => void;
  /** Service tier — always shown as a small label (일반/급행/특급). */
  trainType?: TrainType;
  /** Minute-level delay; >0 swaps the subtitle to "지연 N분". */
  delayMinutes?: number;
  /** Per-car congestion percentages (0–100). Strip renders only when `selected`. */
  carCongestion?: readonly number[];
  /** 1-based least-congested car to highlight with a ★, or null when unknown. */
  recommendedCar?: number | null;
  /** 1-based car the user tapped (distinct highlight from the recommendation). */
  selectedCar?: number | null;
  /** Car-tap handler (1-based car number). */
  onSelectCar?: (carNumber: number) => void;
  /** Overall congestion label (e.g. '혼잡'), appended to the status row when known. */
  congestionLabel?: string | null;
  testID?: string;
}

const TIER_LABEL: Record<TrainType, string> = {
  normal: '일반',
  express: '급행',
  rapid: '특급',
};

const SelectableTrainCardImpl: React.FC<SelectableTrainCardProps> = ({
  line,
  destination,
  minutes,
  seconds,
  selected,
  onSelect,
  trainType = 'normal',
  delayMinutes = 0,
  carCongestion,
  recommendedCar = null,
  selectedCar = null,
  onSelectCar,
  congestionLabel = null,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const totalSeconds = Math.max(
    0,
    Math.floor(minutes) * 60 + Math.max(0, Math.floor(seconds))
  );
  const showImminentOnly = totalSeconds === 0;

  const hasCongestion = !!carCongestion && carCongestion.length > 0;
  const carCount = carCongestion?.length ?? 0;

  const handleSelectCar = useCallback(
    (carNumber: number) => () => onSelectCar?.(carNumber),
    [onSelectCar]
  );

  const cardStyle = useMemo<ViewStyle>(() => {
    const base: ViewStyle = {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
    };
    return selected
      ? {
          ...base,
          borderWidth: 2,
          borderColor: semantic.primaryNormal,
          shadowColor: WANTED_TOKENS.blue[500],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 4,
        }
      : { ...base, borderWidth: 1, borderColor: semantic.lineSubtle };
  }, [selected, semantic]);

  const destinationStyle: TextStyle = {
    ...typeStyle('body2', '800'),
    color: semantic.labelStrong,
  };
  const subtitleStyle: TextStyle = {
    marginTop: 2,
    ...typeStyle('caption1'),
    color: delayMinutes > 0 ? WANTED_TOKENS.status.red500 : semantic.labelAlt,
  };
  const minutesNumStyle: TextStyle = {
    fontSize: 26,
    fontFamily: weightToFontFamily('800'),
    color: selected ? semantic.primaryNormal : semantic.labelStrong,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  };
  const minutesUnitStyle: TextStyle = {
    ...typeStyle('label2', '700'),
    color: selected ? semantic.primaryNormal : semantic.labelNeutral,
    marginLeft: 1,
  };
  const secondsStyle: TextStyle = {
    ...typeStyle('label2', '700'),
    color: semantic.labelAlt,
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
  };

  const recommendationText =
    recommendedCar != null ? `${recommendedCar}번 칸이 가장 여유로워요` : null;

  return (
    <TouchableOpacity
      testID={testID}
      style={cardStyle}
      onPress={onSelect}
      activeOpacity={0.85}
      accessible
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${line}호선 ${destination} 방면, ${
        showImminentOnly ? '곧 도착' : `${minutes}분 ${seconds}초 후`
      }`}
    >
      <View style={styles.headerRow}>
        <View
          testID={testID ? `${testID}-radio` : undefined}
          style={[
            styles.radio,
            { borderColor: selected ? semantic.primaryNormal : semantic.lineSubtle },
          ]}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
        >
          {selected ? (
            <View style={[styles.radioDot, { backgroundColor: semantic.primaryNormal }]} />
          ) : null}
        </View>

        <LineBadge line={line} size={24} />

        <View style={styles.destBlock}>
          <View style={styles.destLine}>
            <Text style={destinationStyle} numberOfLines={1}>
              {`${destination} 방면`}
            </Text>
            <View style={[styles.tierBadge, { backgroundColor: semantic.bgSubtle }]}>
              <Text style={[styles.tierText, { color: semantic.labelNeutral }]}>
                {TIER_LABEL[trainType]}
              </Text>
            </View>
          </View>
          <Text style={subtitleStyle} numberOfLines={1}>
            {delayMinutes > 0 ? `지연 ${delayMinutes}분` : '정시 운행'}
            {selected && hasCongestion ? ` · ${carCount}량` : ''}
            {selected && congestionLabel ? ` · ${congestionLabel}` : ''}
          </Text>
        </View>

        <View style={styles.timeBlock}>
          {showImminentOnly ? (
            <Pill tone="primary" size="sm" testID={testID ? `${testID}-imminent` : undefined}>
              곧 도착
            </Pill>
          ) : (
            <View style={styles.timeRow}>
              <Text style={minutesNumStyle}>{minutes}</Text>
              <Text style={minutesUnitStyle}>분</Text>
              <Text style={secondsStyle}>{`${String(seconds).padStart(2, '0')}초`}</Text>
            </View>
          )}
          {selected && recommendedCar != null ? (
            <Text style={[styles.recoHint, { color: semantic.primaryNormal }]}>
              {`추천 ${recommendedCar}번 칸`}
            </Text>
          ) : null}
        </View>
      </View>

      {selected ? (
        hasCongestion ? (
          <View
            testID={testID ? `${testID}-congestion` : undefined}
            style={[styles.congestionWrap, { borderTopColor: semantic.lineSubtle }]}
          >
            <View style={styles.congestionHeader}>
              <Text style={[styles.congestionLabel, { color: semantic.labelAlt }]}>
                탈 칸을 선택하세요
              </Text>
              <Text style={[styles.congestionAxis, { color: semantic.labelAlt }]}>
                {`← ${destination} 진행 방향 →`}
              </Text>
            </View>

            <View style={styles.barRow}>
              {carCongestion!.map((pct, idx) => {
                const carNumber = idx + 1;
                const tone = congFromPct(pct);
                const color = CONG_TONE[tone].color;
                const clamped = Math.max(0, Math.min(100, pct));
                const isRecommended = recommendedCar === carNumber;
                const isPicked = selectedCar === carNumber;
                return (
                  <TouchableOpacity
                    key={carNumber}
                    testID={testID ? `${testID}-car-${carNumber}` : undefined}
                    style={styles.barColumn}
                    onPress={handleSelectCar(carNumber)}
                    activeOpacity={0.7}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ selected: isPicked }}
                    accessibilityLabel={`${carNumber}번 칸, ${CONG_TONE[tone].label}${
                      isRecommended ? ', 추천' : ''
                    }`}
                  >
                    <View style={styles.starSlot}>
                      {isRecommended ? (
                        <Star size={10} color={semantic.primaryNormal} fill={semantic.primaryNormal} />
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.barTrack,
                        { backgroundColor: semantic.bgSubtle },
                        isPicked && {
                          borderWidth: 2,
                          borderColor: semantic.primaryNormal,
                        },
                      ]}
                    >
                      <View
                        style={[styles.barFill, { backgroundColor: color, height: `${clamped}%` }]}
                      />
                    </View>
                    <Text style={[styles.barNum, { color: semantic.labelAlt }]}>{carNumber}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {recommendationText ? (
              <View
                testID={testID ? `${testID}-recommendation` : undefined}
                style={[styles.recoBanner, { backgroundColor: semantic.bgSubtle }]}
              >
                <Text style={styles.recoEmoji}>✨</Text>
                <Text style={[styles.recoText, { color: semantic.labelNeutral }]}>
                  {recommendationText}
                </Text>
                <Text style={[styles.recoHintText, { color: semantic.labelAlt }]}>
                  (탭해서 선택)
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View
            testID={testID ? `${testID}-congestion-empty` : undefined}
            style={[styles.congestionWrap, { borderTopColor: semantic.lineSubtle }]}
            accessible
            accessibilityRole="text"
            accessibilityLabel="혼잡도 정보 준비 중. 사용자 제보가 쌓이면 표시됩니다."
          >
            <Text style={[styles.emptyText, { color: semantic.labelNeutral }]}>
              혼잡도 정보 준비 중
            </Text>
            <Text style={[styles.emptyHint, { color: semantic.labelAlt }]}>
              사용자 제보가 쌓이면 칸별로 안내해 드려요
            </Text>
          </View>
        )
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  destBlock: {
    flex: 1,
  },
  destLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 10,
    fontFamily: weightToFontFamily('700'),
  },
  timeBlock: {
    alignItems: 'flex-end',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  recoHint: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: weightToFontFamily('700'),
  },
  congestionWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  congestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  congestionLabel: {
    fontSize: 11,
    fontFamily: weightToFontFamily('700'),
  },
  congestionAxis: {
    fontSize: 10,
    fontFamily: weightToFontFamily('600'),
  },
  barRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  starSlot: {
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    width: '100%',
    height: 30,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
  },
  barNum: {
    fontSize: 9,
    fontFamily: weightToFontFamily('700'),
  },
  recoBanner: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: WANTED_TOKENS.radius.r5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recoEmoji: {
    fontSize: 12,
  },
  recoText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('600'),
  },
  recoHintText: {
    fontSize: 11,
    fontFamily: weightToFontFamily('500'),
  },
  emptyText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('700'),
  },
  emptyHint: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: weightToFontFamily('500'),
  },
});

export const SelectableTrainCard = memo(SelectableTrainCardImpl);
SelectableTrainCard.displayName = 'SelectableTrainCard';
