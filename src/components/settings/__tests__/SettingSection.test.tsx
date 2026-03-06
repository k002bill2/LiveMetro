import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SettingSection } from '../SettingSection';

jest.mock('@/services/theme', () => ({
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
});
