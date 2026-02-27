/**
 * CurrentStationAlertCard Component Tests
 */

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: 'slider', ...props }),
  };
});

jest.mock('@utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(() => '#00A84D'),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CurrentStationAlertCard } from '../CurrentStationAlertCard';

const defaultProps = {
  enabled: true,
  stations: [
    { id: 'st1', name: '강남', lineId: '2' },
    { id: 'st2', name: '시청', lineId: '1' },
  ],
  radius: 200,
  cooldownMinutes: 30,
  onEnabledChange: jest.fn(),
  onAddStation: jest.fn(),
  onRemoveStation: jest.fn(),
  onRadiusChange: jest.fn(),
  onCooldownChange: jest.fn(),
};

describe('CurrentStationAlertCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header and switch', () => {
    const { getByText } = render(<CurrentStationAlertCard {...defaultProps} />);
    expect(getByText('현재 역 알림')).toBeTruthy();
    expect(getByText('설정한 역 근처에 도착하면 알림을 받습니다')).toBeTruthy();
  });

  it('shows station list when enabled', () => {
    const { getByText } = render(<CurrentStationAlertCard {...defaultProps} />);
    expect(getByText('강남')).toBeTruthy();
    expect(getByText('시청')).toBeTruthy();
    expect(getByText('2개')).toBeTruthy();
  });

  it('hides details when disabled', () => {
    const { queryByText } = render(
      <CurrentStationAlertCard {...defaultProps} enabled={false} />
    );
    expect(queryByText('알림받을 역')).toBeNull();
    expect(queryByText('+ 역 추가')).toBeNull();
  });

  it('shows empty state when no stations', () => {
    const { getByText } = render(
      <CurrentStationAlertCard {...defaultProps} stations={[]} />
    );
    expect(getByText('알림받을 역을 추가해주세요')).toBeTruthy();
  });

  it('calls onAddStation when add button pressed', () => {
    const { getByText } = render(<CurrentStationAlertCard {...defaultProps} />);
    fireEvent.press(getByText('+ 역 추가'));
    expect(defaultProps.onAddStation).toHaveBeenCalled();
  });

  it('renders radius and cooldown settings', () => {
    const { getByText, getAllByText } = render(<CurrentStationAlertCard {...defaultProps} />);
    expect(getByText('감지 반경')).toBeTruthy();
    expect(getByText('200m')).toBeTruthy();
    expect(getByText('재알림 방지')).toBeTruthy();
    // "30분" appears both as the current value and in cooldown option buttons
    expect(getAllByText('30분').length).toBeGreaterThanOrEqual(1);
  });
});
