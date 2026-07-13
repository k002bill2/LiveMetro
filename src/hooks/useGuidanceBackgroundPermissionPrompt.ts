/**
 * useGuidanceBackgroundPermissionPrompt — decides whether the guidance screen
 * should show an inline "Always" (background) location permission nudge, and
 * owns the request / dismiss / open-settings actions.
 *
 * Background location is what lets guidance + alerts continue while the phone is
 * locked. Most users only granted foreground ("While Using"), so guidance is
 * suspended on lock. This hook surfaces a one-time, honest nudge:
 *   - hidden when: web, already granted, or the user previously dismissed it.
 *   - otherwise a 'prompt' the user can accept ("허용하기") or dismiss ("나중에").
 *   - on denial → 'settings' mode (the OS won't re-ask; deep-link to Settings).
 *
 * All async work is wrapped so nothing throws (error-handling rule): any failure
 * degrades to hidden. State updates are guarded by a mounted ref so a resolve
 * that completes after unmount can't setState.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { locationService } from '@/services/location/locationService';
import {
  startGuidanceBackgroundLocation,
  stopGuidanceBackgroundLocation,
} from '@/services/guidance/guidanceBackgroundLocationTask';
import {
  getGuidanceSession,
  isActiveGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';

/**
 * 백그라운드 추적을 시작하기 직전 활성 세션 여부를 재확인한다(J1). 활성 정의는 SSOT
 * 헬퍼를 따른다 — 로컬 완주(localCompletedAt) 세션도 비활성 취급(W1).
 */
const hasActiveGuidanceSession = (): boolean =>
  isActiveGuidanceSession(getGuidanceSession());

/**
 * 활성 세션이 남아있을 때만 백그라운드 위치 추적을 시작한다. start await(네이티브
 * 권한 체크/태스크 등록) 동안 세션이 종료됐을 수 있는데, 그 경우 앱 레벨 sync 훅의
 * stop이 태스크 등록 *전에* 실행됐을 수 있어 세션 없는 추적이 남는다 — 시작이 true로
 * 완료된 직후 세션을 재확인해 비활성이면 즉시 되돌린다(L1). 이 시점 이후의 종료는
 * sync 훅의 활성 전이 stop이 정상 커버한다.
 */
const startBackgroundLocationIfSessionActive = async (): Promise<void> => {
  if (!hasActiveGuidanceSession()) return;
  const started = await startGuidanceBackgroundLocation();
  if (started && !hasActiveGuidanceSession()) {
    await stopGuidanceBackgroundLocation();
  }
};

/** AsyncStorage key recording that the user dismissed the nudge (never re-ask). */
export const GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY =
  '@livemetro/guidance_bg_perm_prompt_dismissed';

export type GuidanceBackgroundPermissionStatus = 'hidden' | 'prompt' | 'settings';

export interface UseGuidanceBackgroundPermissionPromptResult {
  readonly status: GuidanceBackgroundPermissionStatus;
  /** Ask for background permission. Granted → start bg location + hide; denied → settings mode. */
  readonly requestPermission: () => Promise<void>;
  /** Record the dismissal (never ask again) + hide. */
  readonly dismiss: () => Promise<void>;
  /** Deep-link to the OS Settings app (settings mode). */
  readonly openSettings: () => void;
}

export const useGuidanceBackgroundPermissionPrompt = (
  options?: { readonly suspended?: boolean }
): UseGuidanceBackgroundPermissionPromptResult => {
    const [status, setStatus] = useState<GuidanceBackgroundPermissionStatus>('hidden');
    const mountedRef = useRef(true);
    useEffect(() => () => {
      mountedRef.current = false;
    }, []);

    // 화면-로컬 완주 신호(isAtEnd 전파). 원격 완료(commuteLogCompletedAt)가 오프라인/
    // 비로그인으로 안 올 수 있으므로, suspended=true면 배너·모든 start 경로를 중지한다
    // (S1, R1 wake-lock과 동일 클래스). ref로도 보관해 async continuation(module 경계
    // start 호출)이 최신 값을 읽게 한다.
    const suspended = options?.suspended ?? false;
    const suspendedRef = useRef(suspended);
    suspendedRef.current = suspended;
    // 백그라운드 위치 가용성(U1) — resolver가 한 번 확인해 저장한다. 불가 기기에서는
    // 권한을 허용해도 start가 조용히 실패하므로 배너·권한 요청 경로를 아예 막는다.
    const availableRef = useRef(true);

    // 세션을 반응형으로 구독 — 여정이 완료(commuteLogCompletedAt)되거나 종료되면
    // 배너를 즉시 숨긴다(N1). 화면은 완료 후에도 mount를 유지하므로, 훅이 세션 전이를
    // 관찰하지 않으면 끝난 여정에 배너가 살아남아 불필요한 Always 권한 요청을 유발한다.
    const session = useGuidanceSession();
    const sessionActive = isActiveGuidanceSession(session); // SSOT — 로컬 완주도 비활성(W1)
    useEffect(() => {
      if ((!sessionActive || suspended) && mountedRef.current) {
        setStatus('hidden');
      }
    }, [sessionActive, suspended]);

    // 활성 세션 + 미-suspended일 때만 백그라운드 추적을 시작한다(S1). 세션 재확인 및
    // 시작 후 stop 되돌림(L1)은 startBackgroundLocationIfSessionActive가 담당한다.
    const startTrackingIfEligible = useCallback(async (): Promise<void> => {
      if (suspendedRef.current) return;
      await startBackgroundLocationIfSessionActive();
      // T4: start await(권한/네이티브 등록) 동안 로컬 완료로 suspended가 켜졌을 수 있다.
      // 완료 effect의 stop이 등록 완료 *전*에 실행됐을 수 있고, L1의 세션 사후 확인은
      // 원격 미기록 시 세션을 여전히 활성으로 봐 못 잡는다 → 시작 후 suspended면 즉시 중지.
      if (suspendedRef.current) {
        await stopGuidanceBackgroundLocation();
      }
    }, []);

    // 배너 가시성 + 추적 시작을 결정하는 공용 로직 — 초기 마운트와 AppState 복귀가
    // 공유한다. 가용성(Android 위치 서비스 on/off = 가변 상태)까지 매번 재평가해,
    // 위치 서비스를 끈 채 시작했다가 같은 여정 중 켜도 복귀 시 복구되게 한다(V1/U1).
    const evaluateVisibility = useCallback(async (): Promise<void> => {
      try {
        if (Platform.OS === 'web') {
          if (mountedRef.current) setStatus('hidden');
          return;
        }
        const available = await Location.isBackgroundLocationAvailableAsync();
        availableRef.current = available;
        if (!available) {
          if (mountedRef.current) setStatus('hidden');
          return;
        }
        // 권한 확인을 dismissal보다 먼저(M1). granted면 dismissal 무관하게 시작+숨김.
        const permission = await Location.getBackgroundPermissionsAsync();
        if (permission.status === 'granted') {
          await startTrackingIfEligible();
          if (mountedRef.current) setStatus('hidden');
          return;
        }
        // 세션 스코프 dismissal(U2) — 현재 세션에서 dismiss했으면 숨김 유지.
        const dismissed = await AsyncStorage.getItem(GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY);
        const dismissSession = getGuidanceSession();
        if (
          dismissed !== null &&
          dismissSession !== null &&
          dismissed === String(dismissSession.startedAt)
        ) {
          if (mountedRef.current) setStatus('hidden');
          return;
        }
        // 미허용 + 미dismiss: 활성·미suspended면 배너 노출(O1). 영구거부→settings(M1).
        if (mountedRef.current && hasActiveGuidanceSession() && !suspendedRef.current) {
          setStatus(permission.canAskAgain === false ? 'settings' : 'prompt');
        }
      } catch {
        // 조회 실패 시 현 상태 유지(초기 마운트는 hidden에서 시작하므로 보수적).
      }
    }, [startTrackingIfEligible]);

    // Resolve initial visibility once on mount (공용 로직 재사용).
    useEffect(() => {
      void evaluateVisibility();
    }, [evaluateVisibility]);

    // Re-check on return from the OS Settings app. The user may grant "Always" in
    // Settings and come back — nothing else re-checks (useGuidanceBackgroundLocationSync
    // only reacts to a changed session key), so background→active must re-poll and,
    // if granted, start background location + hide the now-stale banner.
    //
    // O2: gate on the ACTIVE SESSION, not on `status !== 'hidden'`. A dismissed
    // banner is hidden, but the session is still active — the user may grant in
    // OS Settings, and we must start tracking on return even though no banner is
    // shown. Registering while the session is inactive is pointless (no journey).
    useEffect(() => {
      if (!sessionActive || suspended) return undefined;
      const appStateRef = { current: AppState.currentState };
      const subscription = AppState.addEventListener(
        'change',
        (nextState: AppStateStatus) => {
          const prev = appStateRef.current;
          appStateRef.current = nextState;
          if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
            // 복귀 시 가용성(위치 서비스 on/off = 가변 상태)까지 재평가해 배너·추적을
            // 다시 결정한다(V1) — 초기 resolver와 동일한 공용 로직.
            void evaluateVisibility();
          }
        }
      );
      return () => subscription.remove();
    }, [sessionActive, suspended, evaluateVisibility]);

    const requestPermission = useCallback(async (): Promise<void> => {
      // 여정이 이미 종료/완료(로컬 완주 suspended 포함)됐거나 백그라운드 위치 불가
      // 기기(U1)면 민감 권한 다이얼로그를 띄우지 않고 숨긴다 (N1 레이스 이중 방어).
      if (!hasActiveGuidanceSession() || suspendedRef.current || !availableRef.current) {
        if (mountedRef.current) setStatus('hidden');
        return;
      }
      try {
        const granted = await locationService.requestBackgroundPermission();
        if (granted) {
          // useGuidanceBackgroundLocationSync는 세션 키 변경에만 반응하므로,
          // 미드세션에 방금 얻은 권한으로 백그라운드 위치를 즉시 시작한다. 단,
          // 권한 요청 await 도중 안내가 종료/완주됐을 수 있어 시작 직전 세션·suspended 재확인.
          await startTrackingIfEligible();
          if (mountedRef.current) setStatus('hidden');
        } else if (mountedRef.current) {
          setStatus('settings');
        }
      } catch {
        if (mountedRef.current) setStatus('hidden');
      }
    }, [startTrackingIfEligible]);

    const dismiss = useCallback(async (): Promise<void> => {
      try {
        // "나중에"는 이 여정에서만 숨긴다(U2 정직성) — dismiss한 세션 키를 저장하고,
        // resolver는 같은 세션일 때만 배너를 억제한다. 세션이 없으면 억제하지 않는다.
        const current = getGuidanceSession();
        if (current !== null) {
          await AsyncStorage.setItem(
            GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY,
            String(current.startedAt)
          );
        }
      } catch {
        // 저장 실패해도 이 세션에서는 숨긴다.
      } finally {
        if (mountedRef.current) setStatus('hidden');
      }
    }, []);

    const openSettings = useCallback((): void => {
      // 여정이 종료됐으면 설정을 열지 않고 배너만 숨긴다(N1 이중 방어).
      if (!hasActiveGuidanceSession()) {
        if (mountedRef.current) setStatus('hidden');
        return;
      }
      void Linking.openSettings().catch(() => undefined);
    }, []);

    return { status, requestPermission, dismiss, openSettings };
  };

export default useGuidanceBackgroundPermissionPrompt;
