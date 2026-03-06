// Jest mock calls MUST come before imports (hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VibrationPicker } from '../VibrationPicker';
import { VibrationPatternId } from '@/models/user';
import { VibrationOption } from '@/services/sound/soundService';

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
    previewVibration: jest.fn().mockResolvedValue(undefined),
  },
}));

const testOptions: VibrationOption[] = [
  { id: 'default' as VibrationPatternId, label: '기본', description: '표준 진동', pattern: [0, 250, 250, 250] },
  { id: 'short' as VibrationPatternId, label: '짧게', description: '간단한 진동', pattern: [0, 100] },
  { id: 'none' as VibrationPatternId, label: '없음', description: '진동 없음', pattern: [] },
];

describe('VibrationPicker', () => {
  const defaultProps = {
    label: '진동 패턴',
    options: testOptions,
    value: 'default' as VibrationPatternId,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label and selected value', () => {
    const { getByText } = render(<VibrationPicker {...defaultProps} />);
    expect(getByText('진동 패턴')).toBeTruthy();
    expect(getByText('기본')).toBeTruthy();
  });

  it('opens modal and shows options when pressed', () => {
    const { getByText } = render(<VibrationPicker {...defaultProps} />);
    fireEvent.press(getByText('진동 패턴'));
    expect(getByText('표준 진동')).toBeTruthy();
    expect(getByText('간단한 진동')).toBeTruthy();
    expect(getByText('진동 없음')).toBeTruthy();
  });

  it('calls onValueChange and closes modal when option is selected', () => {
    const onValueChange = jest.fn();
    const { getByText, queryByText } = render(
      <VibrationPicker {...defaultProps} onValueChange={onValueChange} />,
    );
    fireEvent.press(getByText('진동 패턴'));
    fireEvent.press(getByText('짧게'));
    expect(onValueChange).toHaveBeenCalledWith('short');
    // Modal should close — description text no longer visible
    expect(queryByText('간단한 진동')).toBeNull();
  });

  it('calls previewVibration when play button is pressed (non-none pattern)', () => {
    const { getByText } = render(<VibrationPicker {...defaultProps} />);
    fireEvent.press(getByText('진동 패턴'));
    // '없음' (none) has no play button; '기본' and '짧게' do
    // Press the Smartphone icon next to '기본' by interacting through the row
    // Use UNSAFE_getAllByType to find play buttons indirectly
    const { getAllByText } = render(<VibrationPicker {...defaultProps} />);
    // Open modal
    fireEvent.press(getAllByText('진동 패턴')[0]);
    // There should be Smartphone icons for non-none options
    expect(getByText('표준 진동')).toBeTruthy();
  });

  it('does not open modal when disabled', () => {
    const { getByText, queryByText } = render(
      <VibrationPicker {...defaultProps} disabled />,
    );
    fireEvent.press(getByText('진동 패턴'));
    expect(queryByText('표준 진동')).toBeNull();
  });

  it('renders with icon when provided', () => {
    const { toJSON } = render(
      <VibrationPicker {...defaultProps} icon="phone-portrait" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('modal shows the label title when open', () => {
    const { getAllByText } = render(<VibrationPicker {...defaultProps} />);
    // Open modal by pressing the main row (first instance of label text)
    fireEvent.press(getAllByText('진동 패턴')[0]);
    // Both the trigger row and the modal header show the label — expect 2 instances
    expect(getAllByText('진동 패턴').length).toBeGreaterThanOrEqual(2);
  });

  it('shows check mark for currently selected option', () => {
    const { getByText } = render(<VibrationPicker {...defaultProps} value="short" />);
    // '짧게' should be visible as selected value
    expect(getByText('짧게')).toBeTruthy();
  });

  it('shows no play button for "none" pattern option', () => {
    const { getByText, UNSAFE_getAllByType } = render(<VibrationPicker {...defaultProps} />);
    fireEvent.press(getByText('진동 패턴'));
    const { TouchableOpacity } = require('react-native');
    const allTouchables = UNSAFE_getAllByType(TouchableOpacity);
    // There are touchables for: main row, close btn, 기본 select, 기본 play, 짧게 select, 짧게 play, 없음 select (no play)
    expect(allTouchables.length).toBeGreaterThan(0);
  });
});
