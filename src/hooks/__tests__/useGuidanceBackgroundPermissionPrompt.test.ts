/**
 * useGuidanceBackgroundPermissionPrompt — decides visibility of the "Always"
 * location nudge on the guidance screen and owns request/dismiss/settings.
 *
 * expo-location, AsyncStorage, locationService, and the background-location task
 * are mocked at their boundaries so each branch is driven deterministically.
 * Platform.OS is mutated per test (reset in afterEach); Linking.openSettings is
 * spied so the deep-link CTA can be asserted.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, Platform, Linking, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { locationService } from '@/services/location/locationService';
import {
  startGuidanceBackgroundLocation,
  stopGuidanceBackgroundLocation,
} from '@/services/guidance/guidanceBackgroundLocationTask';
import { getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import type { GuidanceSession } from '@/models/guidance';
import {
  useGuidanceBackgroundPermissionPrompt,
  GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY,
} from '../useGuidanceBackgroundPermissionPrompt';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-location', () => ({
  getBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
  isBackgroundLocationAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/services/location/locationService', () => ({
  locationService: {
    requestBackgroundPermission: jest.fn(() => Promise.resolve(false)),
  },
}));

jest.mock('@/services/guidance/guidanceBackgroundLocationTask', () => ({
  startGuidanceBackgroundLocation: jest.fn(() => Promise.resolve(true)),
  stopGuidanceBackgroundLocation: jest.fn(() => Promise.resolve()),
}));

// Partial mock: the real (pure) isActiveGuidanceSession SSOT runs so this suite
// exercises the true active-definition wiring; only getGuidanceSession is stubbed.
jest.mock('@/services/guidance/guidanceSessionStore', () => ({
  ...jest.requireActual('@/services/guidance/guidanceSessionStore'),
  getGuidanceSession: jest.fn(),
}));

jest.mock('@/hooks/useGuidanceSession', () => ({
  useGuidanceSession: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetBgPerm = Location.getBackgroundPermissionsAsync as jest.Mock;
const mockIsAvailable = Location.isBackgroundLocationAvailableAsync as jest.Mock;
const mockRequestBgPerm = locationService.requestBackgroundPermission as jest.Mock;
const mockStartBgLocation = startGuidanceBackgroundLocation as jest.Mock;
const mockStopBgLocation = stopGuidanceBackgroundLocation as jest.Mock;
const mockGetGuidanceSession = getGuidanceSession as jest.Mock;
const mockUseGuidanceSession = useGuidanceSession as jest.Mock;
const activeSession = { startedAt: 1000 } as unknown as GuidanceSession;
const completedSession = {
  startedAt: 1000,
  commuteLogCompletedAt: 5,
} as unknown as GuidanceSession;

describe('useGuidanceBackgroundPermissionPrompt', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockGetBgPerm.mockResolvedValue({ status: 'undetermined' });
    mockRequestBgPerm.mockResolvedValue(false);
    mockStartBgLocation.mockResolvedValue(true);
    mockStopBgLocation.mockResolvedValue(undefined);
    mockIsAvailable.mockResolvedValue(true); // 기본: 백그라운드 위치 가용
    mockGetGuidanceSession.mockReturnValue(activeSession); // 기본: 활성 세션
    mockUseGuidanceSession.mockReturnValue(activeSession); // 반응형 구독도 활성
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    jest.restoreAllMocks();
  });

  describe('initial visibility', () => {
    it('stays hidden on web', async () => {
      (Platform as { OS: string }).OS = 'web';
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.status).toBe('hidden');
      expect(mockGetItem).not.toHaveBeenCalled();
      expect(mockStartBgLocation).not.toHaveBeenCalled(); // web hidden 경로 → start 없음
    });

    it('stays hidden when not granted and dismissed for the SAME session (U2)', async () => {
      mockGetItem.mockResolvedValue('1000'); // activeSession.startedAt=1000 세션에서 dismiss
      // 미허용(undetermined) + 같은 세션 dismiss → 배너 숨김, start 없음.
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetItem).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
      expect(mockStartBgLocation).not.toHaveBeenCalled();
    });

    it('re-shows the banner for a DIFFERENT session (new startedAt) after a prior dismiss (U2)', async () => {
      mockGetItem.mockResolvedValue('999'); // 이전 여정(startedAt=999)에서 dismiss
      // 현재 세션은 startedAt=1000 → 키 불일치 → 재노출.
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
    });

    it('re-shows the banner for a legacy timestamp dismiss value (migration, U2)', async () => {
      mockGetItem.mockResolvedValue('1700000000000'); // 구버전 timestamp 값
      // startedAt=1000과 일치할 확률이 없어 무시 → 재노출.
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
    });

    it('stays hidden on a device where background location is unavailable (U1)', async () => {
      mockIsAvailable.mockResolvedValue(false);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockIsAvailable).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
      expect(mockGetBgPerm).not.toHaveBeenCalled(); // 권한 조회 경로 미진입
    });

    it('starts tracking on mount when dismissed but permission became granted mid-session (M1)', async () => {
      mockGetItem.mockResolvedValue(String(Date.now())); // 이전에 배너 dismiss
      mockGetBgPerm.mockResolvedValue({ status: 'granted' }); // 설정에서 Always 켜고 재진입
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockStartBgLocation).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('starts background location on mount when permission is already granted mid-session (L2)', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockStartBgLocation).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('stays hidden when background permission is already granted', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('shows the prompt when not granted and not dismissed', async () => {
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
    });

    it('starts in settings mode when permission is permanently denied (canAskAgain=false)', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'denied', canAskAgain: false });
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('settings'));
    });

    it('starts in prompt mode when the OS can still ask (canAskAgain=true)', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
    });

    it('stays hidden when the permission check throws', async () => {
      mockGetBgPerm.mockRejectedValue(new Error('permission read failed'));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });
  });

  describe('requestPermission', () => {
    it('starts background location and hides when permission is granted', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('hidden');
    });

    it('does not request permission on an unavailable device (U1)', async () => {
      mockIsAvailable.mockResolvedValue(false);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      }); // resolver 완료 → availableRef=false
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(mockRequestBgPerm).not.toHaveBeenCalled();
      expect(result.current.status).toBe('hidden');
    });

    it('switches to settings mode when permission is denied', async () => {
      mockRequestBgPerm.mockResolvedValue(false);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('settings');
    });

    it('does not start background location when the session ended during the permission await (J1)', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      mockGetGuidanceSession.mockReturnValue(null); // 배너 표시 후 안내가 종료됨

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('hidden');
    });

    it('does not start background location when the session is already completed', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      mockGetGuidanceSession.mockReturnValue({
        startedAt: 1000,
        commuteLogCompletedAt: 5,
      } as unknown as GuidanceSession);

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
    });

    it('stops background location when the session ends during the start await (L1)', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      mockStartBgLocation.mockResolvedValue(true);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      // requestPermission의 getGuidanceSession 호출 순서: ① 진입 가드(N1) ② start
      // 직전 가드 — 둘 다 활성, ③ start 완료 후 재확인 — 종료됨(start await 도중 종료 모사).
      mockGetGuidanceSession
        .mockReturnValueOnce(activeSession)
        .mockReturnValueOnce(activeSession)
        .mockReturnValue(null);

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).toHaveBeenCalledTimes(1);
      expect(mockStopBgLocation).toHaveBeenCalledTimes(1);
    });

    it('does not stop background location when the session stays active through the start', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      mockStartBgLocation.mockResolvedValue(true);
      // 기본 getGuidanceSession = activeSession (시작 전/후 모두 활성).
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).toHaveBeenCalledTimes(1);
      expect(mockStopBgLocation).not.toHaveBeenCalled();
    });

    it('hides silently when the request throws', async () => {
      mockRequestBgPerm.mockRejectedValue(new Error('request failed'));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.status).toBe('hidden');
    });
  });

  describe('dismiss', () => {
    it('persists the current session key on dismissal and hides (U2 session-scope)', async () => {
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.dismiss();
      });

      // 세션 키(activeSession.startedAt=1000)를 저장 — 이 여정에서만 억제.
      expect(mockSetItem).toHaveBeenCalledWith(
        GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY,
        '1000'
      );
      expect(result.current.status).toBe('hidden');
    });

    it('still hides when persisting the dismissal fails', async () => {
      mockSetItem.mockRejectedValue(new Error('storage full'));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.dismiss();
      });

      expect(result.current.status).toBe('hidden');
    });
  });

  describe('openSettings', () => {
    it('deep-links to the OS settings app', async () => {
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      act(() => {
        result.current.openSettings();
      });

      expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('re-check on return from Settings (AppState)', () => {
    const spyAppState = (
      remove: jest.Mock
    ): { getHandler: () => ((s: AppStateStatus) => void) | undefined } => {
      let handler: ((s: AppStateStatus) => void) | undefined;
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
        handler = cb as unknown as (s: AppStateStatus) => void;
        return { remove } as ReturnType<typeof AppState.addEventListener>;
      });
      return { getHandler: () => handler };
    };

    const goBackgroundThenActive = (
      handler: ((s: AppStateStatus) => void) | undefined
    ): void => {
      handler?.('background');
      handler?.('active');
    };

    it('starts tracking and hides when permission is granted after returning from Settings', async () => {
      mockRequestBgPerm.mockResolvedValue(false); // denial → settings mode
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.status).toBe('settings');

      // User grants "Always" in Settings and returns to the app.
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
      });

      await waitFor(() => expect(result.current.status).toBe('hidden'));
      expect(mockStartBgLocation).toHaveBeenCalledTimes(1);
    });

    it('does not start tracking on return from Settings when the session already ended (J1)', async () => {
      mockRequestBgPerm.mockResolvedValue(false); // denial → settings mode
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.status).toBe('settings');

      // 권한은 켜졌지만 안내가 종료됨 → 추적 재시작 금지.
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      mockGetGuidanceSession.mockReturnValue(null);
      await act(async () => {
        goBackgroundThenActive(getHandler());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
    });

    it('keeps the settings banner when permission is still not granted on return', async () => {
      mockRequestBgPerm.mockResolvedValue(false);
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.status).toBe('settings');

      // 여전히 영구 거부(settings 모드는 canAskAgain=false를 함의) → 복귀 재평가도 settings 유지.
      mockGetBgPerm.mockResolvedValue({ status: 'denied', canAskAgain: false });
      await act(async () => {
        goBackgroundThenActive(getHandler());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('settings');
    });

    it('re-evaluates availability on return — location services on + granted → start+hidden (V1)', async () => {
      mockIsAvailable.mockResolvedValue(false); // 위치 서비스 꺼짐 → 마운트 hidden
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockIsAvailable).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');

      // 시스템 설정에서 위치 서비스 켬 + 권한 granted → 복귀 시 재평가로 추적 시작.
      mockIsAvailable.mockResolvedValue(true);
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
      });

      await waitFor(() => expect(mockStartBgLocation).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('re-evaluates availability on return — location on + not granted → prompt re-shows (V1)', async () => {
      mockIsAvailable.mockResolvedValue(false);
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockIsAvailable).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');

      mockIsAvailable.mockResolvedValue(true);
      mockGetBgPerm.mockResolvedValue({ status: 'undetermined' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
      });

      await waitFor(() => expect(result.current.status).toBe('prompt'));
    });

    it('stays hidden on return when still unavailable (V1)', async () => {
      mockIsAvailable.mockResolvedValue(false);
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockIsAvailable).toHaveBeenCalled());

      // 복귀해도 여전히 unavailable — 권한이 있어도 hidden 유지·start 없음.
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.status).toBe('hidden');
      expect(mockStartBgLocation).not.toHaveBeenCalled();
    });

    it('does not register an AppState listener when the session is inactive', async () => {
      mockUseGuidanceSession.mockReturnValue(null); // 세션 비활성 → 리스너 불필요(O2 게이트)
      const addSpy = jest.spyOn(AppState, 'addEventListener');
      renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await act(async () => {
        await Promise.resolve();
      });
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('starts tracking on return from OS Settings even when dismissed (hidden) with an active session (O2)', async () => {
      mockGetItem.mockResolvedValue(String(Date.now())); // dismissed → 배너 hidden
      mockUseGuidanceSession.mockReturnValue(activeSession); // 세션은 여전히 활성
      const { getHandler } = spyAppState(jest.fn());
      renderHook(() => useGuidanceBackgroundPermissionPrompt());
      // 세션 활성이므로 dismissed-hidden이어도 리스너가 등록된다.
      await waitFor(() => expect(getHandler()).toBeDefined());

      // OS 설정에서 Always 켜고 복귀.
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
      });

      await waitFor(() => expect(mockStartBgLocation).toHaveBeenCalled());
    });

    it('does not register an AppState listener once the session becomes inactive', async () => {
      mockUseGuidanceSession.mockReturnValue(activeSession);
      const remove = jest.fn();
      spyAppState(remove);
      const { rerender } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      // 세션 완료 전이 → 리스너 제거.
      mockUseGuidanceSession.mockReturnValue(completedSession);
      rerender(undefined);
      expect(remove).toHaveBeenCalled();
    });

    it('removes the AppState listener on unmount', async () => {
      const remove = jest.fn();
      spyAppState(remove);
      const { result, unmount } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      unmount();
      expect(remove).toHaveBeenCalled();
    });
  });

  describe('session reactivity (N1)', () => {
    it('hides the banner when the journey completes mid-mount', async () => {
      mockUseGuidanceSession.mockReturnValue(activeSession);
      const { result, rerender } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      // 목적지 도착 — commuteLogCompletedAt 설정된 세션으로 전이(화면은 mount 유지).
      mockUseGuidanceSession.mockReturnValue(completedSession);
      rerender(undefined);

      expect(result.current.status).toBe('hidden');
    });

    it('hides the banner when the session clears (→ null)', async () => {
      mockUseGuidanceSession.mockReturnValue(activeSession);
      const { result, rerender } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      mockUseGuidanceSession.mockReturnValue(null);
      rerender(undefined);

      expect(result.current.status).toBe('hidden');
    });

    it('keeps hidden when the journey completes while the initial resolve is pending (O1)', async () => {
      // 초기 권한 조회를 pending으로 멈춰, 그 사이 세션 완료를 모사한다.
      let resolvePerm: (v: { status: string }) => void = () => undefined;
      mockGetBgPerm.mockReturnValue(
        new Promise((r) => {
          resolvePerm = r;
        })
      );
      mockUseGuidanceSession.mockReturnValue(activeSession);
      const { result, rerender } = renderHook(() => useGuidanceBackgroundPermissionPrompt());

      // 여정 완료 — 반응성 hide(status hidden) + 라이브 세션도 비활성.
      mockUseGuidanceSession.mockReturnValue(completedSession);
      mockGetGuidanceSession.mockReturnValue(completedSession);
      rerender(undefined);
      expect(result.current.status).toBe('hidden');

      // 초기 조회 continuation 완료(미허용) — O1 가드로 prompt로 되돌리지 않는다.
      await act(async () => {
        resolvePerm({ status: 'undetermined' });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.status).toBe('hidden');
    });

    it('does not request permission when the CTA is pressed after the journey ended (race guard)', async () => {
      mockUseGuidanceSession.mockReturnValue(activeSession); // 배너는 표시된 상태
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      mockGetGuidanceSession.mockReturnValue(null); // 액션 진입 시점엔 세션 종료

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockRequestBgPerm).not.toHaveBeenCalled();
      expect(result.current.status).toBe('hidden');
    });

    it('does not open Settings when the CTA is pressed after the journey ended (race guard)', async () => {
      mockUseGuidanceSession.mockReturnValue(activeSession);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      mockGetGuidanceSession.mockReturnValue(null); // 액션 진입 시점엔 세션 종료

      act(() => {
        result.current.openSettings();
      });

      expect(Linking.openSettings).not.toHaveBeenCalled();
      expect(result.current.status).toBe('hidden');
    });
  });

  describe('suspended (로컬 완주 전파, S1)', () => {
    it('suspended=true면 granted여도 배너 hidden + 초기 resolver start를 하지 않는다', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'granted' }); // 원래라면 start
      const { result } = renderHook(() =>
        useGuidanceBackgroundPermissionPrompt({ suspended: true })
      );
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
      expect(mockStartBgLocation).not.toHaveBeenCalled();
    });

    it('suspended=true면 미허용이어도 배너를 prompt로 띄우지 않는다', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'undetermined' });
      const { result } = renderHook(() =>
        useGuidanceBackgroundPermissionPrompt({ suspended: true })
      );
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('suspended=true면 requestPermission이 권한 요청 없이 숨긴다', async () => {
      const { result } = renderHook(() =>
        useGuidanceBackgroundPermissionPrompt({ suspended: true })
      );
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockRequestBgPerm).not.toHaveBeenCalled();
      expect(mockStartBgLocation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('hidden');
    });

    it('suspended=false(기본)면 기존 활성 경로가 동작한다 (회귀)', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      const { result } = renderHook(() =>
        useGuidanceBackgroundPermissionPrompt({ suspended: false })
      );
      await waitFor(() => expect(mockStartBgLocation).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('start await 중 suspended가 켜지면 시작 후 즉시 stop한다 (T4)', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      mockGetGuidanceSession.mockReturnValue(activeSession); // 세션 활성 유지(원격 미기록)
      // start를 in-flight로 멈춰 그 사이 suspended 전이를 모사한다.
      let resolveStart: (v: boolean) => void = () => undefined;
      mockStartBgLocation.mockReturnValue(
        new Promise<boolean>((r) => {
          resolveStart = r;
        })
      );
      const { result, rerender } = renderHook(
        ({ suspended }: { suspended: boolean }) =>
          useGuidanceBackgroundPermissionPrompt({ suspended }),
        { initialProps: { suspended: false } }
      );
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      let reqP: Promise<void> = Promise.resolve();
      await act(async () => {
        reqP = result.current.requestPermission();
        // requestBackgroundPermission + start await 진입까지 microtask flush.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      // start가 in-flight인 동안 로컬 완료로 suspended 전이.
      act(() => {
        rerender({ suspended: true });
      });
      await act(async () => {
        resolveStart(true);
        await reqP;
      });

      expect(mockStopBgLocation).toHaveBeenCalled();
    });
  });
});
