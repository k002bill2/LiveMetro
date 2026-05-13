import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StationPickerModal } from '../StationPickerModal';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) => {
    const ReactLib = require('react');
    const { View } = require('react-native');
    return ReactLib.createElement(View, props, children as React.ReactNode);
  },
  SafeAreaProvider: ({ children }: Record<string, unknown>) => children,
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/train/trainService', () => ({
  trainService: {
    searchStations: jest.fn().mockResolvedValue([
      { id: 'gangnam', name: '강남', nameEn: 'Gangnam', lineId: '2' },
      { id: 'gangnam-gu', name: '강남구청', nameEn: 'Gangnam-gu Office', lineId: '7' },
    ]),
  },
}));

describe('StationPickerModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    recentStations: [],
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when visible=false', () => {
    const { queryByTestId } = render(
      <StationPickerModal {...defaultProps} visible={false} />
    );
    expect(queryByTestId('station-picker-modal')).toBeNull();
  });

  it('renders search input when visible', () => {
    const { getByTestId } = render(<StationPickerModal {...defaultProps} />);
    expect(getByTestId('station-picker-search-input')).toBeTruthy();
  });

  it('shows search results after typing', async () => {
    const { getByTestId, getAllByText } = render(<StationPickerModal {...defaultProps} />);
    fireEvent.changeText(getByTestId('station-picker-search-input'), '강남');
    // 강남 is a transfer station (2호선·신분당선) so it renders one row per line.
    await waitFor(() => expect(getAllByText('강남').length).toBeGreaterThanOrEqual(2));
    expect(getAllByText('강남구청').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSelect with station when result tapped', async () => {
    const { getByTestId, getAllByText } = render(<StationPickerModal {...defaultProps} />);
    fireEvent.changeText(getByTestId('station-picker-search-input'), '강남');
    await waitFor(() => expect(getAllByText('강남').length).toBeGreaterThanOrEqual(1));
    fireEvent.press(getAllByText('강남')[0]);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'gangnam', name: '강남' })
    );
  });

  it('calls onClose when close button tapped', () => {
    const { getByTestId } = render(<StationPickerModal {...defaultProps} />);
    fireEvent.press(getByTestId('station-picker-close'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
