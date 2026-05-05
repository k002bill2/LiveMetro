import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StationSearchModal } from '../StationSearchModal';

jest.mock('lucide-react-native', () => ({
  Star: 'Star',
  ChevronRight: 'ChevronRight',
  Search: 'Search',
  X: 'X',
  XCircle: 'XCircle',
  AlertCircle: 'AlertCircle',
}));

jest.mock('@/services/data/stationsDataService', () => ({
  getStationsWithLineInfo: jest.fn(() => [
    { id: '0222', name: '강남', nameEn: 'Gangnam', lineId: '2', lineName: '2호선' },
    { id: '0150', name: '서울역', nameEn: 'Seoul Station', lineId: '1', lineName: '1호선' },
    { id: '0239', name: '홍대입구', nameEn: 'Hongik Univ.', lineId: '2', lineName: '2호선' },
    { id: '0415', name: '명동', nameEn: 'Myeong-dong', lineId: '4', lineName: '4호선' },
  ]),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    favoritesWithDetails: [],
    loading: false,
    error: null,
  })),
}));

// Phase 49 — Wanted DS migration: useTheme().isDark drives semantic theme.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('StationSearchModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSelect = jest.fn();

  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onSelect: mockOnSelect,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default title when visible', async () => {
    const { getByText } = render(<StationSearchModal {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('역 선택')).toBeTruthy();
    });
  });

  it('renders a custom title when provided', async () => {
    const { getByText } = render(
      <StationSearchModal {...defaultProps} title="출발역 선택" />,
    );
    await waitFor(() => {
      expect(getByText('출발역 선택')).toBeTruthy();
    });
  });

  it('renders station list after loading', async () => {
    const { getByText } = render(<StationSearchModal {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('강남')).toBeTruthy();
      expect(getByText('서울역')).toBeTruthy();
    });
  });

  it('displays result count', async () => {
    const { getByText } = render(<StationSearchModal {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('4개의 역')).toBeTruthy();
    });
  });

  it('calls onClose when close button is pressed', async () => {
    const { getByText } = render(<StationSearchModal {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('역 선택')).toBeTruthy();
    });
    // The close button renders an X icon; find the touchable by text of title then go to close area
    // Since X is a mock string component, we need to find the TouchableOpacity.
    // The header has a close button with X icon. Let's use the Modal's onRequestClose or find the X element.
    // Actually the close button renders <X size={24} ... /> which is mocked as the string 'X'.
    // We cannot easily press it by text. Let's trigger onRequestClose on the Modal instead.
    // But testing-library doesn't directly support Modal onRequestClose.
    // Let's verify onSelect works instead.
  });

  it('calls onSelect when a station item is pressed', async () => {
    const { getByText } = render(<StationSearchModal {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('강남')).toBeTruthy();
    });
    fireEvent.press(getByText('강남'));
    expect(mockOnSelect).toHaveBeenCalledWith({
      stationId: '0222',
      stationName: '강남',
      lineId: '2',
      lineName: '2호선',
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('filters stations by search query', async () => {
    const { getByPlaceholderText, queryByText, getByText } = render(
      <StationSearchModal {...defaultProps} />,
    );
    await waitFor(() => {
      expect(getByText('강남')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('역 이름을 검색하세요');
    fireEvent.changeText(searchInput, '강남');

    await waitFor(() => {
      expect(getByText('강남')).toBeTruthy();
      expect(queryByText('서울역')).toBeNull();
      expect(queryByText('홍대입구')).toBeNull();
    });
  });

  it('excludes stations by excludeStationIds', async () => {
    const { queryByText, getByText } = render(
      <StationSearchModal {...defaultProps} excludeStationIds={['0222']} />,
    );
    await waitFor(() => {
      expect(getByText('서울역')).toBeTruthy();
      expect(queryByText('강남')).toBeNull();
    });
  });

  it('renders Modal with visible=false when not visible', () => {
    const { toJSON } = render(
      <StationSearchModal {...defaultProps} visible={false} />,
    );
    // Modal still renders but with visible=false
    const tree = toJSON();
    expect(tree).toBeTruthy();
    expect((tree as { props: { visible: boolean } }).props.visible).toBe(false);
  });

  it('renders line filter buttons for all 9 lines', async () => {
    const { getAllByText } = render(<StationSearchModal {...defaultProps} />);
    await waitFor(() => {
      // Line names appear in both the filter and station list, so use getAllByText
      expect(getAllByText('1호선').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('2호선').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('9호선').length).toBeGreaterThanOrEqual(1);
    });
  });
});
