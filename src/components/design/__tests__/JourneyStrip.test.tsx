import React from 'react';
import { render } from '@testing-library/react-native';
import { JourneyStrip } from '../JourneyStrip';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowRight: () => null,
  Footprints: () => null,
}));

jest.mock('../LineBadge', () => ({
  getLineShortLabel: (line: string) => line,
}));

describe('JourneyStrip', () => {
  it('truncates a float train-leg minute for display (36.4 → 36분)', () => {
    const { getByText } = render(
      <JourneyStrip legs={[{ type: 'train', lineId: '2', minutes: 36.4 }]} />
    );
    expect(getByText('36분')).toBeTruthy();
  });

  it('truncates a float walk-leg minute for display (7.8 → 7)', () => {
    const { getByText } = render(
      <JourneyStrip legs={[{ type: 'walk', minutes: 7.8 }]} />
    );
    expect(getByText('7')).toBeTruthy();
  });
});
