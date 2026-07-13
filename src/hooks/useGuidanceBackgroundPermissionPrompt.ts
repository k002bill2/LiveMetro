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
import { startGuidanceBackgroundLocation } from '@/services/guidance/guidanceBackgroundLocationTask';

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

    // Resolve initial visibility once on mount.
    useEffect(() => {
      const resolve = async (): Promise<void> => {
        try {
          if (Platform.OS === 'web') return;
          const dismissed = await AsyncStorage.getItem(GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY);
          if (dismissed !== null) return;
          const permission = await Location.getBackgroundPermissionsAsync();
          if (permission.status === 'granted') return;
          if (mountedRef.current) {
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

    // Re-check on return from the OS Settings app. When the nudge is visible
    // (esp. 'settings' mode), the user may grant "Always" in Settings and come
    // back — nothing else re-checks (useGuidanceBackgroundLocationSync only
    // reacts to a changed session key), so background→active must re-poll and,
    // if granted, start background location + dismiss the now-stale banner.
    useEffect(() => {
      if (status === 'hidden') return undefined;
      const appStateRef = { current: AppState.currentState };
      const recheck = async (): Promise<void> => {
        try {
          const permission = await Location.getBackgroundPermissionsAsync();
          if (permission.status === 'granted') {
            await startGuidanceBackgroundLocation();
            if (mountedRef.current) setStatus('hidden');
          }
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
    }, [status]);

    const requestPermission = useCallback(async (): Promise<void> => {
      try {
        const granted = await locationService.requestBackgroundPermission();
        if (granted) {
          // useGuidanceBackgroundLocationSync는 세션 키 변경에만 반응하므로,
          // 미드세션에 방금 얻은 권한으로 백그라운드 위치를 즉시 시작한다.
          await startGuidanceBackgroundLocation();
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
      void Linking.openSettings().catch(() => undefined);
    }, []);

    return { status, requestPermission, dismiss, openSettings };
  };

export default useGuidanceBackgroundPermissionPrompt;
