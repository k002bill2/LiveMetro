/**
 * StationTimelineRow — one station row of the realtime train-position
 * timeline (실시간 열차 위치).
 *
 * Layout: fixed-height flex row with an absolutely-positioned vertical rail
 * (RN has no CSS grid — rail halves are cut at the first/last row of a
 * non-loop branch). Train markers sit on the rail: at the station dot for
 * arrived/departed trains, on the upper half (toward the previous station)
 * for entering / departed-previous trains.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import type { TrainPosition } from '@/models/trainPosition';
import { positionStatusToDisplay } from '@/models/trainPosition';

/** Fixed row height — required by FlatList getItemLayout. */
export const TIMELINE_ROW_HEIGHT = 72;

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

const trainMarkerLabel = (train: TrainPosition): string => {
  const flags = [train.isExpress ? '급행' : null, train.isLastTrain ? '막차' : null]
    .filter(Boolean)
    .join('·');
  return flags ? `${train.trainNo} ${flags}` : train.trainNo;
};

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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const cutTop = !isLoop && isFirst;
  const cutBottom = !isLoop && isLast;

  // A train rendered "between" stations (entering / departed_prev) sits on
  // the upper rail half; arrived/departed trains sit at the dot.
  const betweenTrains = trains.filter(
    (t) => t.status === 'entering' || t.status === 'departed_prev'
  );
  const atStationTrains = trains.filter(
    (t) => t.status !== 'entering' && t.status !== 'departed_prev'
  );

  const a11ySummary =
    trains.length > 0
      ? `${stationName}, 열차 ${trains.length}대 — ${trains
          .map((t) => `${t.terminalName}행 ${positionStatusToDisplay(t.status)}`)
          .join(', ')}`
      : stationName;

  const renderMarker = (train: TrainPosition, between: boolean): React.ReactElement => (
    <View
      key={`${train.trainNo}-${train.status}`}
      style={[
        styles.marker,
        between ? styles.markerBetween : styles.markerAtStation,
        { backgroundColor: semantic.bgBase, borderColor: lineColor },
      ]}
      testID={testID ? `${testID}-marker-${train.trainNo}` : undefined}
    >
      <Text style={[styles.markerTrainNo, { color: semantic.labelStrong }]} numberOfLines={1}>
        {trainMarkerLabel(train)}
      </Text>
      <Text style={[styles.markerDest, { color: semantic.labelAlt }]} numberOfLines={1}>
        {train.terminalName}행 {positionStatusToDisplay(train.status)}
      </Text>
    </View>
  );

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

      <View style={styles.markerZone} pointerEvents="none">
        {betweenTrains.map((t) => renderMarker(t, true))}
        {atStationTrains.map((t) => renderMarker(t, false))}
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

const RAIL_ZONE_WIDTH = 36;
const MARKER_ZONE_WIDTH = 120;

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
  markerZone: {
    position: 'absolute',
    left: RAIL_ZONE_WIDTH + WANTED_TOKENS.spacing.s1,
    width: MARKER_ZONE_WIDTH,
    height: '100%',
    justifyContent: 'center',
  },
  marker: {
    borderWidth: 1.5,
    borderRadius: WANTED_TOKENS.radius.r4,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    maxWidth: MARKER_ZONE_WIDTH,
  },
  markerBetween: {
    position: 'absolute',
    top: 0,
  },
  markerAtStation: {},
  markerTrainNo: {
    ...typeStyle('caption1', '700'),
  },
  markerDest: {
    ...typeStyle('caption2', '500'),
  },
  nameZone: {
    flex: 1,
    marginLeft: WANTED_TOKENS.spacing.s2 + MARKER_ZONE_WIDTH,
    justifyContent: 'center',
  },
});

export const StationTimelineRow = memo(StationTimelineRowImpl);
StationTimelineRow.displayName = 'StationTimelineRow';
