import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommutePredictionCard } from '../CommutePredictionCard';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

// Phase 50 — Wanted DS migration: useTheme().isDark drives the
// WANTED_TOKENS semantic theme. Legacy COLORS/SPACING/RADIUS/TYPOGRAPHY
// mock removed because component no longer imports them.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/models/ml', () => ({
  MIN_LOGS_FOR_ML_TRAINING: 10,
}));

const mockUseMLPrediction = jest.fn();
jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: () => mockUseMLPrediction(),
}));

const basePrediction = {
  predictedDepartureTime: '08:30',
  predictedArrivalTime: '09:15',
  delayProbability: 0.3,
  confidence: 0.85,
};

const baseMLReturn = {
  prediction: null,
  loading: false,
  error: null,
  isModelReady: false,
  logCount: 5,
  hasEnoughData: false,
  refreshPrediction: jest.fn(),
  trainModel: jest.fn(),
  isTraining: false,
  trainingProgress: 0,
  modelMetadata: null,
};

describe('CommutePredictionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when loading with no prediction', () => {
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      loading: true,
      hasEnoughData: true,
    });
    const { getByText } = render(<CommutePredictionCard />);
    expect(getByText('예측 정보 불러오는 중...')).toBeTruthy();
  });

  it('renders not enough data state with progress', () => {
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: false,
      logCount: 5,
    });
    const { getByText } = render(<CommutePredictionCard />);
    expect(getByText('출퇴근 패턴 학습')).toBeTruthy();
    expect(getByText('현재 5개 / 최소 10개')).toBeTruthy();
  });

  it('renders error state with retry button', () => {
    const refreshFn = jest.fn();
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: true,
      error: '네트워크 오류',
      refreshPrediction: refreshFn,
    });
    const { getByText } = render(<CommutePredictionCard />);
    expect(getByText('예측 오류')).toBeTruthy();
    expect(getByText('네트워크 오류')).toBeTruthy();
    fireEvent.press(getByText('다시 시도'));
    expect(refreshFn).toHaveBeenCalled();
  });

  it('renders training state with progress', () => {
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: true,
      isTraining: true,
      trainingProgress: 0.65,
    });
    const { getByText } = render(<CommutePredictionCard />);
    expect(getByText('모델 학습 중')).toBeTruthy();
    expect(getByText('학습 진행률: 65%')).toBeTruthy();
  });

  it('renders prediction with departure and arrival times', () => {
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: true,
      isModelReady: true,
      prediction: basePrediction,
    });
    const { getByText } = render(<CommutePredictionCard />);
    expect(getByText('오늘의 출퇴근 예측')).toBeTruthy();
    expect(getByText('08:30')).toBeTruthy();
    expect(getByText('09:15')).toBeTruthy();
  });

  it('shows delay probability when above threshold', () => {
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: true,
      isModelReady: true,
      prediction: { ...basePrediction, delayProbability: 0.5 },
    });
    const { getByText } = render(<CommutePredictionCard />);
    expect(getByText('50%')).toBeTruthy();
  });

  it('renders action buttons when not compact', () => {
    const onScheduleAlert = jest.fn();
    const onViewDetails = jest.fn();
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: true,
      isModelReady: true,
      prediction: basePrediction,
    });
    const { getByText } = render(
      <CommutePredictionCard
        onScheduleAlert={onScheduleAlert}
        onViewDetails={onViewDetails}
      />,
    );
    fireEvent.press(getByText('알림 설정'));
    expect(onScheduleAlert).toHaveBeenCalled();
    fireEvent.press(getByText('주간 예측'));
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('returns null when no prediction and all conditions met', () => {
    mockUseMLPrediction.mockReturnValue({
      ...baseMLReturn,
      hasEnoughData: true,
      isModelReady: true,
      prediction: null,
    });
    const { toJSON } = render(<CommutePredictionCard />);
    expect(toJSON()).toBeNull();
  });
});
