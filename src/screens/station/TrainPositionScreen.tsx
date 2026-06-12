/**
 * TrainPositionScreen — 실시간 열차 위치 (whole-line timeline).
 *
 * Shows every station of the selected line branch as a vertical timeline
 * with live train markers from the Seoul `realtimePosition` feed.
 *
 * - Line 2 renders branch chips (순환선 / 성수–신설동 / 신도림–까치산); the
 *   direction segment reads 내선순환/외선순환 on the loop, 상행/하행 on
 *   branches (and on every other line).
 * - Trains are joined onto stations by normalized name
 *   (buildStationNameToIdMap); rows that fail to join are skipped silently.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useIsFocused } from '@react-navigation/native';
import { AlertCircle, Info, Moon } from 'lucide-react-native';

import { AppStackParamList } from '../../navigation/types';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useTrainPositions } from '@/hooks/useTrainPositions';
import { DirectionSegment, type DirectionValue } from '@/components/station/DirectionSegment';
import { StationTimelineRow, TIMELINE_ROW_HEIGHT } from '@/components/station/StationTimelineRow';
import { LineBadge, type LineId } from '@/components/design';
import {
  getLineBranches,
  buildStationNameToIdMap,
  resolveLineKey,
  STATIONS,
  LINE_COLORS,
  type LineBranch,
} from '@/utils/subwayMapData';
import { resolveInternalStationId } from '@/utils/stationIdResolver';
import { directionToDisplay } from '@/models/route';
import type { TrainPosition } from '@/models/trainPosition';

type TrainPositionRouteProp = RouteProp<AppStackParamList, 'TrainPosition'>;

const formatClock = (date: Date): string =>
  date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

const TrainPositionScreen: React.FC = () => {
  const route = useRoute<TrainPositionRouteProp>();
  const { lineId, focusStationId: rawFocusStationId } = route.params;

  // Two ID normalizations at the boundary: Station.lineId is the Seoul API
  // Korean name for non-numeric lines ('수인분당선') while LINE_STATIONS /
  // LINE_COLORS key on lines.json slugs ('bundang'); focusStationId arrives
  // as an external station_cd while branch.stationIds are internal slugs.
  const lineKey = resolveLineKey(lineId);
  const focusStationId = resolveInternalStationId(rawFocusStationId) ?? undefined;

  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const lineColor = LINE_COLORS[lineKey] ?? semantic.primaryNormal;

  const isScreenFocused = useIsFocused();
  const { positions, loading, error, isStale, lastUpdated, unsupported, refetch } =
    useTrainPositions(lineId, { enabled: isScreenFocused });

  const branches = useMemo(() => getLineBranches(lineKey), [lineKey]);

  // Initial branch: the one containing the station the user came from.
  const [branchKey, setBranchKey] = useState<string>(() => {
    if (focusStationId) {
      const containing = branches.find((b) => b.stationIds.includes(focusStationId));
      if (containing) return containing.key;
    }
    return branches[0]?.key ?? '';
  });
  const branch: LineBranch | undefined =
    branches.find((b) => b.key === branchKey) ?? branches[0];

  const [direction, setDirection] = useState<DirectionValue>('up');

  const nameToId = useMemo(
    () => (branch ? buildStationNameToIdMap(branch.stationIds) : new Map<string, string>()),
    [branch]
  );

  // Join: direction-filtered positions grouped by lines.json stationId.
  const trainsByStation = useMemo(() => {
    const map = new Map<string, TrainPosition[]>();
    for (const pos of positions) {
      if (pos.direction !== direction) continue;
      const stationId = nameToId.get(pos.stationName.trim().replace(/역$/, ''));
      if (!stationId) continue; // name join failed — skip defensively
      const list = map.get(stationId);
      if (list) {
        list.push(pos);
      } else {
        map.set(stationId, [pos]);
      }
    }
    return map;
  }, [positions, direction, nameToId]);

  const visibleTrainCount = useMemo(() => {
    let count = 0;
    for (const list of trainsByStation.values()) count += list.length;
    return count;
  }, [trainsByStation]);

  // Direction labels: loop trunk uses 내선순환/외선순환 (directionToDisplay
  // handles Line 2); Line 2 branches run plain 상행/하행 service.
  const dirLabel = useCallback(
    (d: DirectionValue): string => {
      if (branch && !branch.isLoop && lineKey === '2') {
        return d === 'up' ? '상행' : '하행';
      }
      return directionToDisplay(d, lineKey);
    },
    [branch, lineKey]
  );

  const handleSelectBranch = useCallback((key: string) => {
    setBranchKey(key);
  }, []);

  const initialScrollIndex = useMemo(() => {
    if (!branch || !focusStationId) return undefined;
    const index = branch.stationIds.indexOf(focusStationId);
    return index >= 0 ? index : undefined;
  }, [branch, focusStationId]);

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: TIMELINE_ROW_HEIGHT,
      offset: TIMELINE_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderStation = useCallback(
    ({ item: stationId, index }: ListRenderItemInfo<string>) => (
      <StationTimelineRow
        stationName={STATIONS[stationId]?.name ?? stationId}
        isFirst={index === 0}
        isLast={branch ? index === branch.stationIds.length - 1 : false}
        isLoop={branch?.isLoop ?? false}
        isOrigin={stationId === focusStationId}
        trains={trainsByStation.get(stationId) ?? []}
        lineColor={lineColor}
        testID={`train-position-row-${stationId}`}
      />
    ),
    [branch, focusStationId, trainsByStation, lineColor]
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: semantic.bgBase }]}
      edges={['bottom']}
    >
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <LineBadge line={lineId as LineId} size={24} />
          <Text style={[typeStyle('label2', '600'), { color: semantic.labelNeutral }]}>
            운행 중 {visibleTrainCount}대
          </Text>
        </View>
        <View style={styles.statusRight}>
          {lastUpdated ? (
            <Text style={[typeStyle('caption1', '500'), { color: semantic.labelAlt }]}>
              {isStale ? '이전 데이터 · ' : ''}
              {formatClock(lastUpdated)} 기준
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={refetch}
            accessible
            accessibilityRole="button"
            accessibilityLabel="열차 위치 새로고침"
            style={styles.refreshButton}
            activeOpacity={0.7}
            testID="train-position-refresh"
          >
            <Text style={[typeStyle('label2', '600'), { color: semantic.primaryNormal }]}>
              새로고침
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {branches.length > 1 ? (
        <View style={styles.chipRow} testID="train-position-branch-chips">
          {branches.map((b) => {
            const active = b.key === branch?.key;
            return (
              <TouchableOpacity
                key={b.key}
                onPress={() => handleSelectBranch(b.key)}
                accessible
                accessibilityRole="tab"
                accessibilityLabel={`${b.label} 구간 선택`}
                accessibilityState={{ selected: active }}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? semantic.primaryNormal : semantic.bgSubtle,
                    borderColor: active ? semantic.primaryNormal : semantic.lineSubtle,
                  },
                ]}
                testID={`train-position-chip-${b.key}`}
              >
                <Text
                  style={[
                    typeStyle('label2', active ? '700' : '500'),
                    { color: active ? '#FFFFFF' : semantic.labelNeutral },
                  ]}
                >
                  {b.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={styles.segmentWrap}>
        <DirectionSegment
          value={direction}
          upLabel={dirLabel('up')}
          downLabel={dirLabel('down')}
          onChange={setDirection}
          testID="train-position-direction"
        />
      </View>

      {unsupported ? (
        <View style={styles.statePanel} testID="train-position-unsupported">
          <Info size={48} color={semantic.labelAlt} />
          <Text style={[typeStyle('body2', '500'), styles.stateText, { color: semantic.labelNeutral }]}>
            이 노선은 실시간 열차 위치 정보를 제공하지 않아요
          </Text>
        </View>
      ) : loading && positions.length === 0 ? (
        <View style={styles.statePanel} testID="train-position-loading">
          <ActivityIndicator size="large" color={semantic.primaryNormal} />
          <Text style={[typeStyle('body2', '500'), styles.stateText, { color: semantic.labelNeutral }]}>
            열차 위치를 불러오는 중...
          </Text>
        </View>
      ) : error && positions.length === 0 ? (
        <View style={styles.statePanel} testID="train-position-error">
          <AlertCircle size={48} color={WANTED_TOKENS.status.red500} />
          <Text style={[typeStyle('body2', '500'), styles.stateText, { color: semantic.labelNeutral }]}>
            {error}
          </Text>
          <Text
            accessible
            accessibilityRole="button"
            accessibilityLabel="열차 위치 다시 불러오기"
            onPress={refetch}
            style={[typeStyle('label1', '700'), styles.retryText, { color: semantic.primaryNormal }]}
            testID="train-position-error-retry"
          >
            다시 시도
          </Text>
        </View>
      ) : !loading && visibleTrainCount === 0 && positions.length === 0 ? (
        <View style={styles.statePanel} testID="train-position-empty">
          <Moon size={48} color={semantic.labelAlt} />
          <Text style={[typeStyle('body2', '500'), styles.stateText, { color: semantic.labelNeutral }]}>
            현재 운행 중인 열차가 없습니다
          </Text>
        </View>
      ) : (
        <FlatList
          data={branch ? [...branch.stationIds] : []}
          keyExtractor={(stationId) => stationId}
          renderItem={renderStation}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialScrollIndex}
          contentContainerStyle={styles.listContent}
          testID="train-position-list"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
  refreshButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: WANTED_TOKENS.spacing.s2,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: WANTED_TOKENS.radius.r6,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    minHeight: 36,
    justifyContent: 'center',
  },
  segmentWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: WANTED_TOKENS.spacing.s3,
    padding: WANTED_TOKENS.spacing.s6,
  },
  stateText: {
    textAlign: 'center',
  },
  retryText: {
    paddingVertical: WANTED_TOKENS.spacing.s2,
  },
  listContent: {
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
});

export default TrainPositionScreen;
