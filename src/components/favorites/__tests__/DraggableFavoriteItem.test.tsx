/**
 * DraggableFavoriteItem Tests — global edit-mode selection UI.
 * Focuses on the select-mode props (checkbox, edit pencil, swipe disable)
 * added for the favorites edit mode. Mock setup mirrors the sibling
 * FavoriteEditForm/FavoritesScreen tests (real modernTheme, stubbed theme
 * tokens, lucide proxy).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DraggableFavoriteItem } from '../DraggableFavoriteItem';
import { FavoriteWithDetails } from '@/hooks/useFavorites';

// lucide icons resolve to their name string so they render as inert host nodes.
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

// Capture Swipeable props so we can assert `enabled` toggles with select mode.
// Expose a `close` method on the ref so we can assert the drawer is retracted
// when edit mode is entered.
const mockSwipeableProps = jest.fn();
const mockSwipeableClose = jest.fn();
jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react');
  return {
    Swipeable: ReactModule.forwardRef((props: { children?: React.ReactNode }, ref: unknown) => {
      mockSwipeableProps(props);
      ReactModule.useImperativeHandle(ref, () => ({ close: mockSwipeableClose }), []);
      return props.children ?? null;
    }),
  };
});

// FavoriteRow stub exposes its onPress so we can verify select-mode routing.
jest.mock('@/components/design', () => {
  const ReactModule = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    FavoriteRow: ({ onPress, stationName }: { onPress?: () => void; stationName?: string }) =>
      ReactModule.createElement(
        TouchableOpacity,
        { testID: 'favorite-row', onPress },
        ReactModule.createElement(Text, null, stationName),
      ),
  };
});

jest.mock('@/hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(() => ({ trains: [] })),
}));

jest.mock('../FavoriteEditForm', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    FavoriteEditForm: () => ReactModule.createElement(View, { testID: 'favorite-edit-form' }),
  };
});

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(
    () => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light,
  ),
  useTheme: jest.fn(() => ({
    colors: {
      surface: '#FFFFFF',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      textTertiary: '#999999',
      backgroundSecondary: '#FAFAFA',
      borderLight: '#E5E5E5',
      borderMedium: '#CCCCCC',
    },
    isDark: false,
  })),
  ThemeColors: {},
}));

const baseFavorite: FavoriteWithDetails = {
  id: 'fav-1',
  stationId: 'ST001',
  lineId: '2',
  alias: null,
  direction: 'both',
  isCommuteStation: false,
  addedAt: new Date('2026-01-01'),
  station: {
    id: 'ST001',
    name: '강남',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: { latitude: 0, longitude: 0 },
    transfers: [],
  },
};

type ItemProps = React.ComponentProps<typeof DraggableFavoriteItem>;

const renderItem = (overrides: Partial<ItemProps> = {}) => {
  const props: ItemProps = {
    favorite: baseFavorite,
    index: 0,
    isEditing: false,
    onEditToggle: jest.fn(),
    onRemove: jest.fn(),
    onPress: jest.fn(),
    onSaveEdit: jest.fn().mockResolvedValue(undefined),
    drag: jest.fn(),
    ...overrides,
  };
  return render(<DraggableFavoriteItem {...props} />);
};

describe('DraggableFavoriteItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('선택 모드 (isSelectMode)', () => {
    it('체크박스를 렌더하고 accessibilityState.checked를 반영한다', () => {
      const { getByTestId } = renderItem({ isSelectMode: true, isSelected: true });
      expect(getByTestId('favorite-select-checkbox').props.accessibilityState).toEqual(
        expect.objectContaining({ checked: true }),
      );
    });

    it('체크박스 탭 → onSelectToggle 호출', () => {
      const onSelectToggle = jest.fn();
      const { getByTestId } = renderItem({ isSelectMode: true, onSelectToggle });
      fireEvent.press(getByTestId('favorite-select-checkbox'));
      expect(onSelectToggle).toHaveBeenCalledTimes(1);
    });

    it('선택 모드에서 행(FavoriteRow) 탭 → onPress 대신 onSelectToggle', () => {
      const onPress = jest.fn();
      const onSelectToggle = jest.fn();
      const { getByTestId } = renderItem({ isSelectMode: true, onPress, onSelectToggle });
      fireEvent.press(getByTestId('favorite-row'));
      expect(onSelectToggle).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('✎ 버튼 탭 → onEditPress 호출', () => {
      const onEditPress = jest.fn();
      const { getByTestId } = renderItem({ isSelectMode: true, onEditPress });
      fireEvent.press(getByTestId('favorite-edit-pencil'));
      expect(onEditPress).toHaveBeenCalledTimes(1);
    });

    it('선택 모드에서 Swipeable이 비활성화된다 (enabled=false)', () => {
      renderItem({ isSelectMode: true });
      const lastProps = mockSwipeableProps.mock.lastCall?.[0] as { enabled?: boolean } | undefined;
      expect(lastProps?.enabled).toBe(false);
    });

    it('선택 모드 진입 시 열린 스와이프 드로어를 닫는다 (close 호출)', () => {
      const props: ItemProps = {
        favorite: baseFavorite,
        index: 0,
        isEditing: false,
        onEditToggle: jest.fn(),
        onRemove: jest.fn(),
        onPress: jest.fn(),
        onSaveEdit: jest.fn().mockResolvedValue(undefined),
        drag: jest.fn(),
        isSelectMode: false,
      };
      const { rerender } = render(<DraggableFavoriteItem {...props} />);
      expect(mockSwipeableClose).not.toHaveBeenCalled();

      rerender(<DraggableFavoriteItem {...props} isSelectMode={true} />);
      expect(mockSwipeableClose).toHaveBeenCalledTimes(1);
    });

    it('일반 모드(기본값)에서는 체크박스·✎가 렌더되지 않는다', () => {
      const { queryByTestId } = renderItem({});
      expect(queryByTestId('favorite-select-checkbox')).toBeNull();
      expect(queryByTestId('favorite-edit-pencil')).toBeNull();
    });
  });

  describe('station 하이드레이션 실패 (에러 카드)', () => {
    const brokenFavorite: FavoriteWithDetails = { ...baseFavorite, station: null };

    it('선택 모드에서 에러 카드에도 체크박스를 렌더하고 onSelectToggle을 호출한다', () => {
      const onSelectToggle = jest.fn();
      const { getByTestId } = renderItem({
        favorite: brokenFavorite,
        isSelectMode: true,
        onSelectToggle,
      });

      fireEvent.press(getByTestId('favorite-select-checkbox'));
      expect(onSelectToggle).toHaveBeenCalledTimes(1);
    });

    it('일반 모드에서는 에러 카드에 체크박스가 없다', () => {
      const { queryByTestId } = renderItem({ favorite: brokenFavorite });
      expect(queryByTestId('favorite-select-checkbox')).toBeNull();
    });

    it('선택 모드에서 에러 카드에도 ✎ 버튼을 렌더하고 onEditPress를 호출한다', () => {
      const onEditPress = jest.fn();
      const { getByTestId } = renderItem({
        favorite: brokenFavorite,
        isSelectMode: true,
        onEditPress,
      });

      fireEvent.press(getByTestId('favorite-edit-pencil'));
      expect(onEditPress).toHaveBeenCalledTimes(1);
    });

    it('에러 카드도 isEditing이면 편집 폼을 렌더한다 (alias/방향/출퇴근은 station 무관)', () => {
      const { getByTestId } = renderItem({ favorite: brokenFavorite, isEditing: true });
      expect(getByTestId('favorite-edit-form')).toBeTruthy();
    });

    it('일반 모드에서는 에러 카드에 ✎ 버튼이 없다', () => {
      const { queryByTestId } = renderItem({ favorite: brokenFavorite });
      expect(queryByTestId('favorite-edit-pencil')).toBeNull();
    });
  });
});
