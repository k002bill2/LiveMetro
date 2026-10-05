import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ScreenTitle } from '../ScreenTitle';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

jest.mock('@/services/theme/useSemanticTokens', () => ({
  useSemanticTokens: () => ({ labelStrong: '#111111' }),
}));

describe('ScreenTitle', () => {
  it('renders the given text as an accessibility header', () => {
    render(<ScreenTitle testID="title">즐겨찾기</ScreenTitle>);

    const title = screen.getByTestId('title');
    expect(title).toHaveTextContent('즐겨찾기');
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('applies the heading1 type scale with the 800 Pretendard face', () => {
    render(<ScreenTitle testID="title">설정</ScreenTitle>);

    const style = StyleSheet.flatten(screen.getByTestId('title').props.style);
    expect(style.fontSize).toBe(WANTED_TOKENS.type.heading1.size);
    expect(style.lineHeight).toBe(WANTED_TOKENS.type.heading1.lh);
    expect(style.fontFamily).toBe(weightToFontFamily('800'));
  });

  it('uses the labelStrong semantic color', () => {
    render(<ScreenTitle testID="title">경로 검색</ScreenTitle>);

    const style = StyleSheet.flatten(screen.getByTestId('title').props.style);
    expect(style.color).toBe('#111111');
  });

  it('lets the caller add layout styles without dropping the type scale', () => {
    render(
      <ScreenTitle testID="title" style={{ marginBottom: 16 }}>
        실시간 제보
      </ScreenTitle>
    );

    const style = StyleSheet.flatten(screen.getByTestId('title').props.style);
    expect(style.marginBottom).toBe(16);
    expect(style.fontSize).toBe(WANTED_TOKENS.type.heading1.size);
  });

  it('renders an empty title without crashing', () => {
    render(<ScreenTitle testID="title">{''}</ScreenTitle>);

    expect(screen.getByTestId('title')).toHaveTextContent('');
  });
});
