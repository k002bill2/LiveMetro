jest.mock('lucide-react-native', () => ({
  Clock: 'Clock',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: { error: '#FF3B30' },
  }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { DelayBadge } from '../DelayBadge';

describe('DelayBadge', () => {
  it('renders nothing when delayMinutes is 0', () => {
    const { toJSON } = render(<DelayBadge delayMinutes={0} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when delayMinutes is negative', () => {
    const { toJSON } = render(<DelayBadge delayMinutes={-1} />);
    expect(toJSON()).toBeNull();
  });

  it('renders delay text for positive minutes', () => {
    const { getByText } = render(<DelayBadge delayMinutes={5} />);
    expect(getByText('+5분')).toBeTruthy();
  });

  it('renders with small size', () => {
    const { getByText } = render(<DelayBadge delayMinutes={3} size="small" />);
    expect(getByText('+3분')).toBeTruthy();
  });

  it('renders with large size', () => {
    const { getByText } = render(<DelayBadge delayMinutes={10} size="large" />);
    expect(getByText('+10분')).toBeTruthy();
  });

  it('renders with default medium size', () => {
    const { getByText } = render(<DelayBadge delayMinutes={7} />);
    expect(getByText('+7분')).toBeTruthy();
  });
});
