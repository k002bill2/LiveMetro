/**
 * Phase 2 design components — hero card, top bar, quick actions.
 *
 * These are presentational, so the tests pin down: data → label mapping,
 * accessibility labels, and structural rendering.
 */
import React from 'react';
import { Search, Map, Megaphone, FileText } from 'lucide-react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MLHeroCard } from '../MLHeroCard';
import { HomeTopBar } from '../HomeTopBar';
import { QuickActionsGrid } from '../QuickActionsGrid';
import { ThemeProvider } from '@/services/theme';

// expo-linear-gradient → simple View in tests
jest.mock('expo-linear-gradient', () => {
  const ReactRef = require('react');
  const { View } = require('react-native');
  const MockGradient = (props: { children?: unknown; style?: unknown; testID?: string }) =>
    ReactRef.createElement(View, props, props.children as React.ReactNode);
  return { LinearGradient: MockGradient };
});

const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);

describe('MLHeroCard', () => {
  it('renders predicted minutes and route line', () => {
    const { getByText } = wrap(
      <MLHeroCard origin="홍대입구" destination="강남" predictedMinutes={28} />,
    );
    expect(getByText('28')).toBeTruthy();
    expect(getByText('홍대입구 → 강남')).toBeTruthy();
  });

  it('shows -3분 trend pill when delta is negative', () => {
    const { getByText } = wrap(<MLHeroCard predictedMinutes={28} deltaMinutes={-3} />);
    expect(getByText('평소보다 -3분')).toBeTruthy();
  });

  it('shows +2분 trend pill when delta is positive', () => {
    const { getByText } = wrap(<MLHeroCard predictedMinutes={32} deltaMinutes={2} />);
    expect(getByText('평소보다 +2분')).toBeTruthy();
  });

  it('omits trend pill when delta is undefined', () => {
    const { queryByText } = wrap(<MLHeroCard predictedMinutes={28} />);
    expect(queryByText(/평소/)).toBeNull();
  });

  it('renders confidence subtext when confidence is provided', () => {
    const { getByText } = wrap(
      <MLHeroCard predictedMinutes={28} confidence={0.87} arrivalTime="9:00" />,
    );
    expect(getByText('지금 출발하면 9:00 도착 · 신뢰도 87%')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = wrap(<MLHeroCard predictedMinutes={28} onPress={onPress} />);
    fireEvent.press(getByTestId('ml-hero-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('HomeTopBar', () => {
  it('renders greeting with user name', () => {
    const { getByText } = wrap(<HomeTopBar userName="지수" dateTime="오전 8:32" />);
    expect(getByText('안녕하세요, 지수님')).toBeTruthy();
    expect(getByText('오전 8:32')).toBeTruthy();
  });

  it('falls back to anonymous greeting when no name', () => {
    const { getByText } = wrap(<HomeTopBar />);
    expect(getByText('안녕하세요')).toBeTruthy();
  });

  it('shows unread dot when hasUnread is true', () => {
    const { getByTestId } = wrap(<HomeTopBar hasUnread />);
    expect(getByTestId('home-top-bar-unread-dot')).toBeTruthy();
  });

  it('hides unread dot by default', () => {
    const { queryByTestId } = wrap(<HomeTopBar />);
    expect(queryByTestId('home-top-bar-unread-dot')).toBeNull();
  });

  it('fires onBellPress when bell tapped', () => {
    const onBellPress = jest.fn();
    const { getByTestId } = wrap(<HomeTopBar onBellPress={onBellPress} />);
    fireEvent.press(getByTestId('home-top-bar-bell'));
    expect(onBellPress).toHaveBeenCalledTimes(1);
  });
});

describe('QuickActionsGrid', () => {
  const actions = [
    { id: 'route',  Icon: Search,    label: '경로검색' },
    { id: 'map',    Icon: Map,       label: '노선도' },
    { id: 'report', Icon: Megaphone, label: '제보' },
    { id: 'cert',   Icon: FileText,  label: '증명서' },
  ];

  it('renders all 4 action labels', () => {
    const { getByText } = wrap(<QuickActionsGrid actions={actions} />);
    expect(getByText('경로검색')).toBeTruthy();
    expect(getByText('노선도')).toBeTruthy();
    expect(getByText('제보')).toBeTruthy();
    expect(getByText('증명서')).toBeTruthy();
  });

  it('fires onPress for the tapped action only', () => {
    const handlers = actions.map(() => jest.fn());
    const wired = actions.map((a, i) => ({ ...a, onPress: handlers[i] }));
    const { getByTestId } = wrap(<QuickActionsGrid actions={wired} />);
    fireEvent.press(getByTestId('quick-action-map'));
    expect(handlers[1]).toHaveBeenCalledTimes(1);
    expect(handlers[0]).not.toHaveBeenCalled();
    expect(handlers[2]).not.toHaveBeenCalled();
  });
});
