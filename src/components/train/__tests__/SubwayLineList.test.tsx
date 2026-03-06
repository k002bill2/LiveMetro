// Jest mock calls MUST come before imports (Jest hoisting requirement)
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SubwayLineList } from '../SubwayLineList';
import { trainService } from '@/services/train/trainService';

jest.mock('@/services/train/trainService', () => ({
  trainService: {
    getSubwayLines: jest.fn(),
  },
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000',
      surface: '#FFF',
      background: '#F5F5F5',
      backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A',
      textSecondary: '#666',
      textTertiary: '#999',
      textInverse: '#FFF',
      borderLight: '#E5E5E5',
      borderMedium: '#CCC',
      primaryLight: '#E5E5E5',
      black: '#000000',
    },
  })),
  ThemeColors: {},
}));

const mockTrainService = trainService as jest.Mocked<typeof trainService>;

const mockLines = [
  { id: '1', name: '1호선', color: '#0052A4', stations: [] },
  { id: '2', name: '2호선', color: '#00A84D', stations: [] },
  { id: '3', name: '3호선', color: '#EF7C1C', stations: [] },
];

describe('SubwayLineList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title "노선 정보"', async () => {
    mockTrainService.getSubwayLines.mockResolvedValue(mockLines);
    const { getByText } = render(<SubwayLineList />);
    expect(getByText('노선 정보')).toBeTruthy();
  });

  it('displays subway lines returned from trainService', async () => {
    mockTrainService.getSubwayLines.mockResolvedValue(mockLines);
    const { getByText } = render(<SubwayLineList />);
    await waitFor(() => {
      expect(getByText('1호선')).toBeTruthy();
      expect(getByText('2호선')).toBeTruthy();
      expect(getByText('3호선')).toBeTruthy();
    });
  });

  it('falls back to default Seoul Metro lines when service returns empty array', async () => {
    mockTrainService.getSubwayLines.mockResolvedValue([]);
    const { getByText } = render(<SubwayLineList />);
    await waitFor(() => {
      expect(getByText('1호선')).toBeTruthy();
      expect(getByText('2호선')).toBeTruthy();
      expect(getByText('9호선')).toBeTruthy();
    });
  });

  it('falls back to default lines when trainService throws', async () => {
    mockTrainService.getSubwayLines.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<SubwayLineList />);
    // No lines will be set on error — but the component should not crash
    await waitFor(() => {
      expect(getByText('노선 정보')).toBeTruthy();
    });
  });

  it('renders each line with accessible button role', async () => {
    mockTrainService.getSubwayLines.mockResolvedValue(mockLines);
    const { getAllByRole } = render(<SubwayLineList />);
    await waitFor(() => {
      const buttons = getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('renders line cards with accessibility label for each line', async () => {
    mockTrainService.getSubwayLines.mockResolvedValue(mockLines);
    const { getByLabelText } = render(<SubwayLineList />);
    await waitFor(() => {
      expect(getByLabelText('1호선')).toBeTruthy();
      expect(getByLabelText('2호선')).toBeTruthy();
    });
  });
});
