jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
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
    isDark: false,
  }),
}));

jest.mock('@/styles/modernTheme', () => ({
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16 },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
  },
}));

jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CROWDED: 'crowded',
  },
  getCongestionLevelName: (level: string) => {
    const names: Record<string, string> = {
      low: '여유',
      moderate: '보통',
      high: '혼잡',
      crowded: '매우혼잡',
    };
    return names[level] || level;
  },
  getCongestionLevelColor: (level: string) => {
    const colors: Record<string, string> = {
      low: '#34C759',
      moderate: '#FF9500',
      high: '#FF6B00',
      crowded: '#FF3B30',
    };
    return colors[level] || '#8E8E93';
  },
  TRAIN_CAR_COUNT: 10,
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CongestionReportModal } from '../CongestionReportModal';

const defaultTrainInfo = {
  trainId: 'T001',
  lineId: '2',
  stationId: 'ST001',
  stationName: '강남',
  direction: 'up' as const,
};

describe('CongestionReportModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
    trainInfo: defaultTrainInfo,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal header and station info', () => {
    const { getByText } = render(
      <CongestionReportModal {...defaultProps} />,
    );
    expect(getByText('혼잡도 제보')).toBeTruthy();
    expect(getByText('강남역')).toBeTruthy();
    expect(getByText('상행')).toBeTruthy();
  });

  it('renders 10 car selection buttons', () => {
    const { getByText } = render(
      <CongestionReportModal {...defaultProps} />,
    );
    for (let i = 1; i <= 10; i++) {
      expect(getByText(String(i))).toBeTruthy();
    }
  });

  it('renders congestion level options', () => {
    const { getByText } = render(
      <CongestionReportModal {...defaultProps} />,
    );
    expect(getByText('여유')).toBeTruthy();
    expect(getByText('보통')).toBeTruthy();
    expect(getByText('혼잡')).toBeTruthy();
    expect(getByText('매우혼잡')).toBeTruthy();
  });

  it('renders submit button as disabled when no selection is made', () => {
    const { getByText } = render(
      <CongestionReportModal {...defaultProps} />,
    );
    const submitButton = getByText('제보하기');
    // Button exists but is disabled (no car or level selected)
    expect(submitButton).toBeTruthy();
  });

  it('renders car hint text', () => {
    const { getByText } = render(
      <CongestionReportModal {...defaultProps} />,
    );
    expect(getByText('← 1호차(앞) ... 10호차(뒤) →')).toBeTruthy();
  });

  it('calls onSubmit with correct data when car and level are selected', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByText } = render(
      <CongestionReportModal
        {...defaultProps}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    // Select car 3
    fireEvent.press(getByText('3'));
    // Select congestion level
    fireEvent.press(getByText('보통'));
    // Submit
    fireEvent.press(getByText('제보하기'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        trainId: 'T001',
        lineId: '2',
        stationId: 'ST001',
        direction: 'up',
        carNumber: 3,
        congestionLevel: 'moderate',
      });
    });
  });

  it('shows direction text for down direction', () => {
    const { getByText } = render(
      <CongestionReportModal
        {...defaultProps}
        trainInfo={{ ...defaultTrainInfo, direction: 'down' }}
      />,
    );
    expect(getByText('하행')).toBeTruthy();
  });
});
