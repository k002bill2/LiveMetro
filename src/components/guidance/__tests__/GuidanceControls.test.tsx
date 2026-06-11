import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GuidanceControls } from '../GuidanceControls';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Square: 'Square',
}));

describe('GuidanceControls', () => {
  it('fires onNext with the contextual label', () => {
    const onNext = jest.fn();
    const { getByTestId, getByText } = render(
      <GuidanceControls
        nextLabel="탑승했어요"
        prevDisabled={false}
        onPrev={jest.fn()}
        onNext={onNext}
        onExit={jest.fn()}
      />
    );
    expect(getByText('탑승했어요')).toBeTruthy();
    fireEvent.press(getByTestId('guidance-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('fires onPrev when enabled and blocks it when disabled', () => {
    const onPrev = jest.fn();
    const enabled = render(
      <GuidanceControls
        nextLabel="다음"
        prevDisabled={false}
        onPrev={onPrev}
        onNext={jest.fn()}
        onExit={jest.fn()}
      />
    );
    fireEvent.press(enabled.getByTestId('guidance-prev'));
    expect(onPrev).toHaveBeenCalledTimes(1);

    const blocked = jest.fn();
    const disabled = render(
      <GuidanceControls
        nextLabel="다음"
        prevDisabled
        onPrev={blocked}
        onNext={jest.fn()}
        onExit={jest.fn()}
      />
    );
    fireEvent.press(disabled.getByTestId('guidance-prev'));
    expect(blocked).not.toHaveBeenCalled();
  });

  it('hides the correction pair at journey end (nextLabel null)', () => {
    const { queryByTestId, getByTestId } = render(
      <GuidanceControls
        nextLabel={null}
        prevDisabled
        onPrev={jest.fn()}
        onNext={jest.fn()}
        onExit={jest.fn()}
      />
    );
    expect(queryByTestId('guidance-next')).toBeNull();
    expect(queryByTestId('guidance-prev')).toBeNull();
    expect(getByTestId('guidance-exit')).toBeTruthy();
  });

  it('fires onExit', () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <GuidanceControls
        nextLabel="다음"
        prevDisabled={false}
        onPrev={jest.fn()}
        onNext={jest.fn()}
        onExit={onExit}
      />
    );
    fireEvent.press(getByTestId('guidance-exit'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
