import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LineFavoritePicker } from '../LineFavoritePicker';
import { LineFavoriteOption } from '../../../screens/map/lineFavoriteResolver';

const options: LineFavoriteOption[] = [
  { lineId: '2', stationCd: '0208', isFavorite: true },
  { lineId: '5', stationCd: '2541', isFavorite: false },
];

const lineLabel = (lineId: string) => `${lineId}호선`;
const lineColor = () => '#000000';
const saveColor = '#0066FF';
const onColor = '#ffffff';

describe('LineFavoritePicker', () => {
  it('initializes selection from already-favorited options', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker
        options={options}
        lineLabel={lineLabel}
        lineColor={lineColor}
        saveColor={saveColor}
        onColor={onColor}
        onSave={onSave}
      />
    );
    // line 2 starts selected (favorited), line 5 starts unselected
    expect(getByTestId('line-chip-2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('line-chip-5').props.accessibilityState.selected).toBe(false);
  });

  it('toggles a chip locally without calling onSave', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker options={options} lineLabel={lineLabel} lineColor={lineColor} saveColor={saveColor} onColor={onColor} onSave={onSave} />
    );
    fireEvent.press(getByTestId('line-chip-5'));
    expect(getByTestId('line-chip-5').props.accessibilityState.selected).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('on save passes diff: toggling 5 on and 2 off', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker options={options} lineLabel={lineLabel} lineColor={lineColor} saveColor={saveColor} onColor={onColor} onSave={onSave} />
    );
    fireEvent.press(getByTestId('line-chip-5')); // select 5
    fireEvent.press(getByTestId('line-chip-2')); // deselect 2
    fireEvent.press(getByTestId('line-favorite-save'));
    expect(onSave).toHaveBeenCalledWith({ toAdd: ['5'], toRemove: ['0208'] });
  });

  it('disables save when selection matches initial state', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker options={options} lineLabel={lineLabel} lineColor={lineColor} saveColor={saveColor} onColor={onColor} onSave={onSave} />
    );
    expect(getByTestId('line-favorite-save').props.accessibilityState.disabled).toBe(true);
  });
});
