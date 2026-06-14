// Jest mock calls MUST come before imports (hoisting)
import React from 'react';
import { render } from '@testing-library/react-native';
import { VibrationPatternGlyph } from '../VibrationPatternGlyph';
import { VibrationPatternId } from '@/models/user';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

describe('VibrationPatternGlyph', () => {
  const allPatterns: VibrationPatternId[] = [
    'default',
    'short',
    'long',
    'double',
    'triple',
    'none',
  ];

  it.each(allPatterns)('renders for the "%s" pattern', (patternId) => {
    const { toJSON } = render(<VibrationPatternGlyph patternId={patternId} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders 1 bar for "default"', () => {
    const { getAllByTestId } = render(<VibrationPatternGlyph patternId="default" />);
    expect(getAllByTestId('vib-bar', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('renders 1 bar for "short"', () => {
    const { getAllByTestId } = render(<VibrationPatternGlyph patternId="short" />);
    expect(getAllByTestId('vib-bar', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('renders 1 bar for "long"', () => {
    const { getAllByTestId } = render(<VibrationPatternGlyph patternId="long" />);
    expect(getAllByTestId('vib-bar', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('renders 2 bars for "double"', () => {
    const { getAllByTestId } = render(<VibrationPatternGlyph patternId="double" />);
    expect(getAllByTestId('vib-bar', { includeHiddenElements: true })).toHaveLength(2);
  });

  it('renders 3 bars for "triple"', () => {
    const { getAllByTestId } = render(<VibrationPatternGlyph patternId="triple" />);
    expect(getAllByTestId('vib-bar', { includeHiddenElements: true })).toHaveLength(3);
  });

  it('renders 1 bar (dot) for "none"', () => {
    const { getAllByTestId } = render(<VibrationPatternGlyph patternId="none" />);
    expect(getAllByTestId('vib-bar', { includeHiddenElements: true })).toHaveLength(1);
  });
});
