import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DelayDurationStepper } from '../DelayDurationStepper';

jest.mock('lucide-react-native', () => ({
  Minus: 'Minus',
  Plus: 'Plus',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('DelayDurationStepper', () => {
  it('renders current value as "{N}분"', () => {
    const { getByTestId } = render(<DelayDurationStepper value={7} onChange={jest.fn()} />);
    expect(getByTestId('duration-stepper-value').props.children).toEqual([7, '분']);
  });

  it('calls onChange with value+1 when increment is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DelayDurationStepper value={5} onChange={onChange} />);
    fireEvent.press(getByTestId('duration-stepper-increment'));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('calls onChange with value-1 when decrement is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DelayDurationStepper value={5} onChange={onChange} />);
    fireEvent.press(getByTestId('duration-stepper-decrement'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('does not call onChange when decrement is pressed at min', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DelayDurationStepper value={1} min={1} onChange={onChange} />);
    fireEvent.press(getByTestId('duration-stepper-decrement'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when increment is pressed at max', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DelayDurationStepper value={60} max={60} onChange={onChange} />);
    fireEvent.press(getByTestId('duration-stepper-increment'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders all default quick-pick chips', () => {
    const { getByText } = render(<DelayDurationStepper value={5} onChange={jest.fn()} />);
    expect(getByText('3분')).toBeTruthy();
    // 5분 already rendered as value — quick-pick exists at testID level
    expect(getByText('10분')).toBeTruthy();
    expect(getByText('15분')).toBeTruthy();
    expect(getByText('30분')).toBeTruthy();
  });

  it('calls onChange when quick-pick is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<DelayDurationStepper value={5} onChange={onChange} />);
    fireEvent.press(getByTestId('duration-quick-10'));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('respects custom quickPicks prop', () => {
    const { getByTestId, queryByTestId } = render(
      <DelayDurationStepper value={5} onChange={jest.fn()} quickPicks={[1, 2]} />,
    );
    expect(getByTestId('duration-quick-1')).toBeTruthy();
    expect(getByTestId('duration-quick-2')).toBeTruthy();
    expect(queryByTestId('duration-quick-30')).toBeNull();
  });

  it('respects custom min/max for clamping', () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = render(
      <DelayDurationStepper value={3} min={3} max={10} onChange={onChange} />,
    );
    fireEvent.press(getByTestId('duration-stepper-decrement'));
    expect(onChange).not.toHaveBeenCalled();

    rerender(<DelayDurationStepper value={10} min={3} max={10} onChange={onChange} />);
    fireEvent.press(getByTestId('duration-stepper-increment'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
