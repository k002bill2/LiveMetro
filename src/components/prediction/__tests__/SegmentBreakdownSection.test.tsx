import React from 'react';
import { render } from '@testing-library/react-native';
import { SegmentBreakdownSection } from '@/components/prediction/SegmentBreakdownSection';
import { CongestionLevel } from '@/models/congestion';
// RNTL v13 auto-extends expect with toHaveTextContent at runtime, but the
// public types only export the matcher interface as `export type *`, which
// does not pull the `declare module '@jest/expect'` augmentation into scope.
// Re-declare the single matcher we use here so TypeScript matches the
// runtime contract.
declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void>, T = unknown> {
    toHaveTextContent(expectedText: string | RegExp, options?: { exact?: boolean }): R;
  }
}

// Lucide icons → string-stub Proxy (matches CommutePredictionCard.test.tsx).
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

// useTheme — flat color contract per src/services/theme/themeContext.tsx.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

// LineBadge — testable text stub so we can assert "2호선" rendering.
jest.mock('@/components/design/LineBadge', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    LineBadge: ({ line, testID }: { line: string; testID?: string }) =>
      ReactActual.createElement(RN.Text, { testID: testID ?? `line-badge-${line}` }, `${line}호선`),
  };
});

// CongestionDots — render the level as text so assertions can target it.
jest.mock('@/components/design/CongestionDots', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    CongestionDots: ({ level, testID }: { level: string; testID?: string }) =>
      ReactActual.createElement(RN.Text, { testID: testID ?? `congestion-dots-${level}` }, `dots-${level}`),
  };
});

const mockRoute = {
  walkToStation: { durationMin: 4 },
  wait: { lineId: '2', direction: '잠실', durationMin: 3 },
  ride: {
    fromStation: '홍대입구',
    toStation: '강남',
    stopsCount: 8,
    durationMin: 18,
    congestionLevel: CongestionLevel.MODERATE,
  },
  walkToDestination: { durationMin: 3 },
};

const mockOrigin = { name: '집', exit: '홍대입구역 9번출구' };
const mockDestination = { name: '강남역 11번출구', exit: '회사' };

describe('SegmentBreakdownSection', () => {
  it('renders all 4 segment rows', () => {
    const { getByTestId } = render(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />,
    );
    expect(getByTestId('segment-row-walk-origin')).toBeTruthy();
    expect(getByTestId('segment-row-wait')).toBeTruthy();
    expect(getByTestId('segment-row-ride')).toBeTruthy();
    expect(getByTestId('segment-row-walk-destination')).toBeTruthy();
  });

  it('displays correct duration for each row', () => {
    const { getByTestId } = render(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />,
    );
    expect(getByTestId('segment-row-walk-origin')).toHaveTextContent(/4분/);
    expect(getByTestId('segment-row-wait')).toHaveTextContent(/3분/);
    expect(getByTestId('segment-row-ride')).toHaveTextContent(/18분/);
    expect(getByTestId('segment-row-walk-destination')).toHaveTextContent(/3분/);
  });

  it('shows line badge with lineId in wait row', () => {
    const { getByTestId } = render(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />,
    );
    const waitRow = getByTestId('segment-row-wait');
    expect(waitRow).toHaveTextContent(/2호선/);
    expect(waitRow).toHaveTextContent(/잠실/);
  });

  it('shows stops count in ride row', () => {
    const { getByTestId } = render(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />,
    );
    expect(getByTestId('segment-row-ride')).toHaveTextContent(/8개역/);
  });

  it('renders empty state when route is null', () => {
    const { getByText } = render(
      <SegmentBreakdownSection
        route={null}
        origin={mockOrigin}
        destination={mockDestination}
      />,
    );
    expect(getByText('경로 정보 없음')).toBeTruthy();
  });

  it('shows 0분 when walkToStation duration is 0', () => {
    const route = { ...mockRoute, walkToStation: { durationMin: 0 } };
    const { getByTestId } = render(
      <SegmentBreakdownSection
        route={route}
        origin={mockOrigin}
        destination={mockDestination}
      />,
    );
    expect(getByTestId('segment-row-walk-origin')).toHaveTextContent(/0분/);
  });
});
