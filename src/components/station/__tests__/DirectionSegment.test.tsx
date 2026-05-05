/**
 * DirectionSegment Tests — Wanted Design System segmented control.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DirectionSegment } from '../DirectionSegment';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('DirectionSegment', () => {
  it('renders both direction labels', () => {
    const { getByText } = render(
      <DirectionSegment
        value="up"
        upLabel="상행 (서울대입구)"
        downLabel="하행 (잠실)"
        onChange={jest.fn()}
        testID="dir-seg"
      />
    );
    expect(getByText('상행 (서울대입구)')).toBeTruthy();
    expect(getByText('하행 (잠실)')).toBeTruthy();
  });

  it('marks active option via accessibilityState.selected', () => {
    const { getByTestId } = render(
      <DirectionSegment
        value="down"
        upLabel="상행"
        downLabel="하행"
        onChange={jest.fn()}
        testID="dir-seg"
      />
    );
    const upBtn = getByTestId('dir-seg-up');
    const downBtn = getByTestId('dir-seg-down');
    expect(upBtn.props.accessibilityState.selected).toBe(false);
    expect(downBtn.props.accessibilityState.selected).toBe(true);
  });

  it('calls onChange with the opposite value when an inactive option is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <DirectionSegment
        value="up"
        upLabel="상행"
        downLabel="하행"
        onChange={onChange}
        testID="dir-seg"
      />
    );
    fireEvent.press(getByTestId('dir-seg-down'));
    expect(onChange).toHaveBeenCalledWith('down');
  });

  it('does not call onChange when the already-active option is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <DirectionSegment
        value="up"
        upLabel="상행"
        downLabel="하행"
        onChange={onChange}
        testID="dir-seg"
      />
    );
    fireEvent.press(getByTestId('dir-seg-up'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
