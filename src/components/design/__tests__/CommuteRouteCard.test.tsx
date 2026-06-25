/**
 * CommuteRouteCard tests — HomeScreen "오늘의 출근 경로" timeline card.
 *
 * Covers:
 *  1. Required-fields gating (origin + destination both required)
 *  2. Optional times / lineId render through to the timeline labels
 *  3. Edit link presence is gated on `onPressEdit` and is interactive
 *  4. Fact grid hides when all three facts are absent
 *  5. Fact grid renders when at least one fact is supplied
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CommuteRouteCard } from '../CommuteRouteCard';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

describe('CommuteRouteCard', () => {
  it('returns null when origin is missing', () => {
    const { queryByTestId } = render(
      <CommuteRouteCard destination="강남" testID="cr-card" />,
    );
    expect(queryByTestId('cr-card')).toBeNull();
  });

  it('returns null when destination is missing', () => {
    const { queryByTestId } = render(
      <CommuteRouteCard origin="홍대입구" testID="cr-card" />,
    );
    expect(queryByTestId('cr-card')).toBeNull();
  });

  it('renders origin/destination + times when both endpoints are present', () => {
    const { getByText, getByTestId } = render(
      <CommuteRouteCard
        origin="홍대입구"
        destination="강남"
        departureTime="08:32"
        arrivalTime="09:00"
        testID="cr-card"
      />,
    );
    expect(getByTestId('cr-card')).toBeTruthy();
    expect(getByText('홍대입구')).toBeTruthy();
    expect(getByText('강남')).toBeTruthy();
    expect(getByText('08:32')).toBeTruthy();
    expect(getByText('09:00')).toBeTruthy();
    expect(getByText('오늘의 출근 경로')).toBeTruthy();
  });

  it('renders "직행 N분" only for an affirmative direct route (transferCount === 0)', () => {
    const { getByText } = render(
      <CommuteRouteCard
        origin="홍대입구"
        destination="강남"
        lineId="2"
        rideMinutes={18}
        transferCount={0}
      />,
    );
    expect(getByText('2호선')).toBeTruthy();
    expect(getByText('직행 18분')).toBeTruthy();
  });

  it('does not claim "직행" when transferCount is unknown (route unresolved), even with rideMinutes', () => {
    // Graph search failed but an ML door-to-door estimate exists → the card
    // receives rideMinutes but no transferCount. Asserting "직행" here is a
    // false claim about a route we could not resolve.
    const { queryByText } = render(
      <CommuteRouteCard
        origin="신길"
        destination="선릉"
        lineId="1"
        rideMinutes={36}
        // transferCount intentionally omitted (unknown).
      />,
    );
    expect(queryByText('직행 36분')).toBeNull();
    expect(queryByText(/환승/)).toBeNull();
  });

  it('shows "환승 N회" (not "직행") in the mid-node when transferCount > 0', () => {
    const { getByText, queryByText } = render(
      <CommuteRouteCard
        origin="신길"
        destination="선릉"
        lineId="1"
        rideMinutes={36}
        transferCount={2}
        stationCount={13}
      />,
    );
    // Mid-node meta must be honest about transfers, not a fictional "직행".
    expect(getByText('환승 2회')).toBeTruthy();
    expect(queryByText('직행 36분')).toBeNull();
    // First boarded line still rendered.
    expect(getByText('1호선')).toBeTruthy();
  });

  it('shows the edit link only when onPressEdit is provided and fires the handler', () => {
    const onPressEdit = jest.fn();
    const { getByTestId, queryByText, rerender } = render(
      <CommuteRouteCard origin="홍대입구" destination="강남" />,
    );
    // No handler → no edit link
    expect(queryByText('경로 변경')).toBeNull();

    rerender(
      <CommuteRouteCard
        origin="홍대입구"
        destination="강남"
        onPressEdit={onPressEdit}
      />,
    );
    fireEvent.press(getByTestId('commute-route-card-edit'));
    expect(onPressEdit).toHaveBeenCalledTimes(1);
  });

  it('hides the fact grid when transferCount/stationCount/fareKrw are all undefined', () => {
    const { queryByText } = render(
      <CommuteRouteCard origin="홍대입구" destination="강남" />,
    );
    // None of the fact labels should appear
    expect(queryByText('환승')).toBeNull();
    expect(queryByText('이동')).toBeNull();
    expect(queryByText('요금')).toBeNull();
  });

  it('renders the fact grid when at least one fact is supplied', () => {
    const { getByText, getAllByText } = render(
      <CommuteRouteCard
        origin="홍대입구"
        destination="강남"
        transferCount={0}
        stationCount={8}
        fareKrw={1450}
      />,
    );
    expect(getByText('0회')).toBeTruthy();
    // "8개역" appears in both the ride-leg sub-label (when directionLabel
    // is absent) and the fact grid value cell — assert at least one render.
    expect(getAllByText('8개역').length).toBeGreaterThanOrEqual(1);
    // The fare cell renders "1,450" + nested "원" via React fragment, so the
    // outer Text's content is "1,450원". Match via regex to span both nodes.
    expect(getByText(/1,450/)).toBeTruthy();
    expect(getByText('원')).toBeTruthy();
    expect(getByText('환승')).toBeTruthy();
    expect(getByText('이동')).toBeTruthy();
    expect(getByText('요금')).toBeTruthy();
  });

  it('hides the 길안내 시작 CTA when onStartGuidance is not provided', () => {
    const { queryByTestId } = render(
      <CommuteRouteCard origin="홍대입구" destination="강남" />,
    );
    expect(queryByTestId('commute-route-card-start')).toBeNull();
  });

  it('shows the 길안내 시작 CTA and fires onStartGuidance when tapped', () => {
    const onStartGuidance = jest.fn();
    const { getByTestId } = render(
      <CommuteRouteCard
        origin="홍대입구"
        destination="강남"
        onStartGuidance={onStartGuidance}
      />,
    );
    fireEvent.press(getByTestId('commute-route-card-start'));
    expect(onStartGuidance).toHaveBeenCalledTimes(1);
  });
});
