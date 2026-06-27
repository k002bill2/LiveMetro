/**
 * TrainMarkerOverlay — animated train-number cards for the realtime
 * train-position timeline (실시간 열차 위치).
 *
 * Rendered as a zero-height FlatList ListHeaderComponent so the cards live
 * in content coordinates and scroll with the list for free. Each card keeps
 * its component identity by trainNo; when the 30s poll moves a train to a
 * new station, the card slides to the new row offset via Animated.timing
 * instead of unmounting/remounting across rows.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';

import { useShouldReduceMotion } from '@/contexts/AccessibilityContext';
import type { TrainPosition } from '@/models/trainPosition';
import { positionStatusToDisplay } from '@/models/trainPosition';
import { TIMELINE_ROW_HEIGHT, RAIL_ZONE_WIDTH, MARKER_ZONE_WIDTH } from '@/components/station/StationTimelineRow';
import { addAlpha } from '@/utils/colorUtils';

/** Fixed card height — caption1(16) + caption2(14) + padding/borders. */
export const TRAIN_MARKER_HEIGHT = 38;

const STACK_GAP = 2;
const SLIDE_DURATION_MS = 600;
const FADE_IN_DURATION_MS = 250;
const ARROW_SIZE = 14;
const ARROW_BADGE_SIZE = 22;
const ARROW_CARD_GAP = 3;
const ARROW_TINT_ALPHA = 0.48;
const ARROW_STROKE_WIDTH = 2.5;
const ARROW_TRAVEL = 4;
const ARROW_LOOP_MS = 900;

/** A position row joined onto its timeline row index. */
export interface OverlayTrain {
  readonly train: TrainPosition;
  readonly stationIndex: number;
}

export interface TrainMarkerOverlayProps {
  trains: readonly OverlayTrain[];
  lineColor: string;
  testID?: string;
}

/**
 * Content-coordinate top for a marker: between-station trains (진입/전역출발)
 * sit on the upper rail half, at-station trains center on the dot; same-slot
 * trains stack downward so they never overlap.
 */
export const computeMarkerTop = (
  stationIndex: number,
  isBetween: boolean,
  stackIndex: number
): number => {
  const base = isBetween
    ? stationIndex * TIMELINE_ROW_HEIGHT
    : stationIndex * TIMELINE_ROW_HEIGHT + (TIMELINE_ROW_HEIGHT - TRAIN_MARKER_HEIGHT) / 2;
  return base + stackIndex * (TRAIN_MARKER_HEIGHT + STACK_GAP);
};

const isBetweenStatus = (train: TrainPosition): boolean =>
  train.status === 'entering' || train.status === 'departed_prev';

/** Stopped only at 도착; 출발/진입/전역출발(and unknown=운행중) are in motion. */
const isMoving = (train: TrainPosition): boolean => train.status !== 'arrived';

/**
 * Looping chevron above/below the card — continuous "이동 중" cue
 * between the 30s polls (cards themselves only slide when a poll moves them).
 */
const MovingArrow: React.FC<{
  direction: TrainPosition['direction'];
  lineColor: string;
  backgroundColor: string;
  cardWidth: number | null;
  testID?: string;
}> = ({ direction, lineColor, backgroundColor, cardWidth, testID }) => {
  const shouldReduceMotion = useShouldReduceMotion();
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reduce motion: skip the drifting loop — a static chevron is rendered below.
    if (shouldReduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: ARROW_LOOP_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, shouldReduceMotion]);

  const Chevron = direction === 'up' ? ChevronUp : ChevronDown;
  const arrowPlacementStyle = direction === 'up' ? styles.movingArrowUp : styles.movingArrowDown;
  const arrowCenterStyle =
    cardWidth === null
      ? styles.movingArrowCenterFallback
      : { left: Math.max(0, (cardWidth - ARROW_BADGE_SIZE) / 2) };
  const arrowTintColor = addAlpha(lineColor, ARROW_TINT_ALPHA);
  const arrowBaseStyle = [
    styles.movingArrow,
    arrowPlacementStyle,
    arrowCenterStyle,
    { backgroundColor, borderColor: arrowTintColor },
  ];

  // Reduce motion: the animated opacity rests at 0 (invisible), so a stopped loop
  // would erase the direction cue. Render a fixed-opacity static chevron instead.
  if (shouldReduceMotion) {
    return (
      <Animated.View
        style={[...arrowBaseStyle, { opacity: 0.72 }]}
        testID={testID}
      >
        <Chevron size={ARROW_SIZE} color={arrowTintColor} strokeWidth={ARROW_STROKE_WIDTH} />
      </Animated.View>
    );
  }

  // Up trains travel toward row 0 (screen-up); arrow drifts the same way.
  const translateY = phase.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'up' ? [ARROW_TRAVEL, -ARROW_TRAVEL] : [-ARROW_TRAVEL, ARROW_TRAVEL],
  });
  const opacity = phase.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[...arrowBaseStyle, { opacity, transform: [{ translateY }] }]}
      testID={testID}
    >
      <Chevron size={ARROW_SIZE} color={arrowTintColor} strokeWidth={ARROW_STROKE_WIDTH} />
    </Animated.View>
  );
};

const trainMarkerLabel = (train: TrainPosition): string => {
  const flags = [train.isExpress ? '급행' : null, train.isLastTrain ? '막차' : null]
    .filter(Boolean)
    .join('·');
  return flags ? `${train.trainNo} ${flags}` : train.trainNo;
};

interface TrainMarkerCardProps {
  train: TrainPosition;
  targetTop: number;
  lineColor: string;
  testID?: string;
}

const TrainMarkerCard: React.FC<TrainMarkerCardProps> = ({
  train,
  targetTop,
  lineColor,
  testID,
}) => {
  const semantic = useSemanticTokens();
  const [cardWidth, setCardWidth] = useState<number | null>(null);

  // Start at the current target so the first render does not slide in from 0.
  const translateY = useRef(new Animated.Value(targetTop)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      useNativeDriver: true,
    });
    fadeIn.start();
    return () => fadeIn.stop();
  }, [opacity]);

  useEffect(() => {
    const slide = Animated.timing(translateY, {
      toValue: targetTop,
      duration: SLIDE_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    slide.start();
    return () => slide.stop();
  }, [targetTop, translateY]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setCardWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  return (
    <Animated.View
      style={[
        styles.marker,
        {
          backgroundColor: semantic.bgBase,
          borderColor: lineColor,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      onLayout={handleLayout}
      testID={testID}
    >
      {isMoving(train) ? (
        <MovingArrow
          direction={train.direction}
          lineColor={lineColor}
          backgroundColor={semantic.bgBase}
          cardWidth={cardWidth}
          testID={testID ? `${testID}-moving` : undefined}
        />
      ) : null}
      <Text style={[styles.markerTrainNo, { color: semantic.labelStrong }]} numberOfLines={1}>
        {trainMarkerLabel(train)}
      </Text>
      <Text style={[styles.markerDest, { color: semantic.labelAlt }]} numberOfLines={1}>
        {train.terminalName}행 {positionStatusToDisplay(train.status)}
      </Text>
    </Animated.View>
  );
};

const TrainMarkerOverlayImpl: React.FC<TrainMarkerOverlayProps> = ({
  trains,
  lineColor,
  testID,
}) => {
  const placed = useMemo(() => {
    const stackCount = new Map<string, number>();
    return trains.map(({ train, stationIndex }) => {
      const between = isBetweenStatus(train);
      const slotKey = `${stationIndex}:${between ? 'b' : 'a'}`;
      const stackIndex = stackCount.get(slotKey) ?? 0;
      stackCount.set(slotKey, stackIndex + 1);
      return { train, targetTop: computeMarkerTop(stationIndex, between, stackIndex) };
    });
  }, [trains]);

  return (
    <View
      style={styles.overlay}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {placed.map(({ train, targetTop }) => (
        <TrainMarkerCard
          key={train.trainNo}
          train={train}
          targetTop={targetTop}
          lineColor={lineColor}
          testID={testID ? `${testID}-marker-${train.trainNo}` : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    height: 0,
    overflow: 'visible',
    zIndex: 10,
  },
  marker: {
    position: 'absolute',
    top: 0,
    left: RAIL_ZONE_WIDTH + WANTED_TOKENS.spacing.s1,
    height: TRAIN_MARKER_HEIGHT,
    maxWidth: MARKER_ZONE_WIDTH,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: WANTED_TOKENS.radius.r4,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    overflow: 'visible',
  },
  movingArrow: {
    position: 'absolute',
    width: ARROW_BADGE_SIZE,
    height: ARROW_BADGE_SIZE,
    borderWidth: 1.5,
    borderRadius: ARROW_BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 2,
  },
  movingArrowUp: {
    top: -(ARROW_BADGE_SIZE + ARROW_CARD_GAP),
  },
  movingArrowDown: {
    bottom: -(ARROW_BADGE_SIZE + ARROW_CARD_GAP),
  },
  movingArrowCenterFallback: {
    left: '50%',
    marginLeft: -(ARROW_BADGE_SIZE / 2),
  },
  markerTrainNo: {
    ...typeStyle('caption1', '700'),
  },
  markerDest: {
    ...typeStyle('caption2', '500'),
  },
});

export const TrainMarkerOverlay = memo(TrainMarkerOverlayImpl);
TrainMarkerOverlay.displayName = 'TrainMarkerOverlay';
