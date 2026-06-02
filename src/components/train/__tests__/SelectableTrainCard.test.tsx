import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SelectableTrainCard } from '../SelectableTrainCard';

// 디자인 barrel을 inline mock — atom barrel cascade 로드 폭발 회피
// (메모리: feedback_atom_barrel_test_cascade). Pill은 raw string children을
// RNTL이 인식하도록 <Text>로 wrap (메모리: feedback_pill_atom_mock_text_wrap).
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

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

const baseProps = {
  line: '2' as const,
  destination: '잠실',
  minutes: 1,
  seconds: 47,
  selected: false,
  onSelect: jest.fn(),
  testID: 'card',
};

describe('SelectableTrainCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders destination 방면 and the arrival time', () => {
    const { getByText } = render(<SelectableTrainCard {...baseProps} />);
    expect(getByText('잠실 방면')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
    expect(getByText('47초')).toBeTruthy();
  });

  it('shows a "곧 도착" pill when the train is imminent (0 remaining)', () => {
    const { getByText, queryByText } = render(
      <SelectableTrainCard {...baseProps} minutes={0} seconds={0} />
    );
    expect(getByText('곧 도착')).toBeTruthy();
    expect(queryByText('47초')).toBeNull();
  });

  // 코드리뷰 #8: arrivalTime null(운행중, ETA 미상)은 "곧 도착"이 아니라 "운행 중".
  it('shows "운행 중" instead of "곧 도착" when no ETA is known (hasEta=false)', () => {
    const { getByText, queryByText } = render(
      <SelectableTrainCard {...baseProps} hasEta={false} />
    );
    expect(getByText('운행 중')).toBeTruthy();
    expect(queryByText('곧 도착')).toBeNull();
    expect(queryByText('47초')).toBeNull();
  });

  it('calls onSelect when the card is pressed', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <SelectableTrainCard {...baseProps} onSelect={onSelect} />
    );
    fireEvent.press(getByTestId('card'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('reflects the selected state on the radio control', () => {
    const { getByTestId, rerender } = render(
      <SelectableTrainCard {...baseProps} selected={false} />
    );
    expect(getByTestId('card-radio').props.accessibilityState).toMatchObject({
      selected: false,
    });
    rerender(<SelectableTrainCard {...baseProps} selected />);
    expect(getByTestId('card-radio').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('shows the 급행 badge for express trains and none for normal', () => {
    const { getByText, queryByText, rerender } = render(
      <SelectableTrainCard {...baseProps} trainType="express" />
    );
    expect(getByText('급행')).toBeTruthy();
    rerender(<SelectableTrainCard {...baseProps} trainType="normal" />);
    expect(queryByText('급행')).toBeNull();
  });

  it('shows a delay subtitle when delayed and 정시 운행 otherwise', () => {
    const { getByText, rerender } = render(
      <SelectableTrainCard {...baseProps} delayMinutes={3} />
    );
    expect(getByText('지연 3분')).toBeTruthy();
    rerender(<SelectableTrainCard {...baseProps} delayMinutes={0} />);
    expect(getByText('정시 운행')).toBeTruthy();
  });

  describe('congestion section (selected only)', () => {
    const congProps = {
      ...baseProps,
      selected: true,
      carCongestion: [95, 80, 50, 50, 80, 50, 20, 50, 80, 95],
      recommendedCar: 7,
      onSelectCar: jest.fn(),
    };

    it('renders one bar per car when selected with congestion data', () => {
      const { getByTestId } = render(<SelectableTrainCard {...congProps} />);
      expect(getByTestId('card-car-1')).toBeTruthy();
      expect(getByTestId('card-car-10')).toBeTruthy();
    });

    it('surfaces the recommended car in the recommendation banner', () => {
      const { getByTestId, getByText } = render(<SelectableTrainCard {...congProps} />);
      expect(getByTestId('card-recommendation')).toBeTruthy();
      expect(getByText('7번 칸이 가장 여유로워요')).toBeTruthy();
    });

    it('calls onSelectCar with the tapped car number', () => {
      const onSelectCar = jest.fn();
      const { getByTestId } = render(
        <SelectableTrainCard {...congProps} onSelectCar={onSelectCar} />
      );
      fireEvent.press(getByTestId('card-car-3'));
      expect(onSelectCar).toHaveBeenCalledWith(3);
    });

    it('does NOT render congestion bars when the card is not selected', () => {
      const { queryByTestId } = render(
        <SelectableTrainCard {...congProps} selected={false} />
      );
      expect(queryByTestId('card-car-1')).toBeNull();
    });

    it('shows a friendly placeholder when selected but no congestion data exists', () => {
      const { getByTestId, getByText, queryByTestId } = render(
        <SelectableTrainCard
          {...baseProps}
          selected
          carCongestion={[]}
          recommendedCar={null}
        />
      );
      expect(getByTestId('card-congestion-empty')).toBeTruthy();
      // 정직한 copy를 lock — 혼잡도 비활성 동안 사용자에게 노출되는 문구.
      expect(getByText('혼잡도 정보 준비 중')).toBeTruthy();
      expect(getByText('사용자 제보가 쌓이면 칸별로 안내해 드려요')).toBeTruthy();
      expect(queryByTestId('card-recommendation')).toBeNull();
    });
  });
});
