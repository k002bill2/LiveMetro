/**
 * useWeatherAlert Hook
 *
 * weatherService.shouldAlertForWeather()를 주기적으로 호출하여 악천후
 * (moderate/severe impact) 발생 시 SubwayAlert 형태로 변환해 반환한다.
 * AlertBanner의 alerts 배열에 그대로 push 가능.
 *
 * 호출 시점:
 *   - mount 시 1회
 *   - location 변경 시 (weatherService가 위치 기반 fetch)
 *   - WEATHER_ALERT_REFRESH_MS 간격으로 주기적 재평가 (캐시 hit이 대부분)
 *
 * 호출자는 useAutoCommuteLog처럼 useIsFocused 등으로 gating 가능.
 * weatherService 자체가 30분 internal cache + AsyncStorage 영속 캐시를
 * 갖고 있어 네트워크 부담은 적다.
 */
import { useEffect, useState } from 'react';
import { weatherService } from '@/services/weather/weatherService';
import { useLocation } from '@/hooks/useLocation';
import type { SubwayAlert } from '@/models/publicData';

interface UseWeatherAlertOptions {
  enabled?: boolean;
}

const WEATHER_ALERT_REFRESH_MS = 30 * 60 * 1000;
const WEATHER_ALERT_ID_PREFIX = 'weather-alert-';

const buildWeatherAlert = (message: string): SubwayAlert => {
  const now = new Date();
  return {
    alertId: `${WEATHER_ALERT_ID_PREFIX}${now.toDateString()}`,
    title: '날씨 알림',
    content: message,
    lineName: '',
    alertType: 'weather',
    startTime: now,
    endTime: null,
    isActive: true,
    affectedStations: [],
  };
};

export const useWeatherAlert = ({ enabled = true }: UseWeatherAlertOptions = {}): SubwayAlert | null => {
  const { location } = useLocation();
  const [weatherAlert, setWeatherAlert] = useState<SubwayAlert | null>(null);

  useEffect(() => {
    if (!enabled) {
      setWeatherAlert(null);
      return;
    }

    let cancelled = false;

    const evaluate = async (): Promise<void> => {
      try {
        await weatherService.initialize();
        // location이 없어도 weatherService가 cache로 fallback 시도
        const coords = location
          ? { latitude: location.latitude, longitude: location.longitude }
          : undefined;
        // weatherService의 cache hit이 대부분이라 네트워크 부담 적음
        await weatherService.getCurrentWeather(coords);
        const result = await weatherService.shouldAlertForWeather();
        if (cancelled) return;
        if (result.shouldAlert && result.message) {
          setWeatherAlert(buildWeatherAlert(result.message));
        } else {
          setWeatherAlert(null);
        }
      } catch {
        if (!cancelled) {
          setWeatherAlert(null);
        }
      }
    };

    evaluate();
    const intervalId = setInterval(evaluate, WEATHER_ALERT_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [enabled, location?.latitude, location?.longitude]);

  return weatherAlert;
};

export { buildWeatherAlert };
