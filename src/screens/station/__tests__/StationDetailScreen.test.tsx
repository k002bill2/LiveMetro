/**
 * StationDetailScreen Test Suite (Phase 7 — Wanted Design System rewrite).
 *
 * Covers the orchestrator's responsibilities only. Sub-component visuals are
 * exercised in their own __tests__ folders.
 */
import React from 'react';
import { Share } from 'react-native';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import StationDetailScreen from '../StationDetailScreen';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useFavorites } from '@/hooks/useFavorites';
import { usePublicDataForStation } from '@/hooks/usePublicData';
import { mapCacheService } from '@/services/map/mapCacheService';
import {
  setBoardingSelection,
  clearBoardingSelection,
  getBoardingSelection,
} from '@/services/train/boardingSelectionStore';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
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

const buildTrain = (overrides: Partial<{ id: string; finalDestination: string; minutesAway: number; direction: 'up' | 'down'; lineId: string; directionLabel: string }> = {}) => {
  const minutesAway = overrides.minutesAway ?? 2;
  return {
    id: overrides.id ?? 't1',
    lineId: overrides.lineId ?? '2',
    direction: overrides.direction ?? 'up',
    ...(overrides.directionLabel ? { directionLabel: overrides.directionLabel } : {}),
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
    clearBoardingSelection();
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

  // 빈 상태는 일시적 API 빈 응답일 수 있어 수동 재시도를 제공한다 — 기존엔
  // 에러 상태에만 있던 affordance. 빈 상태 retry가 useRealtimeTrains.refetch을
  // 호출하는지 검증.
  it('calls refetch when the empty-state retry affordance is pressed', () => {
    const refetch = jest.fn();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: false,
      error: null,
      refetch,
    });
    const { getByTestId } = render(<StationDetailScreen />);
    fireEvent.press(getByTestId('station-detail-empty-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
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

  // 2호선 순환선 방면 라벨: train.directionLabel(API 원본)이 최우선,
  // 없으면 directionToDisplay(lineId) fallback — 둘 다 '내선순환/외선순환'.
  describe('direction segment labels (Line 2 circular)', () => {
    it('shows raw API labels 내선순환/외선순환 when trains carry directionLabel', () => {
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '성수', direction: 'up', directionLabel: '내선순환' }),
          buildTrain({ id: 'd1', finalDestination: '성수', direction: 'down', directionLabel: '외선순환' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText } = render(<StationDetailScreen />);
      expect(getByText('내선순환 (성수)')).toBeTruthy();
      expect(getByText('외선순환 (성수)')).toBeTruthy();
    });

    it('falls back to line-level 내선순환/외선순환 labels when directionLabel is absent', () => {
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }),
          buildTrain({ id: 'd1', finalDestination: '서울대입구', direction: 'down' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText } = render(<StationDetailScreen />);
      expect(getByText('내선순환 (잠실)')).toBeTruthy();
      expect(getByText('외선순환 (서울대입구)')).toBeTruthy();
    });

    it('shows 상행/하행 labels for Line 2 branch trains carrying 상행/하행 directionLabel', () => {
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '성수', direction: 'up', directionLabel: '상행' }),
          buildTrain({ id: 'd1', finalDestination: '까치산', direction: 'down', directionLabel: '하행' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText } = render(<StationDetailScreen />);
      expect(getByText('상행 (성수)')).toBeTruthy();
      expect(getByText('하행 (까치산)')).toBeTruthy();
    });
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

  // 신설동 사례 회귀: 환승역에서 realtime API는 역에 도착하는 모든 노선
  // (1·2·우이신설)의 열차를 반환한다. 이 화면은 한 노선(route lineId)의
  // 상세이므로 타 노선 열차가 섞이면 안 된다.
  describe('line filtering at transfer stations', () => {
    it('filters out trains from other lines (route lineId="2")', () => {
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'line2-up', finalDestination: '잠실', direction: 'up', lineId: '2' }),
          buildTrain({ id: 'line1-up', finalDestination: '동두천', direction: 'up', lineId: '1' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText, queryByText } = render(<StationDetailScreen />);
      expect(getByText('잠실행')).toBeTruthy();
      // 1호선 열차는 2호선 화면에서 제외된다.
      expect(queryByText('동두천행')).toBeNull();
    });

    it('shows the empty state when only other-line trains are available', () => {
      // 2호선 열차 0건 + 1호선 열차만 있으면 2호선 화면은 빈 상태 — 타 노선
      // 열차로 화면을 채우지 않는다.
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'line1-up', finalDestination: '동두천', direction: 'up', lineId: '1' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByTestId, queryByText } = render(<StationDetailScreen />);
      expect(getByTestId('station-detail-empty')).toBeTruthy();
      expect(queryByText('동두천행')).toBeNull();
    });
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

  // 탑승 열차 선택 화면으로의 진입 — 도착 카드가 있을 때만 노출.
  describe('탑승 열차 선택 entry', () => {
    it('navigates to TrainSelection with the station params when pressed', () => {
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByTestId } = render(<StationDetailScreen />);
      fireEvent.press(getByTestId('station-detail-train-select'));
      expect(mockNavigate).toHaveBeenCalledWith('TrainSelection', {
        stationId: 'gangnam',
        stationName: '강남',
        lineId: '2',
      });
    });

    it('does not show the entry button when there are no trains', () => {
      const { queryByTestId } = render(<StationDetailScreen />);
      expect(queryByTestId('station-detail-train-select')).toBeNull();
    });
  });

  // 실시간 열차 위치 화면으로의 진입 — 탑승 열차 선택 버튼과 동일하게
  // 도착 카드가 있을 때만 노출.
  describe('실시간 열차 위치 entry', () => {
    it('navigates to TrainPosition with lineId + focusStationId when pressed', () => {
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByTestId } = render(<StationDetailScreen />);
      fireEvent.press(getByTestId('station-detail-train-position'));
      expect(mockNavigate).toHaveBeenCalledWith('TrainPosition', {
        lineId: '2',
        focusStationId: 'gangnam',
      });
    });

    it('does not show the entry button when there are no trains', () => {
      const { queryByTestId } = render(<StationDetailScreen />);
      expect(queryByTestId('station-detail-train-position')).toBeNull();
    });
  });

  // 탑승 시작 후 역 상세로 복귀 시: boarding 선택이 방향 전환 + 선택 열차를
  // 최상단으로 끌어올려 "탑승 열차에 따라 도착시간 변경"을 가시화한다.
  describe('boarding selection reflection', () => {
    it('switches to the boarding direction and surfaces the chosen train first', () => {
      setBoardingSelection({
        stationId: 'gangnam',
        stationName: '강남',
        lineId: '2',
        direction: 'down',
        finalDestination: '잠실',
        selectedCar: 7,
      });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '성수', direction: 'up' }),
          buildTrain({ id: 'd1', finalDestination: '서울대입구', direction: 'down' }),
          buildTrain({ id: 'd2', finalDestination: '잠실', direction: 'down' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByTestId, queryByText } = render(<StationDetailScreen />);
      // 기본 'up'이지만 boarding 선택이 'down' → up 열차는 숨겨진다.
      expect(queryByText('성수행')).toBeNull();
      // 매칭 종착지(잠실)가 최상단(arrival-0)으로 재정렬되어 강조된다.
      expect(
        within(getByTestId('station-detail-arrival-0')).getByText('잠실행')
      ).toBeTruthy();
    });

    it('ignores a boarding selection that belongs to a different station', () => {
      setBoardingSelection({
        stationId: 'OTHER',
        stationName: '역삼',
        lineId: '2',
        direction: 'down',
        finalDestination: '잠실',
        selectedCar: null,
      });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '성수', direction: 'up' }),
          buildTrain({ id: 'd1', finalDestination: '잠실', direction: 'down' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const { getByText, queryByText } = render(<StationDetailScreen />);
      // 다른 역의 선택 → 무시. 기본 'up' 유지 → 성수행 표시, 잠실행(down) 숨김.
      expect(getByText('성수행')).toBeTruthy();
      expect(queryByText('잠실행')).toBeNull();
    });

    // 코드리뷰 #2 회귀 가드: boarding 방향이 현재 방향과 같을 때(상행→상행)
    // setDirection은 no-op이지만 reorder는 즉시 반영돼야 한다(폴링 대기 금지).
    it('reorders immediately when the boarding direction equals the current direction', () => {
      setBoardingSelection({
        stationId: 'gangnam',
        stationName: '강남',
        lineId: '2',
        direction: 'up',
        finalDestination: '성수',
        selectedCar: null,
      });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }),
          buildTrain({ id: 'u2', finalDestination: '성수', direction: 'up' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      // 기본 방향 'up' == boarding 'up'. 추가 폴링(trains 갱신) 없이 첫 렌더에서
      // 성수가 최상단(arrival-0)으로 와야 한다.
      const { getByTestId } = render(<StationDetailScreen />);
      expect(
        within(getByTestId('station-detail-arrival-0')).getByText('성수행')
      ).toBeTruthy();
    });

    // 코드리뷰 #1 회귀 가드: 적용 즉시 store를 비워(consume-on-read) 이후 무관
    // 재방문에서 stale 선택이 되살아나지 않는다.
    it('consumes (clears) the boarding selection after applying it, so a later mount does not re-apply', () => {
      setBoardingSelection({
        stationId: 'gangnam',
        stationName: '강남',
        lineId: '2',
        direction: 'down',
        finalDestination: '잠실',
        selectedCar: null,
      });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          buildTrain({ id: 'u1', finalDestination: '성수', direction: 'up' }),
          buildTrain({ id: 'd1', finalDestination: '잠실', direction: 'down' }),
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      const first = render(<StationDetailScreen />);
      // 적용됨: down 방향 → 잠실행 노출. 그리고 store는 소비되어 비워진다.
      expect(first.getByText('잠실행')).toBeTruthy();
      expect(getBoardingSelection()).toBeNull();
      first.unmount();

      // fresh mount(무관 재방문): store가 비어 있어 stale 'down' 재적용 없이
      // 기본 'up' 유지 → 성수행 노출, 잠실행(down) 숨김.
      const second = render(<StationDetailScreen />);
      expect(second.getByText('성수행')).toBeTruthy();
      expect(second.queryByText('잠실행')).toBeNull();
    });
  });

  // alerts-by-line 조회용 lineName 파생. `${lineId}호선` 단순 결합은 비숫자
  // 노선(경의선·공항철도 등)에서 "경의선호선" 같은 malformed 문자열을 만들어
  // getAlertsByLine 부분 매칭을 깬다 (경의선 서울역 빈 데이터 조사에서 발견).
  describe('alert lineName derivation', () => {
    it('appends 호선 only for numeric lines', () => {
      (useRoute as jest.Mock).mockReturnValueOnce({
        params: { stationId: 'gangnam', stationName: '강남', lineId: '2' },
      });

      render(<StationDetailScreen />);

      expect(mockedUsePublicData).toHaveBeenCalledWith(
        '강남',
        expect.objectContaining({ lineName: '2호선' }),
      );
    });

    it('uses the line name as-is for non-numeric lines (no 경의선호선)', () => {
      (useRoute as jest.Mock).mockReturnValueOnce({
        params: { stationId: '1251', stationName: '서울역', lineId: '경의선' },
      });

      render(<StationDetailScreen />);

      expect(mockedUsePublicData).toHaveBeenCalledWith(
        '서울역',
        expect.objectContaining({ lineName: '경의선' }),
      );
      // malformed 결합이 재발하지 않도록 명시 단언.
      expect(mockedUsePublicData).not.toHaveBeenCalledWith(
        '서울역',
        expect.objectContaining({ lineName: '경의선호선' }),
      );
    });
  });
});
