import React from 'react';
import { render } from '@testing-library/react-native';
import { SettingSlider } from '../SettingSlider';

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: 'slider', ...props }),
  };
});

describe('SettingSlider', () => {
  const defaultProps = {
    label: '알림 시간',
    value: 5,
    minValue: 1,
    maxValue: 30,
    step: 1,
    unit: '분',
    onValueChange: jest.fn(),
  };

  it('renders label text', () => {
    const { getByText } = render(<SettingSlider {...defaultProps} />);
    expect(getByText('알림 시간')).toBeTruthy();
  });

  it('renders current value with unit', () => {
    const { getByText } = render(<SettingSlider {...defaultProps} />);
    expect(getByText('5분')).toBeTruthy();
  });

  it('renders min and max range labels', () => {
    const { getByText } = render(<SettingSlider {...defaultProps} />);
    expect(getByText('1분')).toBeTruthy();
    expect(getByText('30분')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <SettingSlider {...defaultProps} subtitle="도착 전 알림 시간" />,
    );
    expect(getByText('도착 전 알림 시간')).toBeTruthy();
  });

  it('renders slider element', () => {
    const { getByTestId } = render(<SettingSlider {...defaultProps} />);
    expect(getByTestId('slider')).toBeTruthy();
  });
});
