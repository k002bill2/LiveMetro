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
import { getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';

/**
 * 백그라운드 추적을 시작하기 직전 활성 세션 여부를 재확인한다. 허용 continuation이
 * await 중일 때 사용자가 안내를 종료했을 수 있으므로(세션 종료 후 추적 되살아남 방지, J1).
 */
const hasActiveGuidanceSession = (): boolean => {
  const session = getGuidanceSession();
  return session !== null && !session.commuteLogCompletedAt;
};

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

export const useGuidanceBackgroundPermissionPrompt =
  (): UseGuidanceBackgroundPermissionPromptResult => {
    const [status, setStatus] = useState<GuidanceBackgroundPermissionStatus>('hidden');
    const mountedRef = useRef(true);
    useEffect(() => () => {
      mountedRef.current = false;
    }, []);

    // 세션을 반응형으로 구독 — 여정이 완료(commuteLogCompletedAt)되거나 종료되면
    // 배너를 즉시 숨긴다(N1). 화면은 완료 후에도 mount를 유지하므로, 훅이 세션 전이를
    // 관찰하지 않으면 끝난 여정에 배너가 살아남아 불필요한 Always 권한 요청을 유발한다.
    const session = useGuidanceSession();
    const sessionActive = session !== null && !session.commuteLogCompletedAt;
    useEffect(() => {
      if (!sessionActive && mountedRef.current) {
        setStatus('hidden');
      }
    }, [sessionActive]);

    // Resolve initial visibility once on mount.
    useEffect(() => {
      const resolve = async (): Promise<void> => {
        try {
          if (Platform.OS === 'web') return; // 웹 최우선 — Wake Lock/권한 개념 밖.
          // 권한 확인을 dismissal보다 먼저 한다(M1). dismiss한 사용자가 세션 중 설정
          // 화면에서 Always를 켜고 재진입해도 start 가드가 실행돼야 하기 때문 — dismissal은
          // "미허용 상태에서 배너를 보일지"만 결정하는 UI 전용 게이트다.
          const permission = await Location.getBackgroundPermissionsAsync();
          if (permission.status === 'granted') {
            // 세션 중 외부(설정/권한 화면)에서 Always를 켜고 돌아온 경우, sync 훅은
            // 세션 키 불변이라 재시도하지 않는다 — 초기 resolver가 배너를 숨기면서
            // 백그라운드 추적도 시작한다(멱등: 이미 시작된 태스크는 no-op). L1의
            // 사후 재확인이 이 경로에도 그대로 적용된다(L2). dismissal과 무관하게 시작.
            await startBackgroundLocationIfSessionActive();
            return;
          }
          // 미허용 상태에서만 dismissal이 배너 노출을 막는다(UI 전용).
          const dismissed = await AsyncStorage.getItem(GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY);
          if (dismissed !== null) return;
          // 초기 권한/스토리지 조회가 pending인 동안 여정이 완료됐을 수 있다 — 라이브
          // 세션이 비활성이면 반응성 hide를 되돌리지 않도록 setStatus를 생략한다(O1).
          if (mountedRef.current && hasActiveGuidanceSession()) {
            // 이미 영구 거부(canAskAgain=false)면 in-app "허용하기"는 헛탭이므로
            // 바로 설정 모드로 시작한다 (설정 앱 딥링크로 유도).
            setStatus(permission.canAskAgain === false ? 'settings' : 'prompt');
          }
        } catch {
          // 조용히 숨김 유지 — 권한/스토리지 조회 실패는 배너를 띄우지 않는다.
        }
      };
      void resolve();
    }, []);

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
      if (!sessionActive) return undefined;
      const appStateRef = { current: AppState.currentState };
      const recheck = async (): Promise<void> => {
        try {
          const permission = await Location.getBackgroundPermissionsAsync();
          if (permission.status === 'granted') {
            // 설정 왕복 await 도중 안내가 종료됐을 수 있어 시작 직전 세션 재확인(J1).
            await startBackgroundLocationIfSessionActive();
            if (mountedRef.current) setStatus('hidden');
          }
          // 미허용이면 현 status 유지 (settings면 settings, dismissed-hidden이면 hidden).
        } catch {
          // 재확인 실패 시 현 상태를 유지한다 (배너를 강제로 숨기지 않는다).
        }
      };
      const subscription = AppState.addEventListener(
        'change',
        (nextState: AppStateStatus) => {
          const prev = appStateRef.current;
          appStateRef.current = nextState;
          if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
            void recheck();
          }
        }
      );
      return () => subscription.remove();
    }, [sessionActive]);

    const requestPermission = useCallback(async (): Promise<void> => {
      // 여정이 이미 종료/완료됐으면 민감 권한 다이얼로그를 띄우지 않고 숨긴다
      // (N1 레이스 이중 방어 — 반응형 hide와 별개로 액션 진입부에서도 확인).
      if (!hasActiveGuidanceSession()) {
        if (mountedRef.current) setStatus('hidden');
        return;
      }
      try {
        const granted = await locationService.requestBackgroundPermission();
        if (granted) {
          // useGuidanceBackgroundLocationSync는 세션 키 변경에만 반응하므로,
          // 미드세션에 방금 얻은 권한으로 백그라운드 위치를 즉시 시작한다. 단,
          // 권한 요청 await 도중 안내가 종료됐을 수 있어 시작 직전 세션을 재확인한다(J1).
          await startBackgroundLocationIfSessionActive();
          if (mountedRef.current) setStatus('hidden');
        } else if (mountedRef.current) {
          setStatus('settings');
        }
      } catch {
        if (mountedRef.current) setStatus('hidden');
      }
    }, []);

    const dismiss = useCallback(async (): Promise<void> => {
      try {
        await AsyncStorage.setItem(
          GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY,
          String(Date.now())
        );
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
