/**
 * SectionHeader Tests — Wanted Design System section divider/title.
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SectionHeader } from '../SectionHeader';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('SectionHeader', () => {
  it('renders the title', () => {
    const { getByText } = render(<SectionHeader title="즐겨찾는 역" />);
    expect(getByText('즐겨찾는 역')).toBeTruthy();
  });

  it('renders the optional subtitle', () => {
    const { getByText } = render(<SectionHeader title="즐겨찾는 역" subtitle="실시간 도착" />);
    expect(getByText('실시간 도착')).toBeTruthy();
  });

  it('omits the subtitle node when subtitle prop is missing', () => {
    const { queryByTestId } = render(<SectionHeader title="x" testID="sec" />);
    expect(queryByTestId('sec-subtitle')).toBeNull();
  });

  it('renders the action slot when provided', () => {
    const { getByText } = render(
      <SectionHeader title="x" action={<Text>전체 보기</Text>} />
    );
    expect(getByText('전체 보기')).toBeTruthy();
  });
});
