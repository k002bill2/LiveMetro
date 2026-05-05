/**
 * OnbHeader — RTL smoke tests covering progress + back/skip wiring.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OnbHeader } from '../OnbHeader';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
}));

describe('OnbHeader', () => {
  it('renders the dot gauge with active dots equal to currentStep', () => {
    const { getByTestId } = render(<OnbHeader currentStep={2} />);
    expect(getByTestId('onb-header')).toBeTruthy();
  });

  it('hides back + skip on step 1 and shows the {n}/4 counter instead', () => {
    const { queryByTestId, getByTestId } = render(<OnbHeader currentStep={1} />);
    expect(queryByTestId('onb-header-back')).toBeNull();
    expect(queryByTestId('onb-header-skip')).toBeNull();
    expect(getByTestId('onb-header-counter').props.children).toEqual([1, '/', 4]);
  });

  it('renders back when onBack provided and fires the callback', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<OnbHeader currentStep={2} onBack={onBack} />);
    fireEvent.press(getByTestId('onb-header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders skip when onSkip provided and fires the callback', () => {
    const onSkip = jest.fn();
    const { getByTestId } = render(<OnbHeader currentStep={3} onSkip={onSkip} />);
    fireEvent.press(getByTestId('onb-header-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('shows the counter (not skip) when onSkip is undefined', () => {
    const { queryByTestId, getByTestId } = render(<OnbHeader currentStep={4} />);
    expect(queryByTestId('onb-header-skip')).toBeNull();
    expect(getByTestId('onb-header-counter').props.children).toEqual([4, '/', 4]);
  });
});
