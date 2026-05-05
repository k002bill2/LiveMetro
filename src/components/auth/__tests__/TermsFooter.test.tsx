/**
 * TermsFooter Tests — Wanted Design System bottom-of-login micro-copy.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TermsFooter } from '../TermsFooter';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('TermsFooter', () => {
  it('renders the lead-in copy', () => {
    const { getByText } = render(<TermsFooter onTermsPress={jest.fn()} onPrivacyPress={jest.fn()} />);
    expect(getByText(/계속 진행하면/)).toBeTruthy();
  });

  it('renders both link affordances', () => {
    const { getByTestId } = render(
      <TermsFooter onTermsPress={jest.fn()} onPrivacyPress={jest.fn()} testID="terms" />
    );
    expect(getByTestId('terms-tos')).toBeTruthy();
    expect(getByTestId('terms-privacy')).toBeTruthy();
  });

  it('invokes the right handler when each link is pressed', () => {
    const onTermsPress = jest.fn();
    const onPrivacyPress = jest.fn();
    const { getByTestId } = render(
      <TermsFooter onTermsPress={onTermsPress} onPrivacyPress={onPrivacyPress} testID="terms" />
    );
    fireEvent.press(getByTestId('terms-tos'));
    fireEvent.press(getByTestId('terms-privacy'));
    expect(onTermsPress).toHaveBeenCalledTimes(1);
    expect(onPrivacyPress).toHaveBeenCalledTimes(1);
  });
});
