/**
 * StationTimelineRow — one station row of the realtime train-position
 * timeline (실시간 열차 위치).
 *
 * Layout: fixed-height flex row with an absolutely-positioned vertical rail
 * (RN has no CSS grid — rail halves are cut at the first/last row of a
 * non-loop branch). Visual train cards are NOT rendered here — they live in
 * TrainMarkerOverlay so they can animate across rows; this row only reserves
 * the marker column and announces its trains for accessibility.
 */
import React, { memo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { StyleSheet, Text, View } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';

import type { TrainPosition } from '@/models/trainPosition';
import { positionStatusToDisplay } from '@/models/trainPosition';

/** Fixed row height — required by FlatList getItemLayout. */
export const TIMELINE_ROW_HEIGHT = 72;

/** Rail column width — TrainMarkerOverlay offsets its cards past this. */
export const RAIL_ZONE_WIDTH = 36;

/** Marker column width reserved between the rail and the station name. */
export const MARKER_ZONE_WIDTH = 120;

export interface StationTimelineRowProps {
  stationName: string;
  isFirst: boolean;
  isLast: boolean;
  /** Loop branches render a continuous rail (no endpoint cut). */
  isLoop: boolean;
  /** Highlight the station the user navigated from. */
  isOrigin: boolean;
  trains: readonly TrainPosition[];
  lineColor: string;
  testID?: string;
}

const StationTimelineRowImpl: React.FC<StationTimelineRowProps> = ({
  stationName,
  isFirst,
  isLast,
  isLoop,
  isOrigin,
  trains,
  lineColor,
  testID,
}) => {
  const semantic = useSemanticTokens();

  const cutTop = !isLoop && isFirst;
  const cutBottom = !isLoop && isLast;

  const a11ySummary =
    trains.length > 0
      ? `${stationName}, 열차 ${trains.length}대 — ${trains
          .map((t) => `${t.terminalName}행 ${positionStatusToDisplay(t.status)}`)
          .join(', ')}`
      : stationName;

  return (
    <View
      style={styles.row}
      testID={testID}
      accessible
      accessibilityLabel={a11ySummary}
    >
      <View style={styles.railZone}>
        {!cutTop ? (
          <View style={[styles.railTop, { backgroundColor: lineColor }]} />
        ) : null}
        {!cutBottom ? (
          <View style={[styles.railBottom, { backgroundColor: lineColor }]} />
        ) : null}
        <View
          style={[
            styles.dot,
            { borderColor: lineColor, backgroundColor: semantic.bgBase },
            isOrigin ? { backgroundColor: lineColor } : null,
          ]}
        />
      </View>

      <View style={styles.nameZone}>
        <Text
          style={[
            typeStyle('label1', isOrigin ? '700' : '500'),
            { color: isOrigin ? semantic.labelStrong : semantic.labelNeutral },
          ]}
          numberOfLines={1}
        >
          {stationName}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    height: TIMELINE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  railZone: {
    width: RAIL_ZONE_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railTop: {
    position: 'absolute',
    top: 0,
    height: TIMELINE_ROW_HEIGHT / 2,
    width: 4,
    alignSelf: 'center',
  },
  railBottom: {
    position: 'absolute',
    bottom: 0,
    height: TIMELINE_ROW_HEIGHT / 2,
    width: 4,
    alignSelf: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
  },
  nameZone: {
    flex: 1,
    marginLeft: WANTED_TOKENS.spacing.s2 + MARKER_ZONE_WIDTH,
    justifyContent: 'center',
  },
});

export const StationTimelineRow = memo(StationTimelineRowImpl);
StationTimelineRow.displayName = 'StationTimelineRow';
