/**
 * DestinationChipRow Tests
 *
 * Empty/single destinations → null. Multi → "전체" + 각 chip. Selection
 * 상태(accessibilityState.selected) + press → onSelect 호출.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

// useTheme - 다른 station 테스트와 동일 패턴 (memory: [useTheme 두 경로 mock])
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

import { DestinationChipRow } from '../DestinationChipRow';

describe('DestinationChipRow', () => {
  describe('Visibility', () => {
    it('returns null for empty destinations', () => {
      const { toJSON } = render(
        <DestinationChipRow destinations={[]} selected={null} onSelect={jest.fn()} />,
      );
      expect(toJSON()).toBeNull();
    });

    it('returns null for a single destination (filter has no meaning)', () => {
      const { toJSON } = render(
        <DestinationChipRow destinations={['잠실']} selected={null} onSelect={jest.fn()} />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders chips when destinations >= 2', () => {
      const { getByText } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected={null}
          onSelect={jest.fn()}
        />,
      );
      expect(getByText('전체')).toBeTruthy();
      expect(getByText('잠실')).toBeTruthy();
      expect(getByText('서울대입구')).toBeTruthy();
    });
  });

  describe('Selection state', () => {
    it('marks "전체" as selected when selected prop is null', () => {
      const { getByTestId } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected={null}
          onSelect={jest.fn()}
          testID="dest"
        />,
      );
      const allChip = getByTestId('dest-chip-__all__');
      expect(allChip.props.accessibilityState?.selected).toBe(true);
    });

    it('marks a specific chip as selected by value match', () => {
      const { getByTestId } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected="잠실"
          onSelect={jest.fn()}
          testID="dest"
        />,
      );
      expect(getByTestId('dest-chip-잠실').props.accessibilityState?.selected).toBe(true);
      expect(getByTestId('dest-chip-서울대입구').props.accessibilityState?.selected).toBe(false);
      expect(getByTestId('dest-chip-__all__').props.accessibilityState?.selected).toBe(false);
    });
  });

  describe('Press behavior', () => {
    it('invokes onSelect with destination value when chip pressed', () => {
      const onSelect = jest.fn();
      const { getByTestId } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected={null}
          onSelect={onSelect}
          testID="dest"
        />,
      );
      fireEvent.press(getByTestId('dest-chip-잠실'));
      expect(onSelect).toHaveBeenCalledWith('잠실');
    });

    it('invokes onSelect with null when "전체" pressed', () => {
      const onSelect = jest.fn();
      const { getByTestId } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected="잠실"
          onSelect={onSelect}
          testID="dest"
        />,
      );
      fireEvent.press(getByTestId('dest-chip-__all__'));
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Accessibility', () => {
    it('exposes accessibilityLabel for destination chips', () => {
      const { getByLabelText } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected={null}
          onSelect={jest.fn()}
        />,
      );
      expect(getByLabelText('잠실 방면 필터')).toBeTruthy();
      expect(getByLabelText('서울대입구 방면 필터')).toBeTruthy();
    });

    it('exposes accessibilityLabel for "전체" chip', () => {
      const { getByLabelText } = render(
        <DestinationChipRow
          destinations={['잠실', '서울대입구']}
          selected={null}
          onSelect={jest.fn()}
        />,
      );
      expect(getByLabelText('전체 방면')).toBeTruthy();
    });
  });
});
