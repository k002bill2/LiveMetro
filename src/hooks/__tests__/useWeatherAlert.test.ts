/**
 * useWeatherAlert Hook Tests
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { weatherService } from '@/services/weather/weatherService';
import { useLocation } from '@/hooks/useLocation';
import { useWeatherAlert } from '../useWeatherAlert';

jest.mock('@/services/weather/weatherService', () => ({
  weatherService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getCurrentWeather: jest.fn().mockResolvedValue(null),
    shouldAlertForWeather: jest.fn().mockResolvedValue({ shouldAlert: false }),
  },
}));

jest.mock('@/hooks/useLocation', () => ({
  useLocation: jest.fn(() => ({ location: null })),
}));

describe('useWeatherAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocation as jest.Mock).mockReturnValue({ location: null });
    (weatherService.initialize as jest.Mock).mockResolvedValue(undefined);
    (weatherService.getCurrentWeather as jest.Mock).mockResolvedValue(null);
    (weatherService.shouldAlertForWeather as jest.Mock).mockResolvedValue({
      shouldAlert: false,
    });
  });

  it('shouldAlert=false면 null 반환', async () => {
    const { result } = renderHook(() => useWeatherAlert());

    await waitFor(() => {
      expect(weatherService.shouldAlertForWeather).toHaveBeenCalled();
    });

    expect(result.current).toBeNull();
  });

  it('shouldAlert=true + message가 있으면 SubwayAlert 형태로 반환', async () => {
    (weatherService.shouldAlertForWeather as jest.Mock).mockResolvedValue({
      shouldAlert: true,
      message: '폭우로 인한 지연이 예상됩니다',
    });

    const { result } = renderHook(() => useWeatherAlert());

    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current).toMatchObject({
      alertType: 'weather',
      title: '날씨 알림',
      content: '폭우로 인한 지연이 예상됩니다',
      isActive: true,
    });
    expect(result.current?.alertId).toMatch(/^weather-alert-/);
  });

  it('enabled=false면 평가 안 함 + null 반환', () => {
    renderHook(() => useWeatherAlert({ enabled: false }));

    expect(weatherService.shouldAlertForWeather).not.toHaveBeenCalled();
  });

  it('location 있을 때 getCurrentWeather에 좌표 전달', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      location: { latitude: 37.5665, longitude: 126.978 },
    });

    renderHook(() => useWeatherAlert());

    await waitFor(() =>
      expect(weatherService.getCurrentWeather).toHaveBeenCalledWith({
        latitude: 37.5665,
        longitude: 126.978,
      }),
    );
  });

  it('weatherService 실패 시 null 반환 (graceful)', async () => {
    (weatherService.shouldAlertForWeather as jest.Mock).mockRejectedValue(
      new Error('API down'),
    );

    const { result } = renderHook(() => useWeatherAlert());

    // catch 블록이 setWeatherAlert(null) 호출함 — 일정 시간 대기 후 null 확인
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current).toBeNull();
  });
});
