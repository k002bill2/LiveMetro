/**
 * TransferStationList Test Suite
 * Tests transfer station list rendering, empty state, add/remove interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransferStationList } from '../TransferStationList';
import { TransferStation } from '@/models/commute';

jest.mock('lucide-react-native', () => ({
  ArrowLeftRight: 'ArrowLeftRight',
  XCircle: 'XCircle',
  PlusCircle: 'PlusCircle',
  Info: 'Info',
}));

jest.mock('@/models/commute', () => ({
  MAX_TRANSFER_STATIONS: 3,
}));

jest.mock('@/styles/modernTheme', () => ({
  COLORS: {
    white: '#FFFFFF',
    black: '#000000',
    secondary: { blue: '#007AFF', yellow: '#FFD700' },
    text: { primary: '#1A1A1A', secondary: '#666', tertiary: '#999' },
    surface: { background: '#F5F5F5' },
    border: { light: '#E5E5E5', medium: '#CCC' },
    gray: { 400: '#BBBBBB' },
  },
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 16, lg: 18 },
    fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  },
  RADIUS: { base: 8, lg: 12 },
}));

const mockTransfer1: TransferStation = {
  stationId: 'stn-001',
  stationName: '강남',
  lineId: '2',
  lineName: '2호선',
  order: 0,
};

const mockTransfer2: TransferStation = {
  stationId: 'stn-002',
  stationName: '홍대입구',
  lineId: '2',
  lineName: '2호선',
  order: 1,
};

describe('TransferStationList', () => {
  const defaultProps = {
    transfers: [] as readonly TransferStation[],
    onAddTransfer: jest.fn(),
    onRemoveTransfer: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with "환승역" label', () => {
    const { getByText } = render(<TransferStationList {...defaultProps} />);

    expect(getByText('환승역')).toBeTruthy();
  });

  it('shows transfer count as "0/3" when empty', () => {
    const { getByText } = render(<TransferStationList {...defaultProps} />);

    expect(getByText('0/3')).toBeTruthy();
  });

  it('renders empty state when no transfers', () => {
    const { getByText } = render(<TransferStationList {...defaultProps} />);

    expect(getByText('환승역이 없습니다')).toBeTruthy();
    expect(getByText('직행 노선인 경우 환승역을 추가하지 않아도 됩니다')).toBeTruthy();
  });

  it('renders add transfer button when under max transfers', () => {
    const { getByText } = render(<TransferStationList {...defaultProps} />);

    expect(getByText('환승역 추가')).toBeTruthy();
  });

  it('calls onAddTransfer when add button is pressed', () => {
    const mockOnAdd = jest.fn();
    const { getByText } = render(
      <TransferStationList {...defaultProps} onAddTransfer={mockOnAdd} />
    );

    fireEvent.press(getByText('환승역 추가'));

    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  it('renders transfer station items with name and line', () => {
    const { getByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={[mockTransfer1]}
      />
    );

    expect(getByText('강남')).toBeTruthy();
    expect(getByText('2호선')).toBeTruthy();
  });

  it('renders multiple transfer stations', () => {
    const { getByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={[mockTransfer1, mockTransfer2]}
      />
    );

    expect(getByText('강남')).toBeTruthy();
    expect(getByText('홍대입구')).toBeTruthy();
  });

  it('shows correct count when transfers exist', () => {
    const { getByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={[mockTransfer1, mockTransfer2]}
      />
    );

    expect(getByText('2/3')).toBeTruthy();
  });

  it('hides empty state when transfers exist', () => {
    const { queryByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={[mockTransfer1]}
      />
    );

    expect(queryByText('환승역이 없습니다')).toBeNull();
  });

  it('hides add button and shows max notice when at max transfers', () => {
    const maxTransfers: TransferStation[] = [
      { ...mockTransfer1, order: 0 },
      { ...mockTransfer2, stationId: 'stn-003', stationName: '신촌', order: 1 },
      { stationId: 'stn-004', stationName: '서울역', lineId: '1', lineName: '1호선', order: 2 },
    ];

    const { queryByText, getByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={maxTransfers}
      />
    );

    expect(queryByText('환승역 추가')).toBeNull();
    expect(getByText(/최대 3개의 환승역을 추가할 수 있습니다/)).toBeTruthy();
  });

  it('respects custom maxTransfers prop', () => {
    const { getByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={[mockTransfer1]}
        maxTransfers={2}
      />
    );

    expect(getByText('1/2')).toBeTruthy();
  });

  it('hides add button when maxTransfers is 1 and one transfer exists', () => {
    const { queryByText } = render(
      <TransferStationList
        {...defaultProps}
        transfers={[mockTransfer1]}
        maxTransfers={1}
      />
    );

    expect(queryByText('환승역 추가')).toBeNull();
  });
});
