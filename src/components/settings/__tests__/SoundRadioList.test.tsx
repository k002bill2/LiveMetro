/**
 * SoundRadioList Test Suite
 * Tests inline sound radio list rendering, selection, preview, and disabled state.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SoundRadioList } from '../SoundRadioList';
import { soundService } from '@/services/sound/soundService';
import type { SoundOption } from '@/services/sound/soundService';

// Proxy stubs every lucide icon name → its own string component (Play used here).
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target: object, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (typeof prop !== 'string') return undefined;
        return prop;
      },
    },
  ),
);

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(
    () => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light,
  ),
}));

jest.mock('@/services/sound/soundService', () => ({
  soundService: {
    previewSound: jest.fn(() => Promise.resolve()),
  },
}));

// Inline options fixture (the soundService mock does not export NOTIFICATION_SOUNDS).
// Ids must be valid NotificationSoundId members ('chime' | 'doorbell' | 'beep' | 'wave').
const OPTIONS: readonly SoundOption[] = [
  { id: 'chime', label: '차임', description: '서울 지하철 도어 차임' },
  { id: 'doorbell', label: '도어벨', description: '도착 안내 도어벨음' },
  { id: 'beep', label: '비프', description: '간단한 비프음' },
] as const;

describe('SoundRadioList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all option labels and descriptions', () => {
    const { getByText } = render(
      <SoundRadioList
        options={OPTIONS}
        value="chime"
        volume={80}
        onValueChange={jest.fn()}
      />,
    );

    expect(getByText('차임')).toBeTruthy();
    expect(getByText('서울 지하철 도어 차임')).toBeTruthy();
    expect(getByText('도어벨')).toBeTruthy();
    expect(getByText('도착 안내 도어벨음')).toBeTruthy();
    expect(getByText('비프')).toBeTruthy();
    expect(getByText('간단한 비프음')).toBeTruthy();
  });

  it('calls onValueChange with the row id when a row is tapped', () => {
    const onValueChange = jest.fn();
    const { getByTestId } = render(
      <SoundRadioList
        options={OPTIONS}
        value="chime"
        volume={80}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.press(getByTestId('sound-row-doorbell'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('doorbell');
  });

  it('marks the selected row with accessibilityState selected=true', () => {
    const { getByTestId } = render(
      <SoundRadioList
        options={OPTIONS}
        value="doorbell"
        volume={80}
        onValueChange={jest.fn()}
      />,
    );

    const selectedRow = getByTestId('sound-row-doorbell');
    const unselectedRow = getByTestId('sound-row-chime');

    expect(selectedRow.props.accessibilityState).toMatchObject({ selected: true });
    expect(unselectedRow.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('calls previewSound with id and volume when avatar is tapped', () => {
    const { getByTestId } = render(
      <SoundRadioList
        options={OPTIONS}
        value="chime"
        volume={55}
        onValueChange={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId('sound-preview-doorbell'));

    expect(soundService.previewSound).toHaveBeenCalledTimes(1);
    expect(soundService.previewSound).toHaveBeenCalledWith('doorbell', 55);
  });

  it('does not call onValueChange or previewSound when disabled', () => {
    const onValueChange = jest.fn();
    const { getByTestId } = render(
      <SoundRadioList
        options={OPTIONS}
        value="chime"
        volume={80}
        onValueChange={onValueChange}
        disabled
      />,
    );

    fireEvent.press(getByTestId('sound-row-doorbell'));
    fireEvent.press(getByTestId('sound-preview-doorbell'));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(soundService.previewSound).not.toHaveBeenCalled();
  });
});
