// Jest mock calls MUST come before imports (hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VibrationPicker } from '../VibrationPicker';
import { VibrationPatternId } from '@/models/user';
import { VibrationOption, soundService } from '@/services/sound/soundService';

import { Smartphone } from 'lucide-react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

// Phase 45 — Wanted DS migration: legacy modernTheme mock removed because
// the component no longer imports COLORS/SPACING/RADIUS/TYPOGRAPHY. useTheme
// drives the WANTED_TOKENS light/dark selection.
jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
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
    // Selected value '기본' shows on the right side of the trigger row.
    expect(getByText('기본')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <VibrationPicker {...defaultProps} subtitle="알림 시 울릴 진동" />,
    );
    expect(getByText('알림 시 울릴 진동')).toBeTruthy();
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
    // Select via the description text (unique within the modal).
    fireEvent.press(getByText('간단한 진동'));
    expect(onValueChange).toHaveBeenCalledWith('short');
    // Modal should close — description text no longer visible
    expect(queryByText('간단한 진동')).toBeNull();
  });

  it('calls previewVibration when the pattern glyph is pressed', () => {
    const { getByText, getByTestId } = render(<VibrationPicker {...defaultProps} />);
    fireEvent.press(getByText('진동 패턴'));
    fireEvent.press(getByTestId('vib-preview-default'));
    expect(soundService.previewVibration).toHaveBeenCalledWith('default');
  });

  it('shows a pattern glyph for every option including "none"', () => {
    const { getByText, getByTestId } = render(<VibrationPicker {...defaultProps} />);
    fireEvent.press(getByText('진동 패턴'));
    expect(getByTestId('vib-preview-default')).toBeTruthy();
    expect(getByTestId('vib-preview-short')).toBeTruthy();
    // 'none' now also has a glyph (previously had none).
    expect(getByTestId('vib-preview-none')).toBeTruthy();
  });

  it('previews the "none" pattern when its glyph is pressed', () => {
    const { getByText, getByTestId } = render(<VibrationPicker {...defaultProps} />);
    fireEvent.press(getByText('진동 패턴'));
    fireEvent.press(getByTestId('vib-preview-none'));
    expect(soundService.previewVibration).toHaveBeenCalledWith('none');
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
      <VibrationPicker {...defaultProps} icon={Smartphone} />,
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

  it('shows the selected value label on the trigger row', () => {
    const { getByText } = render(<VibrationPicker {...defaultProps} value="short" />);
    // '짧게' should be visible as the right-side selected value.
    expect(getByText('짧게')).toBeTruthy();
  });
});
