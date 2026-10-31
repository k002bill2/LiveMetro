/**
 * CommuteRouteScreen Test Suite — Wanted handoff redesign.
 *
 * Validates the redesigned step 2/4: stacked station card with departure/
 * arrival rows, transfer recommendation list (radio), and footer summary.
 * The legacy "이전" button + transfer-add modal pattern was retired.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CommuteRouteScreen } from '../CommuteRouteScreen';
import { saveCommuteRoutes } from '@/services/commute/commuteService';
import { routeVia } from '@/services/route/routeVia';
import { resolveInternalStationId } from '@/utils/stationIdResolver';

jest.mock('lucide-react-native', () => ({
  ArrowRight: 'ArrowRight',
  Building2: 'Building2',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Home: 'Home',
  Repeat: 'Repeat',
  Search: 'Search',
  Zap: 'Zap',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: jest.fn(() => ({ isDark: false })),
}));

// OnbHeader imports useTheme from the themeContext path directly — mocking
// only the index alias above would still bubble up ThemeProvider errors.
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

// LineBadge is exercised heavily by other tests; for this screen we just
// stub it so the recommendation list renders without pulling the real
// design-system barrel (atom cascade trap — see feedback memory).
jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: 'LineBadge',
}));

const mockOnSkip = jest.fn();
jest.mock('@/navigation/onboardingCallbacks', () => ({
  // CommuteRouteScreen now uses the optional variant so it can also host
  // the in-settings EditCommuteRoute flow (no provider). Tests live in
  // onboarding context, so both variants resolve the same callbacks.
  // Use implementation callbacks (not factory-time literals) so the
  // closure captures `mockOnSkip` after its TDZ resolves.
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
  useOnboardingCallbacksOptional: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
}));

// Phase: edit-mode-in-settings — CommuteRouteScreen now also hosts the
// SettingsStack.EditCommuteRoute route and calls useAuth() so save can
// target the current user. Onboarding tests don't exercise save, but the
// hook still runs on mount so it needs a stub provider.
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'test-uid' } })),
}));

// Same reason: the edit-mode save path calls saveCommuteRoutes. Onboarding
// tests never trigger it, but the module is imported at file scope.
jest.mock('@/services/commute/commuteService', () => ({
  saveCommuteRoutes: jest.fn(),
}));

// Keep the model module live so DEFAULT_COMMUTE_NOTIFICATIONS / TransferStation
// type-check at compile time. Importing for real is fine — it has no native deps.

// 경로 서비스는 전부 실제 구현을 쓴다 — 옵션 분은 설정 카드·홈과 같은 path
// SSOT(selectCommuteRoute → getDiverseRoutes / routeVia)로 계산되므로, 이 seam을
// 목으로 바꾸면 두 화면이 같은 이름·분을 보이는지 증명할 수 없다.
jest.mock('@/services/route', () => ({
  getDiverseRoutes: (...args: unknown[]) =>
    jest.requireActual('@/services/route').getDiverseRoutes(...args),
}));
// 검색 결과 1건당 routeVia를 1회 부른다. 디바운스가 걸렸는지는 "타이핑 직후
// 호출 0"으로만 직접 증명할 수 있어 이 seam을 센다(구현은 실제 그대로).
jest.mock('@/services/route/routeVia', () => {
  const actual = jest.requireActual('@/services/route/routeVia');
  return {
    ...actual,
    routeVia: jest.fn((...args: Parameters<typeof actual.routeVia>) =>
      actual.routeVia(...args),
    ),
  };
});

/** 화면과 같은 반올림 규칙으로 계산한 SSOT 분 (via 경로). */
const ssotViaMinutes = (depId: string, viaSlug: string, arrId: string): number => {
  const route = jest
    .requireActual('@/services/route/routeVia')
    .routeVia(resolveInternalStationId(depId), viaSlug, resolveInternalStationId(arrId));
  return Math.max(1, Math.round(route.totalMinutes));
};

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockCanGoBack = jest.fn(() => true);

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
  setParams: mockSetParams,
} as unknown;

const mockRoute = {
  params: {
    commuteType: 'morning' as const,
    departureTime: '08:30',
  },
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockSetParams.mockClear();
  mockCanGoBack.mockClear();
  mockCanGoBack.mockReturnValue(true);
  mockOnSkip.mockClear();
});

describe('CommuteRouteScreen (step 2/4 redesign)', () => {
  it('renders the OnbHeader with back + skip controls', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByTestId('onb-header')).toBeTruthy();
    expect(getByTestId('onb-header-back')).toBeTruthy();
    expect(getByTestId('onb-header-skip')).toBeTruthy();
  });

  it('renders Wanted handoff eyebrow + 2-line title', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByTestId('commute-eyebrow').props.children).toContain('STEP 2');
    expect(getByTestId('commute-title').props.children).toContain('어디서 어디까지');
  });

  it('shows departure + arrival station rows with placeholders', () => {
    const { getByText, getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByTestId('station-row-departure')).toBeTruthy();
    expect(getByTestId('station-row-arrival')).toBeTruthy();
    expect(getByText('출발역')).toBeTruthy();
    expect(getByText('도착역')).toBeTruthy();
    expect(getByText('출발역을 검색하세요')).toBeTruthy();
    expect(getByText('도착역을 검색하세요')).toBeTruthy();
  });

  it('OnbHeader back button calls navigation.goBack', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('onb-header-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('OnbHeader skip link fires onSkip from OnboardingNavigator context', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('onb-header-skip'));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('does not navigate forward while stations are unselected (CTA disabled)', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('commute-next'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the OnboardingStationPicker when a station row is pressed', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('station-row-departure'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'OnboardingStationPicker',
      expect.objectContaining({ selectionType: 'departure' }),
    );
  });

  // Policy: 기본=최단. For a cross-line OD with no single-line 직행, the default
  // selection must be the app's fastest route ("최단 경로 (자동)") — NOT an
  // auto-forced first transfer (신도림) — and the hint must not falsely claim
  // "직행이 가장 빨라요".
  it('cross-line OD defaults to "최단 경로 (자동)" with an honest hint (no auto-forced transfer)', () => {
    const editRoute = {
      name: 'EditCommuteRoute',
      params: {
        kind: 'morning',
        initial: {
          departureTime: '08:30',
          departureStation: {
            stationId: 's_1032',
            stationName: '신길',
            lineId: '1',
            lineName: '1호선',
          },
          arrivalStation: {
            stationId: 'seolleung',
            stationName: '선릉',
            lineId: '2',
            lineName: '2호선',
          },
          transferStations: [],
        },
      },
    };

    const { getAllByText, queryByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={editRoute as never}
      />,
    );

    // "최단 경로 (자동)" appears as both the default gate value and a radio
    // option — at least one proves the default is the fastest route.
    expect(getAllByText('최단 경로 (자동)').length).toBeGreaterThan(0);
    // The default must NOT auto-force the first transfer (신도림).
    expect(queryByText('신도림 환승')).toBeNull();
    // No false 직행 claim for a cross-line pair with no direct ride.
    expect(queryByText(/직행이 가장 빨라요/)).toBeNull();
  });

  // Edit-mode degenerate path: when the edited leg has no counterpart
  // (`otherLeg` absent), the opposite slot is materialised by REVERSING the
  // edited leg — endpoints swapped + transfer chain reversed — with the
  // opposite direction's default departure time ('18:30' for the evening slot
  // when editing morning), not a duplicate of the edited leg.
  it('edit mode without otherLeg reverses the edited leg into the opposite slot', async () => {
    (saveCommuteRoutes as jest.Mock).mockReset();
    (saveCommuteRoutes as jest.Mock).mockResolvedValue({ success: true });

    const editRoute = {
      name: 'EditCommuteRoute',
      params: {
        kind: 'morning',
        initial: {
          departureTime: '08:30',
          departureStation: {
            stationId: 'dep-id',
            stationName: '신길',
            lineId: '1',
            lineName: '1호선',
          },
          arrivalStation: {
            stationId: 'arr-id',
            stationName: '선릉',
            lineId: '2',
            lineName: '2호선',
          },
          transferStations: [],
        },
        // otherLeg intentionally absent → the evening slot is reversed.
      },
    };

    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={editRoute as never}
      />,
    );
    fireEvent.press(getByTestId('commute-next'));

    await waitFor(() => expect(saveCommuteRoutes).toHaveBeenCalledTimes(1));
    expect(saveCommuteRoutes).toHaveBeenCalledWith(
      'test-uid',
      // morning slot = edited leg (unchanged direction + time).
      expect.objectContaining({
        departureTime: '08:30',
        departureStationId: 'dep-id',
        departureStationName: '신길',
        arrivalStationId: 'arr-id',
        arrivalStationName: '선릉',
      }),
      // evening slot = reversed edited leg with the default evening time.
      expect.objectContaining({
        departureTime: '18:30',
        departureStationId: 'arr-id',
        departureStationName: '선릉',
        departureLineId: '2',
        arrivalStationId: 'dep-id',
        arrivalStationName: '신길',
        arrivalLineId: '1',
        transferStations: [],
      }),
    );
  });

  // 경로 교체 = 종점행 선호 무효화. setDoc({merge:true})는 생략된 필드를 보존하므로
  // 명시적으로 빈 맵을 실어야 옛 선호가 새 경로에 재부착되지 않는다(같은 역·노선인데
  // 목적지만 바뀐 편집에서 도달 불가한 종점 선택이 살아남는 결함).
  it('edit mode invalidates the edited leg 종점행 선호 but leaves otherLeg untouched', async () => {
    (saveCommuteRoutes as jest.Mock).mockReset();
    (saveCommuteRoutes as jest.Mock).mockResolvedValue({ success: true });

    const editRoute = {
      name: 'EditCommuteRoute',
      params: {
        kind: 'morning',
        initial: {
          departureTime: '08:30',
          departureStation: {
            stationId: 'dep-id',
            stationName: '신길',
            lineId: '1',
            lineName: '1호선',
          },
          arrivalStation: {
            stationId: 'arr-id',
            stationName: '선릉',
            lineId: '2',
            lineName: '2호선',
          },
          transferStations: [],
        },
        otherLeg: {
          departureTime: '18:30',
          departureStation: {
            stationId: 'arr-id',
            stationName: '선릉',
            lineId: '2',
            lineName: '2호선',
          },
          arrivalStation: {
            stationId: 'dep-id',
            stationName: '신길',
            lineId: '1',
            lineName: '1호선',
          },
          transferStations: [],
        },
      },
    };

    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={editRoute as never}
      />,
    );
    fireEvent.press(getByTestId('commute-next'));

    await waitFor(() => expect(saveCommuteRoutes).toHaveBeenCalledTimes(1));
    const [, morningArg, eveningArg] = (saveCommuteRoutes as jest.Mock).mock.calls[0];
    // 편집한 leg = 교체 → 빈 맵을 명시해 원격 선호를 지운다.
    expect(morningArg.boardingPreferences).toEqual({});
    // 손대지 않은 leg = 필드 생략 → merge가 저장된 선호를 그대로 보존한다.
    // (nav 파라미터 타입 OnboardingRouteData에 선호가 없어 여기서 {}를 쓰면 유실된다.)
    expect('boardingPreferences' in eveningArg).toBe(false);
  });

  // 추천 목록의 분은 설정 카드·홈과 같은 path SSOT로 계산한다(실그래프, 서비스 목 없음).
  // 근사치(LINE_STATIONS 인덱스 거리) 시절엔 산곡→선릉에서 자동이 "소요 시간 미상",
  // 대림 77분이 강남구청 84분보다 위라 SSOT(강남구청 75.8분)와 순서가 뒤집혔다.
  describe('환승역 추천 분 = 경로 SSOT', () => {
    const SANGOK = { stationId: '3762', stationName: '산곡', lineId: '7', lineName: '' };
    const SEOLLEUNG = { stationId: '0220', stationName: '선릉', lineId: '2', lineName: '' };
    const editRoute = {
      name: 'EditCommuteRoute',
      params: {
        kind: 'morning',
        initial: {
          departureTime: '08:30',
          departureStation: SANGOK,
          arrivalStation: SEOLLEUNG,
          transferStations: [],
        },
      },
    };
    const optionIds = (utils: ReturnType<typeof render>): string[] =>
      utils
        .getAllByTestId(/^route-option-[a-z_]+$/)
        .map((n) => String(n.props.testID).replace('route-option-', ''));
    const minutesOf = (utils: ReturnType<typeof render>, id: string): string | undefined =>
      String(utils.getByTestId(`route-option-${id}`).props.accessibilityLabel).match(
        /, (\d+)분$/,
      )?.[1];

    it('산곡→선릉: 자동 76분 ≤ 강남구청 76분 ≤ 대림 77분, 미상 없이 SSOT 순으로 보인다', () => {
      const utils = render(
        <CommuteRouteScreen navigation={mockNavigation as never} route={editRoute as never} />,
      );

      expect(optionIds(utils)).toEqual([
        'fastest',
        'gangnam_gu_office',
        'daelim',
        'konkuk_univ',
      ]);
      expect(minutesOf(utils, 'fastest')).toBe('76');
      expect(minutesOf(utils, 'gangnam_gu_office')).toBe('76');
      expect(minutesOf(utils, 'daelim')).toBe('77');
      expect(minutesOf(utils, 'konkuk_univ')).toBe('89');
      // 같은 역의 개별 옵션과 자동 옵션은 같은 SSOT 경로 → 같은 분.
      expect(minutesOf(utils, 'gangnam_gu_office')).toBe(
        String(ssotViaMinutes('3762', 'gangnam_gu_office', '0220')),
      );
      expect(utils.queryAllByText('소요 시간 미상')).toHaveLength(0);
    });

    it('온보딩 모드에서도 자동 옵션에 SSOT 분을 보인다 (라벨 확장은 편집 모드만)', () => {
      const pick = (selectionType: 'departure' | 'arrival', station: typeof SANGOK) => ({
        name: 'CommuteRoute',
        params: { pickedStation: { selectionType, station } },
      });
      const utils = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={pick('departure', SANGOK) as never}
        />,
      );
      utils.rerender(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={pick('arrival', SEOLLEUNG) as never}
        />,
      );

      expect(minutesOf(utils, 'fastest')).toBe('76');
      expect(utils.getByTestId('route-option-fastest').props.accessibilityLabel).toBe(
        '최단 경로 (자동), 76분',
      );
      expect(utils.queryAllByText('소요 시간 미상')).toHaveLength(0);
    });

    it('검색으로 찾은 환승역 분도 같은 routeVia SSOT로 계산한다', () => {
      jest.useFakeTimers();
      try {
        const utils = render(
          <CommuteRouteScreen navigation={mockNavigation as never} route={editRoute as never} />,
        );
        fireEvent.changeText(utils.getByTestId('recommend-search'), '왕십리');
        act(() => {
          jest.advanceTimersByTime(200);
        });

        const expected = ssotViaMinutes('3762', 'wangsimni', '0220');
        expect(utils.getByLabelText(`왕십리, ${expected}분`)).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // 편집 진입 시 저장된 환승역 복원. 산곡(7)→선릉(2)은 직행이 없는 교차 노선이라
  // 추천 = [fastest, gangnam_gu_office, daelim, konkuk_univ](SSOT 분 순). 검색으로 고른 환승역은
  // station_cd(강남구청 = 2732)로 저장되므로 그 ID로도 선택이 복원돼야 한다.
  describe('편집 모드 환승역 복원', () => {
    const editRouteWith = (transferStations: unknown[]) => ({
      name: 'EditCommuteRoute',
      params: {
        kind: 'morning',
        initial: {
          departureTime: '08:30',
          departureStation: { stationId: '3762', stationName: '산곡', lineId: '7', lineName: '' },
          arrivalStation: { stationId: '0220', stationName: '선릉', lineId: '2', lineName: '' },
          transferStations,
        },
      },
    });
    const renderEdit = (transferStations: unknown[]) =>
      render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={editRouteWith(transferStations) as never}
        />,
      );
    const isSelected = (
      utils: ReturnType<typeof render>,
      optionId: string,
    ): boolean =>
      utils.getByTestId(`route-option-${optionId}`).props.accessibilityState?.selected === true;
    const savedMorningTransfers = async (): Promise<unknown[]> => {
      await waitFor(() => expect(saveCommuteRoutes).toHaveBeenCalledTimes(1));
      const [, morningArg] = (saveCommuteRoutes as jest.Mock).mock.calls[0];
      return morningArg.transferStations;
    };

    beforeEach(() => {
      (saveCommuteRoutes as jest.Mock).mockReset();
      (saveCommuteRoutes as jest.Mock).mockResolvedValue({ success: true });
    });

    it('station_cd(2732)로 저장된 강남구청을 선택 상태로 복원하고 저장 시 유지한다', async () => {
      const utils = renderEdit([
        { stationId: '2732', stationName: '강남구청', lineId: '7', lineName: '', order: 1 },
      ]);

      expect(isSelected(utils, 'gangnam_gu_office')).toBe(true);
      expect(isSelected(utils, 'fastest')).toBe(false);
      expect(utils.getByText('강남구청 환승')).toBeTruthy();

      fireEvent.press(utils.getByTestId('commute-next'));
      const transfers = await savedMorningTransfers();
      expect(transfers).toEqual([
        expect.objectContaining({ stationName: '강남구청', order: 1 }),
      ]);
    });

    it('그래프 ID로 저장된 환승역은 기존처럼 그대로 선택된다', async () => {
      const utils = renderEdit([
        { stationId: 'gangnam_gu_office', stationName: '강남구청', lineId: '7', lineName: '', order: 1 },
      ]);

      expect(isSelected(utils, 'gangnam_gu_office')).toBe(true);

      fireEvent.press(utils.getByTestId('commute-next'));
      const transfers = await savedMorningTransfers();
      expect(transfers).toEqual([
        expect.objectContaining({ stationId: 'gangnam_gu_office', stationName: '강남구청' }),
      ]);
    });

    it('추천 목록 밖 환승역은 버리지 않고 선택된 옵션으로 보존해 그대로 저장한다', async () => {
      const utils = renderEdit([
        { stationId: '0208', stationName: '왕십리', lineId: '2', lineName: '', order: 1 },
      ]);

      expect(isSelected(utils, 'fastest')).toBe(false);
      expect(utils.getByText('왕십리 환승')).toBeTruthy();

      fireEvent.press(utils.getByTestId('commute-next'));
      const transfers = await savedMorningTransfers();
      expect(transfers).toEqual([
        expect.objectContaining({ stationId: '0208', stationName: '왕십리', lineId: '2', order: 1 }),
      ]);
    });

    it('저장값이 비어 있으면 fastest를 선택하고 SSOT로 계산한 환승역을 함께 보여준다', async () => {
      const utils = renderEdit([]);

      expect(isSelected(utils, 'fastest')).toBe(true);
      // 설정 카드와 같은 seam(useCommuteRouteSteps)으로 계산한 실제 환승역.
      expect(utils.getByText('최단 경로 (자동) · 강남구청 환승')).toBeTruthy();
      expect(utils.getByTestId('commute-footer')).toHaveTextContent(
        '산곡 → 선릉 · 최단 경로 (자동) · 강남구청 환승',
      );

      // 표시만 바뀐다 — fastest는 계속 빈 배열로 저장된다.
      fireEvent.press(utils.getByTestId('commute-next'));
      expect(await savedMorningTransfers()).toEqual([]);
    });

    it('도착역을 바꿔 저장된 선택이 무의미해지면 첫 옵션으로 리셋한다', () => {
      const utils = renderEdit([
        { stationId: '0208', stationName: '왕십리', lineId: '2', lineName: '', order: 1 },
      ]);
      expect(utils.queryByTestId('route-option-search-0208')).not.toBeNull();

      const changed = editRouteWith([
        { stationId: '0208', stationName: '왕십리', lineId: '2', lineName: '', order: 1 },
      ]);
      utils.rerender(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={{
            ...changed,
            params: {
              ...changed.params,
              pickedStation: {
                selectionType: 'arrival',
                station: { stationId: '0222', stationName: '강남', lineId: '2', lineName: '' },
              },
            },
          } as never}
        />,
      );

      expect(utils.queryByTestId('route-option-search-0208')).toBeNull();
      expect(utils.queryByText('왕십리 환승')).toBeNull();
    });
  });

  describe('환승역 검색 디바운스', () => {
    const pickRoute = (
      selectionType: 'departure' | 'arrival',
      stationId: string,
      stationName: string,
      lineId: string,
    ) => ({
      params: {
        pickedStation: { selectionType, station: { stationId, stationName, lineId } },
      },
    });

    /** 출발/도착이 모두 선택돼야 검색 UI가 렌더된다. picker 핸드오프는
     *  route.params 병합으로 오므로 rerender 두 번으로 재현한다. */
    const renderWithBothStations = () => {
      const utils = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={pickRoute('departure', '0222', '강남', '2') as never}
        />,
      );
      utils.rerender(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={pickRoute('arrival', '0239', '홍대입구', '2') as never}
        />,
      );
      return utils;
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('타이핑 직후에는 경로 계산을 돌리지 않는다', () => {
      jest.useFakeTimers();
      const { getByTestId } = renderWithBothStations();
      (routeVia as jest.Mock).mockClear();

      fireEvent.changeText(getByTestId('recommend-search'), '왕십리');

      expect(routeVia).not.toHaveBeenCalled();
    });

    it('입력이 멈추면 그때 계산한다', () => {
      jest.useFakeTimers();
      const { getByTestId } = renderWithBothStations();
      (routeVia as jest.Mock).mockClear();

      fireEvent.changeText(getByTestId('recommend-search'), '왕십리');
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(routeVia).toHaveBeenCalled();
    });

    it('연속 입력은 마지막 한 번만 계산한다', () => {
      jest.useFakeTimers();
      const { getByTestId } = renderWithBothStations();
      const input = getByTestId('recommend-search');
      (routeVia as jest.Mock).mockClear();

      // 디바운스 창 안에서 연타 — 중간 값들은 계산되지 않아야 한다.
      // 마지막 값은 실제 역명이어야 한다("왕십리역"은 매칭 0건이라 계산 자체가 없다).
      for (const text of ['왕', '왕십', '왕십리']) {
        fireEvent.changeText(input, text);
        act(() => {
          jest.advanceTimersByTime(50);
        });
      }
      expect(routeVia).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(routeVia).toHaveBeenCalled();
    });
  });
});
