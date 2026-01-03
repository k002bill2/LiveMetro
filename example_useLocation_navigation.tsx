/**
 * useLocation 권장 사용 사례: 역까지 도보 안내 화면
 *
 * 사용자가 역까지 걸어가는 동안 실시간 거리 업데이트
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocation } from '@/hooks/useLocation';
import { locationService } from '@/services/location/locationService';
import { Station } from '@/models/train';

interface Props {
  destinationStation: Station;
}

export const WalkingNavigationScreen: React.FC<Props> = ({ destinationStation }) => {
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);

  // 🔥 실시간 위치 추적
  const {
    location: _location, // Location updates handled via onLocationUpdate callback
    loading,
    error,
    isTracking,
    startTracking,
    stopTracking
  } = useLocation({
    enableHighAccuracy: true,  // 도보 안내는 정확도가 중요
    distanceFilter: 5,         // 5m마다 업데이트 (더 부드러운 UX)

    // 위치 변경될 때마다 거리 재계산
    onLocationUpdate: (newLocation) => {
      const distance = locationService.calculateDistance(
        newLocation.latitude,
        newLocation.longitude,
        destinationStation.coordinates.latitude,
        destinationStation.coordinates.longitude
      );

      setCurrentDistance(distance);

      // 도보 속도: 평균 1.4m/s (약 5km/h)
      const walkingSpeed = 1.4;
      const estimatedSeconds = distance / walkingSpeed;
      setEstimatedMinutes(Math.ceil(estimatedSeconds / 60));

      // 50m 이내 도착하면 알림
      if (distance <= 50) {
        alert('🎉 목적지에 도착했습니다!');
        stopTracking();
      }
    }
  });

  // 화면 진입 시 추적 시작
  useEffect(() => {
    startTracking();

    // 화면 나갈 때 추적 자동 중지
    return () => {
      stopTracking();
    };
  }, []);

  if (loading) {
    return <Text>GPS 신호 수신 중...</Text>;
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚶 {destinationStation.name}역으로 이동 중</Text>

      {currentDistance !== null && (
        <>
          <Text style={styles.distance}>
            {locationService.formatDistance(currentDistance)}
          </Text>

          <Text style={styles.eta}>
            예상 도착: 약 {estimatedMinutes}분
          </Text>

          {/* 거리별 안내 메시지 */}
          {currentDistance > 500 && (
            <Text style={styles.hint}>💡 출구를 확인하세요</Text>
          )}
          {currentDistance <= 500 && currentDistance > 100 && (
            <Text style={styles.hint}>🎯 곧 도착합니다</Text>
          )}
          {currentDistance <= 100 && (
            <Text style={styles.hint}>✅ 역이 보일 거예요</Text>
          )}
        </>
      )}

      <Text style={styles.trackingStatus}>
        {isTracking ? '📍 실시간 추적 중' : '⏸️ 추적 중지됨'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  distance: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  eta: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 8,
  },
  hint: {
    fontSize: 16,
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  trackingStatus: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: '#9ca3af',
  },
  error: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});
