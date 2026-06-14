import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GuidanceHeader } from '../GuidanceHeader';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
}));

// 2026-06-11 09:03 KST (jest TZ pinned to Asia/Seoul)
const ETA_MS = new Date(2026, 5, 11, 9, 3, 0).getTime();

describe('GuidanceHeader', () => {
  const baseProps = {
    fromStationName: '을지로3가',
    toStationName: '산곡',
    etaMs: ETA_MS,
    remainingSeconds: 76 * 60,
    progress: 0.3,
    onClose: jest.fn(),
  };

  it('formats the arrival clock time with meridiem', () => {
    const { getByTestId, getByText } = render(<GuidanceHeader {...baseProps} />);
    expect(getByTestId('guidance-eta-time')).toHaveTextContent('9:03');
    expect(getByText('오전')).toBeTruthy();
    expect(getByText('산곡 도착 예정')).toBeTruthy();
  });

  it('formats an afternoon ETA with 오후 and 12h clock', () => {
    const pm = new Date(2026, 5, 11, 13, 5, 0).getTime();
    const { getByTestId, getByText } = render(
      <GuidanceHeader {...baseProps} etaMs={pm} />
    );
    expect(getByTestId('guidance-eta-time')).toHaveTextContent('1:05');
    expect(getByText('오후')).toBeTruthy();
  });

  it('shows remaining minutes rounded up', () => {
    const { getByTestId } = render(
      <GuidanceHeader {...baseProps} remainingSeconds={61} />
    );
    expect(getByTestId('guidance-remaining-min')).toHaveTextContent('2');
  });

  it('shows journey endpoints under the progress bar', () => {
    const { getByText } = render(<GuidanceHeader {...baseProps} />);
    expect(getByText('을지로3가')).toBeTruthy();
    expect(getByText('산곡')).toBeTruthy();
  });

  it('fires onClose from the dismiss button', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<GuidanceHeader {...baseProps} onClose={onClose} />);
    fireEvent.press(getByTestId('guidance-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
