import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SoundPicker } from '../SoundPicker';
import { NotificationSoundId } from '@/models/user';
import { SoundOption } from '@/services/sound/soundService';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/styles/modernTheme', () => ({
  COLORS: {
    black: '#000000',
    white: '#FFFFFF',
    gray: { 400: '#999999' },
    border: { light: '#E5E5EA', medium: '#D1D1D6' },
    surface: { card: '#F2F2F7', overlay: 'rgba(0,0,0,0.5)' },
    text: { primary: '#000000', tertiary: '#C7C7CC' },
  },
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16 },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
  },
}));

jest.mock('@/services/sound/soundService', () => ({
  soundService: {
    stopSound: jest.fn().mockResolvedValue(undefined),
    previewSound: jest.fn().mockResolvedValue(undefined),
  },
}));

const testOptions: SoundOption[] = [
  { id: 'default' as NotificationSoundId, label: '기본', description: '기본 알림음' },
  { id: 'train_arrival' as NotificationSoundId, label: '열차 도착', description: '열차 도착음' },
  { id: 'silent' as NotificationSoundId, label: '무음', description: '소리 없음' },
];

describe('SoundPicker', () => {
  const defaultProps = {
    label: '알림 소리',
    options: testOptions,
    value: 'default' as NotificationSoundId,
    volume: 80,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label and selected value', () => {
    const { getByText } = render(
      <SoundPicker {...defaultProps} />,
    );
    expect(getByText('알림 소리')).toBeTruthy();
    expect(getByText('기본')).toBeTruthy();
  });

  it('opens modal and shows options when pressed', () => {
    const { getByText, queryByText } = render(
      <SoundPicker {...defaultProps} />,
    );
    // Modal not visible initially (options inside modal)
    // Press to open modal
    fireEvent.press(getByText('알림 소리'));
    // Now modal options should be visible
    expect(getByText('기본 알림음')).toBeTruthy();
    expect(getByText('열차 도착음')).toBeTruthy();
    expect(getByText('소리 없음')).toBeTruthy();
  });

  it('calls onValueChange when an option is selected', () => {
    const onValueChange = jest.fn();
    const { getByText } = render(
      <SoundPicker {...defaultProps} onValueChange={onValueChange} />,
    );
    fireEvent.press(getByText('알림 소리'));
    fireEvent.press(getByText('열차 도착'));
    expect(onValueChange).toHaveBeenCalledWith('train_arrival');
  });

  it('renders with icon when provided', () => {
    const { toJSON } = render(
      <SoundPicker {...defaultProps} icon="volume-high" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders disabled state', () => {
    const { getByText } = render(
      <SoundPicker {...defaultProps} disabled />,
    );
    expect(getByText('알림 소리')).toBeTruthy();
  });

  it('does not open modal when disabled', () => {
    const { getByText, queryByText } = render(
      <SoundPicker {...defaultProps} disabled />,
    );
    fireEvent.press(getByText('알림 소리'));
    // Modal should not have opened; descriptions should not be visible
    expect(queryByText('기본 알림음')).toBeNull();
  });
});
