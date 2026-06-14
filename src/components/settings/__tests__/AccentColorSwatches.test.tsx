/**
 * AccentColorSwatches 테스트 — 강조 색상 8종 스와치 그리드.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import AccentColorSwatches from '../AccentColorSwatches';
import { ACCENT_COLORS } from '@/services/theme';

// Proxy stubs every lucide icon name → its own string component.
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target: object, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (typeof prop !== 'string') return undefined;
        return prop;
      },
    },
  ),
);

jest.mock('@/services/theme', () => {
  const actual = jest.requireActual('@/services/theme');
  return {
    ...actual,
    useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
    useTheme: jest.fn(() => ({ isDark: false })),
  };
});

describe('AccentColorSwatches', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all eight accent swatches', () => {
    const { getByTestId } = render(
      <AccentColorSwatches selectedId="blue" onSelect={mockOnSelect} />,
    );

    ACCENT_COLORS.forEach((option) => {
      expect(getByTestId(`accent-${option.id}`).props.accessibilityRole).toBe(
        'button',
      );
    });
  });

  it('marks only the selected swatch as selected', () => {
    const { getByTestId } = render(
      <AccentColorSwatches selectedId="pink" onSelect={mockOnSelect} />,
    );

    expect(getByTestId('accent-pink').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getByTestId('accent-blue').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('calls onSelect with the tapped accent id', () => {
    const { getByTestId } = render(
      <AccentColorSwatches selectedId="blue" onSelect={mockOnSelect} />,
    );

    fireEvent.press(getByTestId('accent-orange'));

    expect(mockOnSelect).toHaveBeenCalledWith('orange');
  });

  it('labels each swatch with its Korean color name', () => {
    const { getByTestId } = render(
      <AccentColorSwatches selectedId="blue" onSelect={mockOnSelect} />,
    );

    expect(getByTestId('accent-teal').props.accessibilityLabel).toBe(
      '강조 색상 틸',
    );
  });
});
