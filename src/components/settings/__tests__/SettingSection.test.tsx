import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SettingSection } from '../SettingSection';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({
    colors: {
      textSecondary: '#8E8E93',
      surface: '#FFFFFF',
      borderLight: '#E5E5EA',
    },
  }),
}));

describe('SettingSection', () => {
  it('renders children', () => {
    const { getByText } = render(
      <SettingSection>
        <Text>Child Content</Text>
      </SettingSection>,
    );
    expect(getByText('Child Content')).toBeTruthy();
  });

  it('renders title when provided', () => {
    const { getByText } = render(
      <SettingSection title="테스트 섹션">
        <Text>Content</Text>
      </SettingSection>,
    );
    expect(getByText('테스트 섹션')).toBeTruthy();
  });

  it('does not render title when not provided', () => {
    const { queryByText } = render(
      <SettingSection>
        <Text>Content</Text>
      </SettingSection>,
    );
    expect(queryByText('테스트 섹션')).toBeNull();
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <SettingSection>
        <Text>First</Text>
        <Text>Second</Text>
      </SettingSection>,
    );
    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
  });

  it('renders the title and a trailing node side by side', () => {
    const { getByText, getByTestId } = render(
      <SettingSection
        title="볼륨"
        trailing={<Text testID="trailing-pct">70%</Text>}
      >
        <Text>Content</Text>
      </SettingSection>,
    );
    expect(getByText('볼륨')).toBeTruthy();
    expect(getByTestId('trailing-pct')).toHaveTextContent('70%');
  });
});
