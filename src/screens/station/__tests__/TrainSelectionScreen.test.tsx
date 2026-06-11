/**
 * TrainSelectionScreen test suite — orchestrator responsibilities only.
 * SelectableTrainCard visuals are exercised in its own __tests__ folder, so
 * here it is stubbed to a thin press target exposing the props the screen
 * passes (destination / selected / ETA / recommendedCar).
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import TrainSelectionScreen from '../TrainSelectionScreen';
import { useIsFocused } from '@react-navigation/native';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useCongestion } from '@/hooks/useCongestion';
import {
  getBoardingSelection,
  clearBoardingSelection,
} from '@/services/train/boardingSelectionStore';
import { scheduleBoardingAlert } from '@/services/notification/boardingAlertService';
import { notificationService } from '@/services/notification/notificationService';
import { CongestionLevel } from '@/models/congestion';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
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
  useRealtimeTrains: jest.fn(),
}));

jest.mock('@/hooks/useCongestion', () => ({
  useCongestion: jest.fn(() => ({ trainCongestion: null })),
}));

jest.mock('@/services/notification/boardingAlertService', () => ({
  scheduleBoardingAlert: jest.fn(() => Promise.resolve('alert-id')),
}));

jest.mock('@/services/notification/notificationService', () => ({
  notificationService: {
    requestPermissions: jest.fn(() => Promise.resolve({ granted: true })),
  },
}));

// Thin stub — surfaces the orchestration-relevant props as queryable text.
jest.mock('@/components/train/SelectableTrainCard', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    SelectableTrainCard: ({
      destination,
      selected,
      onSelect,
      minutes,
      seconds,
      recommendedCar,
      testID,
    }: {
      destination: string;
      selected: boolean;
      onSelect: () => void;
      minutes: number;
      seconds: number;
      recommendedCar: number | null;
      testID?: string;
    }) => (
      <TouchableOpacity testID={testID} onPress={onSelect}>
        <Text>{`${destination} 방면${selected ? ' [선택]' : ''}`}</Text>
        <Text>{`eta ${minutes}:${seconds}`}</Text>
        <Text>{`rec ${recommendedCar ?? 'none'}`}</Text>
      </TouchableOpacity>
    ),
  };
});

const mockedUseRealtimeTrains = useRealtimeTrains as jest.Mock;
const mockedUseCongestion = useCongestion as jest.Mock;
const mockScheduleBoardingAlert = scheduleBoardingAlert as jest.Mock;

const buildTrain = (
  overrides: Partial<{
    id: string;
    finalDestination: string;
    secondsAway: number;
    direction: 'up' | 'down';
    lineId: string;
    trainType: 'normal' | 'express' | 'rapid';
    directionLabel: string;
  }> = {}
) => ({
  id: overrides.id ?? 't1',
  lineId: overrides.lineId ?? '2',
  direction: overrides.direction ?? 'up',
  ...(overrides.directionLabel ? { directionLabel: overrides.directionLabel } : {}),
  currentStationId: 'X',
  nextStationId: 'Y',
  finalDestination: overrides.finalDestination ?? '잠실',
  status: 'normal',
  arrivalTime: new Date(Date.now() + (overrides.secondsAway ?? 120) * 1000),
  delayMinutes: 0,
  lastUpdated: new Date(),
  trainType: overrides.trainType ?? 'normal',
});

const okState = (trains: ReturnType<typeof buildTrain>[]) => ({
  trains,
  loading: false,
  error: null,
  refetch: jest.fn(),
});

describe('TrainSelectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearBoardingSelection();
    mockedUseRealtimeTrains.mockReturnValue(okState([]));
    mockedUseCongestion.mockReturnValue({ trainCongestion: null });
    mockScheduleBoardingAlert.mockResolvedValue('alert-id');
    (useIsFocused as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    clearBoardingSelection();
  });

  it('renders the station hero, LIVE badge and the prompt subtitle', () => {
    const { getByText, getByTestId } = render(<TrainSelectionScreen />);
    expect(getByText('강남')).toBeTruthy();
    expect(getByTestId('train-selection-live')).toBeTruthy();
    expect(getByText('탑승할 열차를 선택하면 도착 시간과 30초 전 알림을 안내해 드려요')).toBeTruthy();
  });

  it('renders the direction segment with both options', () => {
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-direction-up')).toBeTruthy();
    expect(getByTestId('train-selection-direction-down')).toBeTruthy();
  });

  it('shows the loading state while trains are fetching', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-loading')).toBeTruthy();
  });

  it('shows the error state when the fetch fails', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: false,
      error: '불러올 수 없습니다',
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-error')).toBeTruthy();
  });

  it('shows the empty state when no trains run in the selected direction', () => {
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-empty')).toBeTruthy();
  });

  // 2호선 순환선 방면 라벨: train.directionLabel(API 원본) 우선,
  // 없으면 directionToDisplay(lineId) fallback.
  describe('direction segment labels (Line 2 circular)', () => {
    it('shows raw API labels 내선순환/외선순환 when trains carry directionLabel', () => {
      mockedUseRealtimeTrains.mockReturnValue(
        okState([
          buildTrain({ id: 'u1', finalDestination: '성수', direction: 'up', directionLabel: '내선순환' }),
          buildTrain({ id: 'd1', finalDestination: '성수', direction: 'down', directionLabel: '외선순환' }),
        ])
      );
      const { getByText } = render(<TrainSelectionScreen />);
      expect(getByText('내선순환 · 성수')).toBeTruthy();
      expect(getByText('외선순환 · 성수')).toBeTruthy();
    });

    it('falls back to line-level 내선순환/외선순환 labels when directionLabel is absent', () => {
      mockedUseRealtimeTrains.mockReturnValue(
        okState([
          buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }),
          buildTrain({ id: 'd1', finalDestination: '서울대입구', direction: 'down' }),
        ])
      );
      const { getByText } = render(<TrainSelectionScreen />);
      expect(getByText('내선순환 · 잠실')).toBeTruthy();
      expect(getByText('외선순환 · 서울대입구')).toBeTruthy();
    });
  });

  it('lists only up-direction trains by default and switches with the segment', () => {
    mockedUseRealtimeTrains.mockReturnValue(
      okState([
        buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }),
        buildTrain({ id: 'd1', finalDestination: '서울대입구', direction: 'down' }),
      ])
    );
    const { getByText, queryByText, getByTestId } = render(<TrainSelectionScreen />);
    expect(getByText('잠실 방면 [선택]')).toBeTruthy(); // first up train auto-selected
    expect(queryByText('서울대입구 방면')).toBeNull();

    fireEvent.press(getByTestId('train-selection-direction-down'));
    expect(getByText('서울대입구 방면 [선택]')).toBeTruthy(); // auto-selects first down train
    expect(queryByText('잠실 방면')).toBeNull();
  });

  it('updates the bottom CTA arrival time when a different train is selected', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-19T11:00:00.000Z'));
    mockedUseRealtimeTrains.mockReturnValue(
      okState([
        buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up', secondsAway: 120 }),
        buildTrain({ id: 'u2', finalDestination: '성수', direction: 'up', secondsAway: 300 }),
      ])
    );
    const { getByTestId, getByText } = render(<TrainSelectionScreen />);
    // u1 selected by default → 2분 00초 후
    expect(getByTestId('train-selection-cta-eta')).toHaveTextContent('2분 00초 후');

    // select the second card (u2 → 5분 00초 후)
    fireEvent.press(getByText('성수 방면'));
    expect(getByTestId('train-selection-cta-eta')).toHaveTextContent('5분 00초 후');
  });

  it('writes the boarding selection and navigates back when 탑승 시작 is pressed', () => {
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })])
    );
    const { getByTestId } = render(<TrainSelectionScreen />);
    fireEvent.press(getByTestId('train-selection-cta-button'));

    const saved = getBoardingSelection();
    expect(saved).toMatchObject({
      stationId: 'gangnam',
      stationName: '강남',
      lineId: '2',
      direction: 'up',
      finalDestination: '잠실',
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('schedules a 30s arrival alert for the selected train when the toggle is on (default)', () => {
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })])
    );
    const { getByTestId } = render(<TrainSelectionScreen />);
    fireEvent.press(getByTestId('train-selection-cta-button'));

    expect(mockScheduleBoardingAlert).toHaveBeenCalledTimes(1);
    expect(mockScheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ stationName: '강남', finalDestination: '잠실' })
    );
  });

  // 코드리뷰 #4 회귀 가드: 빠른 더블탭이 예약/복귀를 두 번 트리거하지 않는다.
  it('guards against double-tap — schedules and navigates back only once', () => {
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })])
    );
    const { getByTestId } = render(<TrainSelectionScreen />);
    const cta = getByTestId('train-selection-cta-button');
    fireEvent.press(cta);
    fireEvent.press(cta); // 즉시 두 번째 탭

    expect(mockScheduleBoardingAlert).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // 코드리뷰 #8: ETA 미상(arrivalTime null = 운행중)은 CTA에서 "곧 도착"이 아니라
  // "운행 중"으로 정직 표시한다.
  it('shows "운행 중" in the CTA when the selected train has no ETA (arrivalTime null)', () => {
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [
        { ...buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' }), arrivalTime: null },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-cta-eta')).toHaveTextContent('운행 중');
  });

  it('does NOT schedule an arrival alert when the toggle is off', () => {
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })])
    );
    const { getByTestId } = render(<TrainSelectionScreen />);
    // 토글을 off로 전환 후 탑승
    fireEvent(getByTestId('train-selection-alert-toggle'), 'valueChange', false);
    fireEvent.press(getByTestId('train-selection-cta-button'));

    expect(mockScheduleBoardingAlert).not.toHaveBeenCalled();
    // 알림과 무관하게 선택 저장 + 복귀는 정상 동작.
    expect(getBoardingSelection()).toMatchObject({ finalDestination: '잠실' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('requests notification permission when the alert toggle is switched on', () => {
    const mockRequestPermissions = notificationService.requestPermissions as jest.Mock;
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })])
    );
    const { getByTestId } = render(<TrainSelectionScreen />);
    // 시작은 ON이므로 OFF→ON으로 토글해 "켤 때 권한 요청" 경로를 탄다.
    fireEvent(getByTestId('train-selection-alert-toggle'), 'valueChange', false);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    fireEvent(getByTestId('train-selection-alert-toggle'), 'valueChange', true);
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  });

  // TODO(혼잡도): 실시간 혼잡도 표시 비활성 동안 추천 칸 계산도 비활성 (화면이
  //   useCongestion 결과를 무시하고 null 사용). 서울시 AI 실시간 혼잡도 소스 복원 시
  //   .skip 제거.
  it.skip('computes the recommended car from the selected train congestion', () => {
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up' })])
    );
    mockedUseCongestion.mockReturnValue({
      trainCongestion: {
        id: 's1',
        trainId: 'u1',
        lineId: '2',
        direction: 'up',
        overallLevel: CongestionLevel.HIGH,
        reportCount: 20,
        lastUpdated: new Date(),
        cars: [
          { carNumber: 1, congestionLevel: CongestionLevel.CROWDED, reportCount: 5, lastUpdated: new Date() },
          { carNumber: 2, congestionLevel: CongestionLevel.HIGH, reportCount: 5, lastUpdated: new Date() },
          { carNumber: 3, congestionLevel: CongestionLevel.LOW, reportCount: 5, lastUpdated: new Date() },
        ],
      },
    });
    const { getByText } = render(<TrainSelectionScreen />);
    // recommendCar → car 3 (only reliable LOW). Stub surfaces it as "rec 3".
    expect(getByText('rec 3')).toBeTruthy();
  });

  it('does not tick the countdown when the screen is unfocused (cleanup gate)', () => {
    (useIsFocused as jest.Mock).mockReturnValue(false);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-19T11:00:00.000Z'));
    mockedUseRealtimeTrains.mockReturnValue(
      okState([buildTrain({ id: 'u1', finalDestination: '잠실', direction: 'up', secondsAway: 120 })])
    );
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-cta-eta')).toHaveTextContent('2분 00초 후');
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // unfocused → no tick → still 2분 00초 후 (no drift to 1분 55초).
    expect(getByTestId('train-selection-cta-eta')).toHaveTextContent('2분 00초 후');
  });
});
