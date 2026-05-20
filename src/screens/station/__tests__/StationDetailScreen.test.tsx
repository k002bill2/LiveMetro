/**
 * StationDetailScreen Test Suite (Phase 7 — Wanted Design System rewrite).
 *
 * Covers the orchestrator's responsibilities only. Sub-component visuals are
 * exercised in their own __tests__ folders.
 */
import React from 'react';
import { Share } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import StationDetailScreen from '../StationDetailScreen';
import { useIsFocused } from '@react-navigation/native';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useFavorites } from '@/hooks/useFavorites';
import { usePublicDataForStation } from '@/hooks/usePublicData';
import { mapCacheService } from '@/services/map/mapCacheService';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    push: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  useRoute: jest.fn(() => ({
    params: { stationId: 'gangnam', stationName: '강남', lineId: '2' },
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(() => ({
    trains: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock('@/hooks/useCongestion', () => ({
  useCongestion: jest.fn(() => ({
    trainCongestion: null,
    submitReport: jest.fn(),
    submitting: false,
  })),
}));

jest.mock('@/hooks/usePublicData', () => ({
  usePublicDataForStation: jest.fn(() => ({
    accessibility: null,
    exitInfo: [],
    alerts: [],
    loading: false,
  })),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    isFavorite: jest.fn(() => false),
    toggleFavorite: jest.fn(),
  })),
}));

// useAutoCommuteLog는 useAuth/useFavorites 의존성이 있어 별도 provider 셋업이
// 필요. 본 화면 테스트는 commute 로깅과 무관하므로 no-op으로 mock.
jest.mock('@/hooks/useAutoCommuteLog', () => ({
  useAutoCommuteLog: jest.fn(),
}));

// useWeatherAlert는 weatherService/useLocation 의존성. 본 화면 테스트는
// weather alert 자체를 검증하지 않으므로 null 반환으로 mock — 기존 alerts
// 배열 흐름이 변하지 않음을 보장.
jest.mock('@/hooks/useWeatherAlert', () => ({
  useWeatherAlert: jest.fn(() => null),
}));

jest.mock('@/services/map/mapCacheService', () => ({
  mapCacheService: {
    searchStations: jest.fn(),
  },
}));

jest.mock('@/components/common/AlertBanner', () => {
  const { View } = jest.requireActual('react-native');
  return {
    AlertBanner: ({ testID }: { testID?: string }) => <View testID={testID} />,
  };
});

const mockedUseRealtimeTrains = useRealtimeTrains as jest.Mock;
const mockedUseFavorites = useFavorites as jest.Mock;
const mockedUsePublicData = usePublicDataForStation as jest.Mock;
const mockedSearchStations = mapCacheService.searchStations as jest.Mock;

const buildTrain = (overrides: Partial<{ id: string; finalDestination: string; minutesAway: number; direction: 'up' | 'down'; lineId: string }> = {}) => {
  const minutesAway = overrides.minutesAway ?? 2;
  return {
    id: overrides.id ?? 't1',
    lineId: overrides.lineId ?? '2',
    direction: overrides.direction ?? 'up',
    currentStationId: 'X',
    nextStationId: 'Y',
    finalDestination: overrides.finalDestination ?? '잠실',
    status: 'normal',
    arrivalTime: new Date(Date.now() + minutesAway * 60_000),
    delayMinutes: 0,
    lastUpdated: new Date(),
  };
};

describe('StationDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockedUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      toggleFavorite: jest.fn(),
    });
    mockedUsePublicData.mockReturnValue({
      accessibility: null,
      exitInfo: [],
      alerts: [],
      loading: false,
    });
    // Default: never resolves so existing tests don't see a state update
    // from the meta useEffect. Per-test overrides use mockResolvedValueOnce.
    mockedSearchStations.mockImplementation(() => new Promise(() => {}));
  });

  it('renders the station hero', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('강남')).toBeTruthy();
  });

  it('renders the direction segment with both options', () => {
    const { getByTestId } = render(<StationDetailScreen />);
    expect(getByTestId('station-detail-direction-up')).toBeTruthy();
    expect(getByTestId('station-detail-direction-down')).toBeTruthy();
  });

  it('shows the empty state when no trains are returned', () => {
    const { getByText, getByTestId } = render(<StationDetailScreen />);
    expect(getByTestId('station-detail-empty')).toBeTruthy();
    expect(getByText('현재 운행 중인 열차가 없습니다')).toBeTruthy();
  });

  // PR #147 followup (manual UI 회귀 응대): empty sub-message가 시각 분기.
  // 02:00–04:59 KST만 "운행 종료 시간대", 그 외엔 "잠시 후 다시 확인" 친화 안내.
  describe('empty state sub-message — operating-hours branch', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows "운행 종료 시간대입니다" between 02:00 and 04:59 KST', () => {
      // 03:00 KST = 18:00 UTC (KST = UTC+9)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T18:00:00.000Z'));
      const { getByText } = render(<StationDetailScreen />);
      expect(getByText('운행 종료 시간대입니다')).toBeTruthy();
    });

    it('shows "잠시 후 다시 확인해주세요" during normal operating hours (e.g. 20:26 KST)', () => {
      // 20:26 KST = 11:26 UTC — 사용자 image의 회귀 발견 시각 재현
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T11:26:00.000Z'));
      const { getByText, queryByText } = render(<StationDetailScreen />);
      expect(getByText('잠시 후 다시 확인해주세요')).toBeTruthy();
      // 회귀 가드: 정상 시간엔 "운행 종료" 메시지 금지
      expect(queryByText('운행 종료 시간대입니다')).toBeNull();
    });

    it('shows "잠시 후 다시 확인해주세요" at 05:00 KST (operating start boundary)', () => {
      // 05:00 KST = 20:00 UTC — 첫차 직후, 운행 종료 아님
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T20:00:00.000Z'));
      const { getByText, queryByText } = render(<StationDetailScreen />);
      expect(getByText('잠시 후 다시 확인해주세요')).toBeTruthy();
      expect(queryByText('운행 종료 시간대입니다')).toBeNull();
    });

    it('shows "운행 종료 시간대입니다" at 02:00 KST (boundary inclusive)', () => {
      // 02:00 KST = 17:00 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T17:00:00.000Z'));
      const { getByText } = render(<StationDetailScreen />);
      expect(getByText('운행 종료 시간대입니다')).toBeTruthy();
    });
  });

  it('shows the loading state while trains are fetching', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
    });
    const { getByTestId, getByText } = render(<StationDetailScreen />);
    expect(getByTestId('station-detail-loading')).toBeTruthy();
    expect(getByText('열차 정보를 불러오는 중...')).toBeTruthy();
  });

  it('shows the error state with a retry affordance', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: false,
      error: '데이터를 불러올 수 없습니다',
      refetch: jest.fn(),
    });
    const { getByText, getByTestId } = render(<StationDetailScreen />);
    expect(getByTestId('station-detail-error')).toBeTruthy();
    expect(getByText('데이터를 불러올 수 없습니다')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('renders one ArrivalCard per up-direction train when 상행 is selected', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [
        buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }),
        buildTrain({ id: 'd1', finalDestination: '서울대입구', direction: 'down' }),
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByText, queryByText } = render(<StationDetailScreen />);
    expect(getByText('잠실행')).toBeTruthy();
    // Only the up-direction train shows by default.
    expect(queryByText('서울대입구행')).toBeNull();
  });

  it('switches the visible arrivals when the direction segment changes', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [
        buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }),
        buildTrain({ id: 'd1', finalDestination: '서울대입구', direction: 'down' }),
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByText, getByTestId, queryByText } = render(<StationDetailScreen />);
    expect(queryByText('서울대입구행')).toBeNull();
    fireEvent.press(getByTestId('station-detail-direction-down'));
    expect(getByText('서울대입구행')).toBeTruthy();
    expect(queryByText('잠실행')).toBeNull();
  });

  it('invokes Share.share when the share affordance is pressed', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const { getByTestId } = render(<StationDetailScreen />);
    fireEvent.press(getByTestId('station-detail-header-share'));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    shareSpy.mockRestore();
  });

  it('toggles favorite via useFavorites when the star is pressed', async () => {
    const toggleFavorite = jest.fn().mockResolvedValue(undefined);
    mockedUseFavorites.mockReturnValue({
      isFavorite: jest.fn(() => false),
      toggleFavorite,
    });
    const { getByTestId } = render(<StationDetailScreen />);
    fireEvent.press(getByTestId('station-detail-header-favorite'));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalled());
  });

  it('renders ExitInfoGrid with public data exits', () => {
    mockedUsePublicData.mockReturnValue({
      accessibility: null,
      exitInfo: [
        {
          exitNumber: '1',
          landmarks: [
            { stationCode: 'X', stationName: '강남', lineNum: '2', exitNumber: '1', landmarkName: '강남역사거리', category: 'transport' },
          ],
        },
      ],
      alerts: [],
      loading: false,
    });
    const { getByTestId, getByText } = render(<StationDetailScreen />);
    expect(getByTestId('station-detail-exits')).toBeTruthy();
    expect(getByText('출구 안내')).toBeTruthy();
    expect(getByText('강남역사거리')).toBeTruthy();
  });

  it('hides the AlertBanner when there are no alerts', () => {
    const { queryByTestId } = render(<StationDetailScreen />);
    expect(queryByTestId('station-detail-alerts')).toBeNull();
  });

  it('renders the AlertBanner when alerts exist', () => {
    mockedUsePublicData.mockReturnValue({
      accessibility: null,
      exitInfo: [],
      alerts: [{ id: 'a1', type: 'delay', severity: 'minor', title: 'X', message: 'Y' }],
      loading: false,
    });
    const { queryByTestId } = render(<StationDetailScreen />);
    expect(queryByTestId('station-detail-alerts')).toBeTruthy();
  });

  it('wires the header subtitle from station meta (`nameEn · stationCode`)', async () => {
    mockedSearchStations.mockResolvedValueOnce([
      {
        id: '222',
        name: '강남',
        nameEn: 'Gangnam',
        lineIds: ['2'],
        coordinates: { x: 0, y: 0 },
      },
    ]);
    const { findByText } = render(<StationDetailScreen />);
    expect(await findByText('Gangnam · 222')).toBeTruthy();
  });

  it('wires multiple LineBadges when station meta exposes transfer lineIds', async () => {
    mockedSearchStations.mockResolvedValueOnce([
      {
        id: '222',
        name: '강남',
        nameEn: 'Gangnam',
        lineIds: ['2', 'sb'],
        coordinates: { x: 0, y: 0 },
      },
    ]);
    const { findByTestId } = render(<StationDetailScreen />);
    expect(await findByTestId('station-detail-header-line-0')).toBeTruthy();
    expect(await findByTestId('station-detail-header-line-1')).toBeTruthy();
  });

  // 결함 #1 회귀: 도착 카드의 "초" 카운트다운이 폴링(30초) 사이 멈춰 false
  // precision을 유발하던 버그. arrivalViews가 폴링 시에만 재계산되면 초 표시가
  // 얼어붙는다 — StationDetailScreen의 1Hz tick이 매초 재계산하는지 검증.
  describe('1Hz arrival countdown tick', () => {
    const trainAt = (secondsAway: number) => ({
      id: 'tick-train',
      lineId: '2',
      direction: 'up' as const,
      currentStationId: 'X',
      nextStationId: 'Y',
      finalDestination: '잠실',
      status: 'normal',
      arrivalTime: new Date(Date.now() + secondsAway * 1000),
      delayMinutes: 0,
      lastUpdated: new Date(),
    });

    afterEach(() => {
      jest.useRealTimers();
      // useIsFocused 오버라이드 누출 방지 — clearAllMocks는 구현을 리셋하지 않음.
      (useIsFocused as jest.Mock).mockReturnValue(true);
    });

    it('decrements the arrival seconds every second', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T11:00:00.000Z'));
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainAt(150)], // 2분 30초
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText, queryByText } = render(<StationDetailScreen />);
      expect(getByText('30초')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      // tick 한 번 → 29초. 30초가 사라진 것이 "얼어붙지 않았다"의 증거.
      expect(getByText('29초')).toBeTruthy();
      expect(queryByText('30초')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(getByText('26초')).toBeTruthy();
    });

    it('does not tick when the screen is not focused', () => {
      (useIsFocused as jest.Mock).mockReturnValue(false);
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T11:00:00.000Z'));
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainAt(150)],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText } = render(<StationDetailScreen />);
      expect(getByText('30초')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      // 비활성 화면 — tick 정지, 초 표시 그대로 (subscription-cleanup 게이트).
      expect(getByText('30초')).toBeTruthy();
    });

    it('clears the tick interval on unmount', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-19T11:00:00.000Z'));
      // setInterval/clearInterval id를 짝지어 검증 — clearInterval이 그냥
      // 호출됐는지(React 내부 기계도 호출함)가 아니라, tick이 등록한 바로 그
      // interval이 해제되는지 확인.
      const setSpy = jest.spyOn(global, 'setInterval');
      const clearSpy = jest.spyOn(global, 'clearInterval');
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainAt(150)],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { unmount } = render(<StationDetailScreen />);
      expect(setSpy).toHaveBeenCalled();
      const tickId = setSpy.mock.results[setSpy.mock.results.length - 1]?.value;
      unmount();
      expect(clearSpy).toHaveBeenCalledWith(tickId);
      setSpy.mockRestore();
      clearSpy.mockRestore();
    });
  });
});
