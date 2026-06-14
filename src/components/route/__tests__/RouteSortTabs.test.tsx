import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteSortTabs } from '../RouteSortTabs';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

describe('RouteSortTabs', () => {
  it('renders all four sort options', () => {
    const { getByText } = render(
      <RouteSortTabs value="optimal" onChange={() => {}} />
    );
    expect(getByText('최적')).toBeTruthy();
    expect(getByText('최소시간')).toBeTruthy();
    expect(getByText('최소환승')).toBeTruthy();
    expect(getByText('최소요금')).toBeTruthy();
  });

  it('marks the active option as selected for accessibility', () => {
    const { getByTestId } = render(
      <RouteSortTabs value="fastest" onChange={() => {}} testID="tabs" />
    );
    expect(getByTestId('tabs-fastest').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('tabs-optimal').props.accessibilityState.selected).toBe(false);
  });

  it('calls onChange with the tapped option', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RouteSortTabs value="optimal" onChange={onChange} testID="tabs" />
    );
    fireEvent.press(getByTestId('tabs-min-fare'));
    expect(onChange).toHaveBeenCalledWith('min-fare');
  });

  it('does not call onChange when the already-active option is tapped', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RouteSortTabs value="optimal" onChange={onChange} testID="tabs" />
    );
    fireEvent.press(getByTestId('tabs-optimal'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
