/**
 * ThemeModePreviewCard Test Suite
 * 미니 앱 미리보기 카드 — 모드별 렌더링 / 선택 상태 / 탭 동작
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ThemeModePreviewCard from '../ThemeModePreviewCard';

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

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

describe('ThemeModePreviewCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the mode title', () => {
    const { getByText } = render(
      <ThemeModePreviewCard mode="light" title="라이트" selected={false} onPress={jest.fn()} />,
    );

    expect(getByText('라이트')).toHaveTextContent('라이트');
  });

  it('exposes selected state via accessibilityState', () => {
    const { getByTestId } = render(
      <ThemeModePreviewCard mode="dark" title="다크" selected onPress={jest.fn()} />,
    );

    expect(getByTestId('theme-mode-dark').props.accessibilityState).toEqual({ selected: true });
  });

  it('exposes unselected state via accessibilityState', () => {
    const { getByTestId } = render(
      <ThemeModePreviewCard mode="light" title="라이트" selected={false} onPress={jest.fn()} />,
    );

    expect(getByTestId('theme-mode-light').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeModePreviewCard mode="system" title="시스템" selected={false} onPress={onPress} />,
    );

    fireEvent.press(getByTestId('theme-mode-system'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the split preview for system mode (two clipped halves)', () => {
    const { getAllByText } = render(
      <ThemeModePreviewCard mode="system" title="시스템" selected={false} onPress={jest.fn()} />,
    );

    // 시스템 카드는 라이트/다크 미니 UI를 각각 한 번씩 렌더 → 9:41 상태바 2개
    expect(getAllByText('9:41')).toHaveLength(2);
  });

  it('renders a single preview for light mode', () => {
    const { getAllByText } = render(
      <ThemeModePreviewCard mode="light" title="라이트" selected={false} onPress={jest.fn()} />,
    );

    expect(getAllByText('9:41')).toHaveLength(1);
  });
});
