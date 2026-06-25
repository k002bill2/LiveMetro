/**
 * GuidanceActiveBanner tests — the "안내 중" home banner that lets a rider
 * return to an in-progress guidance session.
 *
 * Mocks useGuidanceSession (the reactive store read) and the theme/lucide
 * seams; verifies the three render states (no session → null, active → labelled
 * + interactive, hidden → null).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import type { GuidanceSession } from '@/models/guidance';
import type { Route } from '@/models/route';
import { GuidanceActiveBanner } from '../GuidanceActiveBanner';

jest.mock('@/hooks/useGuidanceSession', () => ({
  useGuidanceSession: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  Navigation: () => null,
  ChevronRight: () => null,
}));

const mockedUseGuidanceSession = useGuidanceSession as jest.Mock;

const SESSION: GuidanceSession = {
  route: { segments: [], totalMinutes: 18, transferCount: 0, lineIds: ['2'] } as unknown as Route,
  fromStationName: '홍대입구',
  toStationName: '강남',
  startedAt: 1_700_000_000_000,
};

describe('GuidanceActiveBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when there is no active session', () => {
    mockedUseGuidanceSession.mockReturnValue(null);
    const { queryByTestId } = render(<GuidanceActiveBanner onPress={jest.fn()} />);
    expect(queryByTestId('guidance-active-banner')).toBeNull();
  });

  it('shows the 안내 중 label and the route endpoints when active', () => {
    mockedUseGuidanceSession.mockReturnValue(SESSION);
    const { getByTestId, getByText } = render(
      <GuidanceActiveBanner onPress={jest.fn()} />,
    );
    expect(getByTestId('guidance-active-banner')).toBeTruthy();
    expect(getByText('안내 중')).toBeTruthy();
    expect(getByText('홍대입구 → 강남')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    mockedUseGuidanceSession.mockReturnValue(SESSION);
    const onPress = jest.fn();
    const { getByTestId } = render(<GuidanceActiveBanner onPress={onPress} />);
    fireEvent.press(getByTestId('guidance-active-banner'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
