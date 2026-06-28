/**
 * CurrentLocationMapScreen — "내 위치 노선도".
 *
 * Shows the schematic subway map (SubwayMapView) with the user's nearest
 * station highlighted. For a subway app, "current location" means the nearest
 * station (underground GPS is unreliable), so we highlight a node rather than
 * drop a geographic blue dot. When location is unavailable the map still
 * renders — just without a highlight and with an honest header (no fake fix).
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubwayMapView } from '@components/map';
import {
  SUBWAY_MAP_LINES,
  SUBWAY_MAP_STATION_ANCHORS_BY_ID,
  SUBWAY_MAP_STATIONS,
} from '@components/map/subwayMapViewData';
import { useCurrentStationId } from '@hooks/useCurrentStationId';
import { useSemanticTokens } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';

const headerCopy = (
  status: 'locating' | 'located' | 'unavailable',
  name: string | null,
  distanceM: number | null,
): string => {
  if (status === 'located') {
    const distance = distanceM != null ? ` (${Math.round(distanceM)}m)` : '';
    return `현재 위치: ${name ?? '알 수 없음'} 근처${distance}`;
  }
  if (status === 'locating') return '위치 확인 중…';
  return '위치를 확인할 수 없어요';
};

const CurrentLocationMapScreenImpl: React.FC = () => {
  const semantic = useSemanticTokens();
  const { currentStationId, currentStationName, distanceM, status } = useCurrentStationId();

  return (
    <View style={[styles.container, { backgroundColor: semantic.bgBase }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: semantic.lineSubtle, backgroundColor: semantic.bgBase },
        ]}
      >
        <Text style={[styles.headerText, { color: semantic.labelStrong }]} numberOfLines={1}>
          {headerCopy(status, currentStationName, distanceM)}
        </Text>
      </View>

      <View
        style={styles.mapWrap}
        accessible
        accessibilityLabel={
          currentStationName
            ? `현재 위치 노선도, ${currentStationName} 근처`
            : '현재 위치 노선도'
        }
      >
        <SubwayMapView
          stations={SUBWAY_MAP_STATIONS}
          lines={SUBWAY_MAP_LINES}
          stationAnchorsById={SUBWAY_MAP_STATION_ANCHORS_BY_ID}
          selectedStation={currentStationId ?? undefined}
          initialScale={2.2}
        />
      </View>
    </View>
  );
};

export const CurrentLocationMapScreen = memo(CurrentLocationMapScreenImpl);
CurrentLocationMapScreen.displayName = 'CurrentLocationMapScreen';

export default CurrentLocationMapScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 15,
    fontFamily: weightToFontFamily('600'),
  },
  mapWrap: {
    flex: 1,
  },
});
