/**
 * VolumeSlider test — single-row volume control.
 * Verifies render, onValueChange wiring, and the disabled prop.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import VolumeSlider from '../VolumeSlider';

// Slider mock: a host View carrying testID + all forwarded props so the test
// can read `disabled` and trigger `onValueChange`.
jest.mock('@react-native-community/slider', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactLocal.createElement(View, { testID: 'volume-slider', ...props }),
  };
});

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light,
  ),
}));

describe('VolumeSlider', () => {
  it('renders the slider', () => {
    const { getByTestId } = render(
      <VolumeSlider value={50} onValueChange={jest.fn()} />,
    );
    expect(getByTestId('volume-slider')).toBeTruthy();
  });

  it('forwards changes through onValueChange', () => {
    const onValueChange = jest.fn();
    const { getByTestId } = render(
      <VolumeSlider value={50} onValueChange={onValueChange} />,
    );
    fireEvent(getByTestId('volume-slider'), 'onValueChange', 80);
    expect(onValueChange).toHaveBeenCalledWith(80);
  });

  it('disables the slider when disabled', () => {
    const { getByTestId } = render(
      <VolumeSlider value={50} onValueChange={jest.fn()} disabled />,
    );
    expect(getByTestId('volume-slider').props.disabled).toBe(true);
  });

  it('enables the slider by default', () => {
    const { getByTestId } = render(
      <VolumeSlider value={50} onValueChange={jest.fn()} />,
    );
    expect(getByTestId('volume-slider').props.disabled).toBe(false);
  });
});
