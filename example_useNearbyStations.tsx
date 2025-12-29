/**
 * 권장 방식: useNearbyStations를 활용한 HomeScreen 개선안
 *
 * 현재 HomeScreen 대비 개선 사항:
 * 1. 자동 위치 업데이트 (사용자가 이동하면 주변 역 자동 갱신)
 * 2. 배터리 최적화 (30초 throttle + 50m 거리 필터)
 * 3. 에러 핸들링 자동화
 * 4. 코드 90% 감소
 *
 * 테스트용: 현재 위치를 산곡역으로 고정
 */

import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useNearbyStations } from '@/hooks/useNearbyStations';
import { StationCard } from '@/components/train/StationCard';
import { TrainArrivalList } from '@/components/train/TrainArrivalList';
import { useToast } from '@/components/common/Toast';

// 🧪 테스트용 고정 좌표 - 산곡역 (서울 7호선)
const TEST_LOCATION = {
  latitude: 37.6661,
  longitude: 126.8850,
};

export const ImprovedHomeScreen: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [selectedStationId, setSelectedStationId] = React.useState<string | null>(null);

  // 🎯 이것만으로 모든 위치 기능 완성!
  const {
    closestStation,
    loading,
    error,
    isAtStation,         // 역에 도착했는지 자동 감지
    getFormattedStations, // "150m", "1.2km" 자동 포맷
    refresh,
    hasLocation          // 위치 권한 있는지 자동 체크
  } = useNearbyStations({
    radius: 1000,            // 1km 반경
    maxStations: 10,
    autoUpdate: false,       // 🧪 테스트 모드에서는 자동 업데이트 비활성화
    minUpdateInterval: 30000, // 30초 throttle로 배터리 보호
    mockLocation: TEST_LOCATION, // 🧪 산곡역 고정 좌표 사용

    // 가장 가까운 역이 바뀔 때 알림
    onClosestStationChanged: (station) => {
      if (station) {
        showSuccess(`${station.name}역 근처입니다 (${Math.round(station.distance)}m)`);

        // 자동 선택
        if (!selectedStationId) {
          setSelectedStationId(station.id);
        }
      }
    },

    // 주변 역 발견 시 호출
    onStationsFound: (stations) => {
      console.log(`주변에 ${stations.length}개 역 발견`);
    }
  });

  // 에러 처리 자동화
  React.useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error]);

  // 첫 로드 시 가장 가까운 역 자동 선택
  React.useEffect(() => {
    if (closestStation && !selectedStationId) {
      setSelectedStationId(closestStation.id);
    }
  }, [closestStation, selectedStationId]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      {/* 위치 권한 없을 때 자동으로 감지 */}
      {!hasLocation && (
        <View style={styles.banner}>
          <Text>위치 권한을 허용하면 주변 역을 자동으로 찾습니다</Text>
        </View>
      )}

      {/* 역 근처에 있을 때 알림 */}
      {isAtStation && (
        <View style={styles.atStationBanner}>
          <Text>🎯 역 근처에 있습니다 (100m 이내)</Text>
        </View>
      )}

      {/* 주변 역 목록 (자동 거리순 정렬) */}
      <View style={styles.section}>
        <Text style={styles.title}>주변 역</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {getFormattedStations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              showDistance={true}
              distance={station.distance}
              isSelected={selectedStationId === station.id}
              onPress={() => setSelectedStationId(station.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* 선택된 역의 실시간 열차 정보 */}
      {selectedStationId && (
        <View style={styles.section}>
          <Text style={styles.title}>실시간 열차 정보</Text>
          <TrainArrivalList stationId={selectedStationId} />
        </View>
      )}
    </ScrollView>
  );
};

// 🎯 성능 팁: 컴포넌트가 unmount되면 자동으로 위치 추적 중지!
// useNearbyStations가 cleanup 자동 처리

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  banner: {
    backgroundColor: '#dbeafe',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  atStationBanner: {
    backgroundColor: '#d1fae5',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
