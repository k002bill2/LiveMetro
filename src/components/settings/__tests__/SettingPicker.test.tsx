/**
 * SettingPicker Component Tests
 */

jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_, name) => name })
);

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingPicker } from '../SettingPicker';
import type { PickerOption } from '../SettingPicker';

const options: PickerOption[] = [
  { label: '한국어', value: 'ko', description: 'Korean' },
  { label: 'English', value: 'en', description: 'English' },
  { label: '日本語', value: 'ja' },
];

describe('SettingPicker', () => {
  const defaultProps = {
    label: '언어 설정',
    options,
    value: 'ko',
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label and selected value', () => {
    const { getByText } = render(<SettingPicker {...defaultProps} />);
    expect(getByText('언어 설정')).toBeTruthy();
    expect(getByText('한국어')).toBeTruthy();
  });

  it('renders with icon', () => {
    const { getByText } = render(
      <SettingPicker {...defaultProps} icon="language-outline" />
    );
    expect(getByText('언어 설정')).toBeTruthy();
  });

  it('opens modal on press and shows options', () => {
    const { getByText, getAllByText } = render(
      <SettingPicker {...defaultProps} />
    );
    // Press the picker to open modal
    fireEvent.press(getByText('한국어'));
    // Modal should show the title and all options
    expect(getAllByText('언어 설정').length).toBeGreaterThanOrEqual(1);
    // "English" appears as both option label and description, so use getAllByText
    expect(getAllByText('English').length).toBeGreaterThanOrEqual(1);
    expect(getByText('日本語')).toBeTruthy();
  });

  it('calls onValueChange when option selected', () => {
    const { getByText } = render(<SettingPicker {...defaultProps} />);
    // Open modal
    fireEvent.press(getByText('한국어'));
    // Select an option without duplicate text
    fireEvent.press(getByText('日本語'));
    expect(defaultProps.onValueChange).toHaveBeenCalledWith('ja');
  });

  it('shows option descriptions when available', () => {
    const { getByText } = render(<SettingPicker {...defaultProps} />);
    fireEvent.press(getByText('한국어'));
    expect(getByText('Korean')).toBeTruthy();
  });
});
