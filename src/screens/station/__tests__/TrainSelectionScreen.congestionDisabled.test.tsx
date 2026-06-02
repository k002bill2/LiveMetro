/**
 * TrainSelectionScreen — congestion-disabled guard (integration).
 *
 * Locks the CURRENT production reality: real-time congestion is disabled
 * (useCongestion gated off → trainCongestion null). This suite renders the REAL
 * SelectableTrainCard (NOT the thin stub the sibling suite uses) so the honest
 * "혼잡도 정보 준비 중" placeholder is asserted end-to-end through the screen,
 * and proves NO fake recommendation leaks while disabled.
 *
 * When the Seoul AI congestion source is restored (useCongestion returns real
 * cars), this null-mock test still passes (placeholder for empty data) while the
 * un-skipped recommendation test in TrainSelectionScreen.test.tsx begins
 * asserting real data — the pair brackets both states. See memory
 * project_realtime_congestion_disabled.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import TrainSelectionScreen from '../TrainSelectionScreen';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useCongestion } from '@/hooks/useCongestion';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
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

jest.mock('@/hooks/useRealtimeTrains', () => ({ useRealtimeTrains: jest.fn() }));

// Production reality while disabled: no congestion summary.
jest.mock('@/hooks/useCongestion', () => ({
  useCongestion: jest.fn(() => ({ trainCongestion: null })),
}));

jest.mock('@/services/notification/boardingAlertService', () => ({
  scheduleBoardingAlert: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/services/notification/notificationService', () => ({
  notificationService: {
    requestPermissions: jest.fn(() => Promise.resolve({ granted: true })),
  },
}));

// Inline design barrel mock — avoids atom-barrel cascade; Pill wraps in <Text>.
// NOTE: SelectableTrainCard is intentionally NOT mocked here (real card renders
// the placeholder we assert).
jest.mock('@/components/design', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    LineBadge: ({ line }: { line: string }) => <Text>{`line-${line}`}</Text>,
    Pill: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    congFromPct: (pct: number): string =>
      pct < 45 ? 'low' : pct < 70 ? 'mid' : pct < 88 ? 'high' : 'vhigh',
    CONG_TONE: {
      low: { color: '#22C55E', label: '여유' },
      mid: { color: '#F59E0B', label: '보통' },
      high: { color: '#F97316', label: '혼잡' },
      vhigh: { color: '#EF4444', label: '매우 혼잡' },
    },
  };
});

const mockedUseRealtimeTrains = useRealtimeTrains as jest.Mock;
const mockedUseCongestion = useCongestion as jest.Mock;

const upTrain = () => ({
  id: 'u1',
  lineId: '2',
  direction: 'up' as const,
  currentStationId: 'X',
  nextStationId: 'Y',
  finalDestination: '잠실',
  status: 'normal',
  arrivalTime: new Date(Date.now() + 120_000),
  delayMinutes: 0,
  lastUpdated: new Date(),
  trainType: 'normal' as const,
});

describe('TrainSelectionScreen — congestion disabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCongestion.mockReturnValue({ trainCongestion: null });
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [upTrain()],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('renders the honest "혼잡도 정보 준비 중" placeholder on the selected card', () => {
    const { getByTestId, getByText } = render(<TrainSelectionScreen />);
    // 첫 열차가 자동 선택 → 실제 카드가 빈 혼잡도 placeholder를 노출.
    expect(getByTestId('train-selection-card-0-congestion-empty')).toBeTruthy();
    expect(getByText('혼잡도 정보 준비 중')).toBeTruthy();
  });

  it('does NOT leak a fake recommended car while congestion is disabled', () => {
    const { queryByTestId } = render(<TrainSelectionScreen />);
    expect(queryByTestId('train-selection-card-0-recommendation')).toBeNull();
  });

  it('still shows the selected train arrival time in the CTA (feature works without congestion)', () => {
    const { getByTestId } = render(<TrainSelectionScreen />);
    expect(getByTestId('train-selection-cta-eta')).toBeTruthy();
  });

  // 코드리뷰 #5 회귀 가드: hero subtitle이 비활성 placeholder와 모순되게 "칸별
  // 혼잡도"를 약속하지 않는다. 실제 제공 항목(도착 시간 + 알림)만 안내.
  it('hero subtitle does not promise per-car congestion while it is disabled', () => {
    const { getByText, queryByText } = render(<TrainSelectionScreen />);
    expect(getByText('탑승할 열차를 선택하면 도착 시간과 30초 전 알림을 안내해 드려요')).toBeTruthy();
    expect(queryByText('탑승할 열차를 선택하면 칸별 혼잡도를 안내해 드려요')).toBeNull();
  });
});
