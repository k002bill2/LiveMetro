/**
 * WeeklyPredictionScreen Test Suite
 * Tests weekly prediction screen rendering, model info, and prediction cards
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WeeklyPredictionScreen } from '../WeeklyPredictionScreen';
import { useMLPrediction } from '@/hooks/useMLPrediction';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Clock: 'Clock',
  AlertTriangle: 'AlertTriangle',
  CheckCircle: 'CheckCircle',
  XCircle: 'XCircle',
  Brain: 'Brain',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  NavigationProp: {},
}));
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
  })),
  ThemeColors: {},
}));

const mockGetWeekPredictions = jest.fn(() => Promise.resolve([]));
const mockTrainModel = jest.fn(() => Promise.resolve());

jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: jest.fn(() => ({
    getWeekPredictions: mockGetWeekPredictions,
    isModelReady: true,
    modelMetadata: null,
    trainModel: mockTrainModel,
    isTraining: false,
    hasEnoughData: false,
  })),
}));

describe('WeeklyPredictionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMLPrediction as jest.Mock).mockReturnValue({
      getWeekPredictions: mockGetWeekPredictions,
      isModelReady: true,
      modelMetadata: null,
      trainModel: mockTrainModel,
      isTraining: false,
      hasEnoughData: false,
    });
    mockGetWeekPredictions.mockResolvedValue([]);
  });

  it('renders header with title', () => {
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('주간 출퇴근 예측')).toBeTruthy();
  });

  it('shows back button', () => {
    const { getByLabelText } = render(<WeeklyPredictionScreen />);
    expect(getByLabelText('뒤로 가기')).toBeTruthy();
  });

  it('shows model info for default model', () => {
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('기본 모델 사용 중')).toBeTruthy();
  });

  it('shows model info for fine-tuned model', () => {
    (useMLPrediction as jest.Mock).mockReturnValue({
      getWeekPredictions: mockGetWeekPredictions,
      isModelReady: true,
      modelMetadata: { isFineTuned: true, accuracy: 0.85 },
      trainModel: mockTrainModel,
      isTraining: false,
      hasEnoughData: false,
    });

    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('맞춤 학습 완료 (정확도: 85%)')).toBeTruthy();
  });

  it('shows train button when enough data available', () => {
    (useMLPrediction as jest.Mock).mockReturnValue({
      getWeekPredictions: mockGetWeekPredictions,
      isModelReady: true,
      modelMetadata: null,
      trainModel: mockTrainModel,
      isTraining: false,
      hasEnoughData: true,
    });

    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('학습하기')).toBeTruthy();
  });

  it('renders prediction cards when data loads', async () => {
    const predictions = [
      {
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:15',
        delayProbability: 0.2,
        confidence: 0.75,
      },
      null,
      null,
      null,
      null,
      null,
      null,
    ];
    mockGetWeekPredictions.mockResolvedValue(predictions);

    const { getByText } = render(<WeeklyPredictionScreen />);

    await waitFor(() => {
      expect(getByText('08:30')).toBeTruthy();
      expect(getByText('09:15')).toBeTruthy();
    });
  });

  it('shows legend section', () => {
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('범례')).toBeTruthy();
    expect(getByText('높은 신뢰도 (50% 이상)')).toBeTruthy();
  });

  it('navigates back on back button press', () => {
    const mockGoBack = jest.fn();
    const { useNavigation } = require('@react-navigation/native');
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: jest.fn(),
      goBack: mockGoBack,
    });

    const { getByLabelText } = render(<WeeklyPredictionScreen />);
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
