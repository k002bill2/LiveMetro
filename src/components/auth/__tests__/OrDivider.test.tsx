/**
 * OrDivider Tests — Wanted Design System "간편 로그인" divider.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { OrDivider } from '../OrDivider';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('OrDivider', () => {
  it('uses the default label "또는" when none is provided', () => {
    const { getByText } = render(<OrDivider />);
    expect(getByText('또는')).toBeTruthy();
  });

  it('renders a custom label', () => {
    const { getByText } = render(<OrDivider label="간편 로그인" />);
    expect(getByText('간편 로그인')).toBeTruthy();
  });

  it('renders two divider lines flanking the label', () => {
    const { getAllByTestId } = render(<OrDivider label="x" testID="div" />);
    expect(getAllByTestId(/^div-line-/).length).toBe(2);
  });
});
