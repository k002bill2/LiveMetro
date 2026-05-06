/**
 * OnboardingStationPickerScreen Test Suite — Phase 52
 *
 * Covers the dedicated station picker drilled into from CommuteRouteScreen:
 * slot-aware rendering, mode toggle (recommend ↔ browse), browse-mode line
 * tabs + station list, search filtering, selection return path via
 * `navigation.navigate(..., { merge: true })`, and back navigation.
 *
 * Mocks are inline inside `jest.mock()` factories (per memory's hoisting
 * safety pattern) and lucide icons use a Proxy so any icon resolves to a
 * stub View — avoids per-icon list maintenance.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OnboardingStationPickerScreen } from '../OnboardingStationPickerScreen';

// React Native Animated noise
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Lucide icons — Proxy stubs every imported name to a string component
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        return prop;
      },
    },
  );
});

// Theme — both paths (alias + direct themeContext) so atomic imports work
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

// Subway line color util — return a fixed color for any line ID
jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(() => '#0066FF'),
  getLineTextColor: jest.fn(() => '#FFFFFF'),
}));

// Stations data service — return a small predictable list per line
jest.mock('@/services/data/stationsDataService', () => ({
  getLocalStationsByLine: jest.fn((lineId: string) => {
    if (lineId === '2') {
      return [
        { id: '0222', name: '강남', nameEn: 'Gangnam', lineId: '2' },
        { id: '0223', name: '역삼', nameEn: 'Yeoksam', lineId: '2' },
        { id: '0234', name: '홍대입구', nameEn: 'Hongik Univ.', lineId: '2' },
      ];
    }
    if (lineId === '3') {
      return [
        { id: '0339', name: '교대', nameEn: 'Gyodae', lineId: '3' },
      ];
    }
    return [];
  }),
}));

// Favorites — return a couple of commute-flagged stations
jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    favoritesWithDetails: [
      {
        stationId: '0222',
        isCommuteStation: true,
        station: { id: '0222', name: '강남', nameEn: 'Gangnam', lineId: '2' },
      },
      {
        stationId: '0234',
        isCommuteStation: true,
        station: { id: '0234', name: '홍대입구', nameEn: 'Hongik Univ.', lineId: '2' },
      },
      {
        stationId: '9999',
        isCommuteStation: false, // excluded by isCommuteStation filter
        station: { id: '9999', name: '잠실', nameEn: 'Jamsil', lineId: '2' },
      },
    ],
  })),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetParams = jest.fn();

const buildNavigation = () =>
  ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setParams: mockSetParams,
  }) as unknown;

const buildRoute = (
  selectionType: 'departure' | 'transfer' | 'arrival',
  overrides: Partial<{
    excludeStationIds: string[];
    currentName: string;
  }> = {},
) =>
  ({
    params: {
      selectionType,
      excludeStationIds: overrides.excludeStationIds ?? [],
      currentName: overrides.currentName,
    },
  }) as unknown;

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockSetParams.mockClear();
});

describe('OnboardingStationPickerScreen', () => {
  describe('header rendering by selection type', () => {
    it('shows "승차역 선택" for departure slot', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('departure') as never}
        />,
      );
      expect(getByText('승차역 선택')).toBeTruthy();
    });

    it('shows "환승역 선택" for transfer slot', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      expect(getByText('환승역 선택')).toBeTruthy();
    });

    it('shows "도착역 선택" for arrival slot', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('arrival') as never}
        />,
      );
      expect(getByText('도착역 선택')).toBeTruthy();
    });
  });

  describe('slot summary', () => {
    it('shows currentName when provided', () => {
      // Use transfer slot — browse-only mode renders the line list (강남/역삼/
      // 홍대입구) so we pick a currentName that does NOT appear in the list
      // ("합정") to avoid matching the browse rows.
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer', { currentName: '합정' }) as never}
        />,
      );
      expect(getByText('합정')).toBeTruthy();
    });

    it('shows placeholder when currentName is undefined', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('arrival') as never}
        />,
      );
      expect(getByText('역을 선택해주세요')).toBeTruthy();
    });
  });

  describe('mode toggle', () => {
    it('renders mode toggle for departure slot', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('departure') as never}
        />,
      );
      expect(getByText('직접 선택')).toBeTruthy();
    });

    it('hides mode toggle for transfer slot (browse-only MVP)', () => {
      const { queryByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      expect(queryByText('직접 선택')).toBeNull();
      expect(queryByText('추천 보기')).toBeNull();
    });

    it('defaults to recommend mode for arrival (toggle says "직접 선택")', () => {
      const { getByText, queryByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('arrival') as never}
        />,
      );
      // toggle invites switching to direct-select → label is "직접 선택"
      expect(getByText('직접 선택')).toBeTruthy();
      // browse-mode header should NOT render in recommend mode
      expect(queryByText(/총 \d+개역/)).toBeNull();
    });

    it('switches to browse mode when toggle pressed', () => {
      const { getByText, queryByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('departure') as never}
        />,
      );
      // Initially in recommend mode
      expect(queryByText(/총 \d+개역/)).toBeNull();
      fireEvent.press(getByText('직접 선택'));
      // Now in browse mode — header appears + toggle label flips
      expect(getByText(/총 \d+개역/)).toBeTruthy();
      expect(getByText('추천 보기')).toBeTruthy();
    });

    it('transfer slot starts in browse mode with line list visible', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      // Default 2호선 → 3 stations from mock
      expect(getByText('2호선 · 총 3개역')).toBeTruthy();
    });
  });

  describe('search input', () => {
    it('renders search bar with slot-aware placeholder', () => {
      const { getByPlaceholderText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('arrival') as never}
        />,
      );
      expect(getByPlaceholderText('도착역 이름으로 검색')).toBeTruthy();
    });

    it('filters browse-mode station list by query', () => {
      const { getByPlaceholderText, queryByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      // Default browse mode (transfer) shows all 3 stations on 2호선
      expect(queryByText('강남')).toBeTruthy();
      expect(queryByText('역삼')).toBeTruthy();
      fireEvent.changeText(getByPlaceholderText('환승역 이름으로 검색'), '강남');
      expect(queryByText('강남')).toBeTruthy();
      expect(queryByText('역삼')).toBeNull();
    });

    it('shows empty state when query has no matches', () => {
      const { getByPlaceholderText, getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      fireEvent.changeText(getByPlaceholderText('환승역 이름으로 검색'), '없는역');
      expect(getByText('"없는역"와 일치하는 역이 없어요')).toBeTruthy();
    });
  });

  describe('browse mode line tabs', () => {
    it('switches station list when a different line tab is pressed', () => {
      const { getByText, queryByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      // Initial: 2호선 (3 stations)
      expect(getByText('2호선 · 총 3개역')).toBeTruthy();
      fireEvent.press(getByText('3호선'));
      // After switch: 3호선 (1 station from mock)
      expect(getByText('3호선 · 총 1개역')).toBeTruthy();
      expect(queryByText('강남')).toBeNull();
      expect(getByText('교대')).toBeTruthy();
    });

    it('excludes stations listed in excludeStationIds', () => {
      const { getByText, queryByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={
            buildRoute('transfer', { excludeStationIds: ['0222'] }) as never
          }
        />,
      );
      // 강남 (0222) excluded; only 역삼 + 홍대입구 remain
      expect(getByText('2호선 · 총 2개역')).toBeTruthy();
      expect(queryByText('강남')).toBeNull();
      expect(getByText('역삼')).toBeTruthy();
    });
  });

  describe('selection (return path)', () => {
    it('calls navigation.navigate with merged pickedStation on browse pick', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('transfer') as never}
        />,
      );
      fireEvent.press(getByText('역삼'));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({
        name: 'CommuteRoute',
        params: {
          pickedStation: {
            selectionType: 'transfer',
            station: {
              stationId: '0223',
              stationName: '역삼',
              lineId: '2',
              lineName: '2호선',
            },
          },
        },
        merge: true,
      });
    });

    it('calls navigation.navigate with merged pickedStation on recommend pick', () => {
      const { getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('departure') as never}
        />,
      );
      // Recommend mode shows commute favorites — pick 강남 from list
      fireEvent.press(getByText('강남'));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith({
        name: 'CommuteRoute',
        params: {
          pickedStation: {
            selectionType: 'departure',
            station: {
              stationId: '0222',
              stationName: '강남',
              lineId: '2',
              lineName: '2호선',
            },
          },
        },
        merge: true,
      });
    });
  });

  describe('recommend mode empty state', () => {
    it('shows direct-select hint when no commute favorites match query', () => {
      const { getByPlaceholderText, getByText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('departure') as never}
        />,
      );
      fireEvent.changeText(
        getByPlaceholderText('승차역 이름으로 검색'),
        '존재하지않음',
      );
      expect(
        getByText('"존재하지않음"와 일치하는 즐겨찾기가 없어요'),
      ).toBeTruthy();
    });
  });

  describe('back navigation', () => {
    it('back button calls navigation.goBack', () => {
      const { getByLabelText } = render(
        <OnboardingStationPickerScreen
          navigation={buildNavigation() as never}
          route={buildRoute('departure') as never}
        />,
      );
      fireEvent.press(getByLabelText('뒤로'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});
