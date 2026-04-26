/**
 * LiveClock Tests
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { LiveClock } from '../LiveClock';

describe('LiveClock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T09:30:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the current time on mount with default ko-KR HH:mm format', () => {
    const { getByText } = render(<LiveClock />);
    // 09:30 in ko-KR HH:mm 24h
    expect(getByText('09:30')).toBeTruthy();
  });

  it('updates after the configured interval', () => {
    const { getByText, queryByText } = render(<LiveClock intervalMs={1000} />);

    expect(getByText('09:30')).toBeTruthy();

    act(() => {
      jest.setSystemTime(new Date('2026-04-26T09:31:00'));
      jest.advanceTimersByTime(1000);
    });

    expect(getByText('09:31')).toBeTruthy();
    expect(queryByText('09:30')).toBeNull();
  });

  it('uses a custom formatter when provided', () => {
    const format = (d: Date): string => `T=${d.getHours()}`;
    const { getByText } = render(<LiveClock format={format} />);
    expect(getByText('T=9')).toBeTruthy();
  });

  it('clears its interval on unmount', () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = render(<LiveClock intervalMs={5000} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
