/**
 * LoginHero Tests — Wanted Design System hero illustration.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { LoginHero } from '../LoginHero';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const passthrough = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <View testID={testID}>{children}</View>
  );
  return {
    __esModule: true,
    default: passthrough,
    Svg: passthrough,
    Path: passthrough,
    Circle: passthrough,
    G: passthrough,
  };
});

describe('LoginHero', () => {
  it('renders the wordmark text', () => {
    const { getByText } = render(<LoginHero />);
    expect(getByText('LiveMetro')).toBeTruthy();
  });

  it('renders the tagline', () => {
    const { getByText } = render(<LoginHero />);
    expect(getByText(/실시간/)).toBeTruthy();
  });

  it('respects an explicit testID for snapshot/QA hooks', () => {
    const { getByTestId } = render(<LoginHero testID="hero" />);
    expect(getByTestId('hero')).toBeTruthy();
  });
});
