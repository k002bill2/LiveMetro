/**
 * DirectionToggle 테스트 — 방면 세그먼트 컨트롤 (시안 #2)
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DirectionToggle } from '../DirectionToggle';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('DirectionToggle', () => {
  const options = ['역삼 방면', '교대 방면'];

  it('renders both direction options', () => {
    const { getByText } = render(
      <DirectionToggle options={options} value="역삼 방면" onChange={jest.fn()} />,
    );
    expect(getByText('역삼 방면')).toBeTruthy();
    expect(getByText('교대 방면')).toBeTruthy();
  });

  it('marks the current value as selected', () => {
    const { getByTestId } = render(
      <DirectionToggle options={options} value="역삼 방면" onChange={jest.fn()} />,
    );
    expect(getByTestId('direction-option-역삼 방면').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('direction-option-교대 방면').props.accessibilityState.selected).toBe(false);
  });

  it('calls onChange with the pressed option', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <DirectionToggle options={options} value="역삼 방면" onChange={onChange} />,
    );
    fireEvent.press(getByTestId('direction-option-교대 방면'));
    expect(onChange).toHaveBeenCalledWith('교대 방면');
  });

  it('renders nothing when options are empty', () => {
    const { queryByTestId } = render(
      <DirectionToggle options={[]} value={null} onChange={jest.fn()} />,
    );
    expect(queryByTestId('direction-toggle')).toBeNull();
  });

  it('renders a single option for terminus stations', () => {
    const { getByTestId, queryByTestId } = render(
      <DirectionToggle options={['김포공항 방면']} value={null} onChange={jest.fn()} />,
    );
    expect(getByTestId('direction-option-김포공항 방면')).toBeTruthy();
    expect(queryByTestId('direction-option-교대 방면')).toBeNull();
  });
});
