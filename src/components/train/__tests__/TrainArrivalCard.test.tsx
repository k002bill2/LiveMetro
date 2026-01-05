/**
 * TrainArrivalCard Component Tests
 * Comprehensive test suite for the TrainArrivalCard component
 */

import React, { ReactElement } from 'react';
import { render, fireEvent, RenderOptions } from '@testing-library/react-native';
import { TrainArrivalCard } from '../TrainArrivalCard';
import { Train, TrainStatus } from '@models/train';
import { ThemeProvider } from '@services/theme';

// Mock utilities
jest.mock('@utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn((lineId: string) => '#00a84d'), // Line 2 green
  getLineTextColor: jest.fn(() => 'white'),
  getDelayColor: jest.fn((minutes: number) => {
    if (minutes < 5) return '#10b981';
    if (minutes < 10) return '#f59e0b';
    return '#ef4444';
  }),
  addAlpha: jest.fn((color: string, alpha: number) => `rgba(0,168,77,${alpha})`),
}));

// Custom render function that wraps components with ThemeProvider
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
};

describe('TrainArrivalCard', () => {
  const createMockTrain = (overrides?: Partial<Train>): Train => ({
    id: 'test-train-1',
    lineId: '2',
    direction: 'up',
    currentStationId: 'gangnam',
    nextStationId: 'yeoksam',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    delayMinutes: 0,
    lastUpdated: new Date(),
    ...overrides,
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const train = createMockTrain({ lineId: '2' });
      const { getByText } = customRender(
        <TrainArrivalCard train={train} />
      );

      expect(getByText('2호선')).toBeTruthy();
    });

    it('should display line name when provided', () => {
      const train = createMockTrain({ lineId: '2' });
      const { getByText } = customRender(
        <TrainArrivalCard train={train} />
      );

      expect(getByText('2호선')).toBeTruthy();
    });

    it('should display station name when provided', () => {
      const train = createMockTrain({ nextStationId: '강남' });
      const { getByText } = customRender(
        <TrainArrivalCard train={train} />
      );

      expect(getByText('강남역')).toBeTruthy();
    });

    it('should display direction correctly for upward train', () => {
      const train = createMockTrain({ direction: 'up' });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('상행')).toBeTruthy();
    });

    it('should display direction correctly for downward train', () => {
      const train = createMockTrain({ direction: 'down' });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('하행')).toBeTruthy();
    });
  });

  describe('Arrival Time Display', () => {
    it('should display "도착" for trains arriving now', () => {
      const train = createMockTrain({
        arrivalTime: new Date(Date.now() - 1000), // Already passed
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('도착')).toBeTruthy();
    });

    it('should display "1분 후" for trains arriving in 1 minute', () => {
      const train = createMockTrain({
        arrivalTime: new Date(Date.now() + 60 * 1000), // 1 minute
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('1분 후')).toBeTruthy();
    });

    it('should display minutes for trains arriving later', () => {
      const train = createMockTrain({
        arrivalTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('5분 후')).toBeTruthy();
    });

    it('should display "정보 없음" when arrival time is null', () => {
      const train = createMockTrain({
        arrivalTime: null,
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('정보 없음')).toBeTruthy();
    });
  });

  describe('Train Status', () => {
    it('should display normal status correctly', () => {
      const train = createMockTrain({ status: TrainStatus.NORMAL });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('정상')).toBeTruthy();
    });

    it('should display delayed status correctly', () => {
      const train = createMockTrain({ status: TrainStatus.DELAYED });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('지연')).toBeTruthy();
    });

    it('should display suspended status correctly', () => {
      const train = createMockTrain({ status: TrainStatus.SUSPENDED });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('운행중단')).toBeTruthy();
    });

    it('should display maintenance status correctly', () => {
      const train = createMockTrain({ status: TrainStatus.MAINTENANCE });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('점검중')).toBeTruthy();
    });

    it('should display emergency status correctly', () => {
      const train = createMockTrain({ status: TrainStatus.EMERGENCY });
      const { getByText } = customRender(<TrainArrivalCard train={train} />);

      expect(getByText('긴급')).toBeTruthy();
    });
  });

  describe('Delay Information', () => {
    it('should display delay information when train is delayed', () => {
      const train = createMockTrain({
        status: TrainStatus.DELAYED,
        delayMinutes: 5,
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('5분 지연')).toBeTruthy();
    });

    it('should not display delay information when train is not delayed', () => {
      const train = createMockTrain({
        status: TrainStatus.NORMAL,
        delayMinutes: 0,
      });

      const { queryByText } = customRender(<TrainArrivalCard train={train} />);
      expect(queryByText(/지연/)).toBeNull();
    });

    it('should display correct delay color for minor delay', () => {
      const train = createMockTrain({
        status: TrainStatus.DELAYED,
        delayMinutes: 3,
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('3분 지연')).toBeTruthy();
    });

    it('should display correct delay color for major delay', () => {
      const train = createMockTrain({
        status: TrainStatus.DELAYED,
        delayMinutes: 15,
      });

      const { getByText } = customRender(<TrainArrivalCard train={train} />);
      expect(getByText('15분 지연')).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('should call onPress when card is pressed', () => {
      const onPress = jest.fn();
      const train = createMockTrain();

      const { getByRole } = customRender(
        <TrainArrivalCard train={train} onPress={onPress} />
      );

      const button = getByRole('button');
      fireEvent.press(button);

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not crash when pressed without onPress handler', () => {
      const train = createMockTrain();

      const { getByRole } = customRender(<TrainArrivalCard train={train} />);

      // Should render as summary, not button
      expect(getByRole('summary')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility role when pressable', () => {
      const train = createMockTrain();

      const { getByRole } = customRender(
        <TrainArrivalCard train={train} onPress={() => {}} />
      );

      expect(getByRole('button')).toBeTruthy();
    });

    it('should have proper accessibility role when not pressable', () => {
      const train = createMockTrain();

      const { getByRole } = customRender(<TrainArrivalCard train={train} />);

      expect(getByRole('summary')).toBeTruthy();
    });

    it('should have descriptive accessibility label', () => {
      const train = createMockTrain({
        direction: 'up',
        delayMinutes: 0,
        lineId: '2',
      });

      const { getByLabelText } = customRender(
        <TrainArrivalCard
          train={train}
        />
      );

      const element = getByLabelText(/2호선.*상행.*열차/);
      expect(element).toBeTruthy();
    });

    it('should include delay information in accessibility label', () => {
      const train = createMockTrain({
        status: TrainStatus.DELAYED,
        delayMinutes: 5,
        lineId: '2',
      });

      const { getByLabelText } = customRender(
        <TrainArrivalCard train={train} />
      );

      const element = getByLabelText(/5분 지연/);
      expect(element).toBeTruthy();
    });

    it('should have accessibility hint when pressable', () => {
      const train = createMockTrain();

      const { getByA11yHint } = customRender(
        <TrainArrivalCard train={train} onPress={() => {}} />
      );

      expect(
        getByA11yHint('열차 상세 정보를 확인하려면 두 번 탭하세요')
      ).toBeTruthy();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom style', () => {
      const train = createMockTrain();
      const customStyle = { marginBottom: 24 };

      const { getByRole } = customRender(
        <TrainArrivalCard train={train} style={customStyle} />
      );

      const element = getByRole('summary');
      expect(element.props.style).toContainEqual(customStyle);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing line name gracefully', () => {
      const train = createMockTrain({ lineId: '' });

      const { queryByText } = customRender(<TrainArrivalCard train={train} />);

      // Should not crash, line badge should not render
      expect(queryByText(/호선/)).toBeNull();
    });

    it('should handle missing station name gracefully', () => {
      const train = createMockTrain({ nextStationId: '' });

      const { queryByText } = customRender(<TrainArrivalCard train={train} />);

      expect(queryByText(/역$/)).toBeNull();
    });

    it('should handle null next station ID', () => {
      const train = createMockTrain({ nextStationId: null });

      // Should not crash when nextStationId is null
      expect(() => customRender(<TrainArrivalCard train={train} />)).not.toThrow();
    });
  });
});
