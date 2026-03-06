import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlertBanner } from '../AlertBanner';
import type { SubwayAlert } from '@/models/publicData';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFFFFF',
      error: '#FF3B30',
      warning: '#FF9500',
      info: '#007AFF',
      primary: '#007AFF',
    },
  }),
}));

const makeAlert = (overrides: Partial<SubwayAlert> = {}): SubwayAlert => ({
  alertId: 'alert-1',
  title: '2호선 지연',
  content: '신호 장애로 인한 지연',
  alertType: 'delay',
  lineName: '2호선',
  isActive: true,
  startTime: new Date(),
  endTime: null,
  affectedStations: [],
  ...overrides,
});

describe('AlertBanner', () => {
  it('renders nothing when alerts array is empty', () => {
    const { toJSON } = render(<AlertBanner alerts={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when all alerts are inactive', () => {
    const { toJSON } = render(
      <AlertBanner alerts={[makeAlert({ isActive: false })]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders alert title', () => {
    const { getByText } = render(
      <AlertBanner alerts={[makeAlert()]} />,
    );
    expect(getByText(/2호선 지연/)).toBeTruthy();
  });

  it('renders line name prefix', () => {
    const { getByText } = render(
      <AlertBanner alerts={[makeAlert()]} />,
    );
    expect(getByText(/\[2호선\]/)).toBeTruthy();
  });

  it('shows badge count when multiple active alerts', () => {
    const alerts = [
      makeAlert({ alertId: '1' }),
      makeAlert({ alertId: '2', title: '3호선 점검' }),
    ];
    const { getByText } = render(<AlertBanner alerts={alerts} />);
    expect(getByText('+1')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button pressed', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <AlertBanner alerts={[makeAlert()]} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByText('✕'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('hides banner after dismiss', () => {
    const { getByText, toJSON } = render(
      <AlertBanner alerts={[makeAlert()]} />,
    );
    fireEvent.press(getByText('✕'));
    expect(toJSON()).toBeNull();
  });

  it('shows content when expanded', () => {
    const { getByText } = render(
      <AlertBanner alerts={[makeAlert()]} />,
    );
    // Press the main content to expand
    fireEvent.press(getByText(/2호선 지연/));
    expect(getByText('신호 장애로 인한 지연')).toBeTruthy();
  });

  it('sorts alerts by priority (accident first)', () => {
    const alerts = [
      makeAlert({ alertId: '1', alertType: 'delay', title: '지연' }),
      makeAlert({ alertId: '2', alertType: 'accident', title: '사고' }),
    ];
    const { getByText } = render(<AlertBanner alerts={alerts} />);
    // accident has priority 1, should be displayed first
    expect(getByText(/사고/)).toBeTruthy();
  });

  it('applies testID prop', () => {
    const { getByTestId } = render(
      <AlertBanner alerts={[makeAlert()]} testID="alert-banner" />,
    );
    expect(getByTestId('alert-banner')).toBeTruthy();
  });
});
