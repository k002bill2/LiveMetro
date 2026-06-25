/**
 * guidanceSessionStore — observable + AsyncStorage-persistent singleton holding
 * the route the user chose when tapping "이 경로로 길안내 시작" (route-search
 * CTA or the home commute card).
 *
 * Why a module store (mirrors `boardingSelectionStore`) instead of navigation
 * params: a Route carries 30+ per-hop segments — putting it in params taxes
 * navigation state serialization, and surfaces outside the guidance screen
 * (the "안내 중" home banner via {@link subscribe}/`useGuidanceSession`) need
 * access too.
 *
 * Persistence: the active session is mirrored to AsyncStorage so a commute
 * survives an app kill mid-journey. {@link hydrateGuidanceSession} restores it
 * on boot. A TTL guard ({@link isSessionExpired}) drops stale ("zombie")
 * sessions — yesterday's commute must never resurrect as today's banner.
 * `startedAt` is epoch-based, so backgrounding keeps elapsed time honest.
 *
 * Reads stay synchronous ({@link getGuidanceSession} returns the in-memory
 * copy) — hydration runs once at boot before any screen reads, and the CTA
 * sets the in-memory value synchronously before navigating.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GuidanceSession } from '@/models/guidance';

const STORAGE_KEY = '@livemetro/guidance_session';

/** A guidance session older than this (ms since startedAt) is treated as stale. */
export const GUIDANCE_SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3h — one commute leg upper bound

let current: GuidanceSession | null = null;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

/** Active guidance session, or null when none is in progress. */
export const getGuidanceSession = (): GuidanceSession | null => current;

/**
 * Subscribe to session changes (set / clear / hydrate). Returns an unsubscribe
 * function. Designed for `useSyncExternalStore` (see `useGuidanceSession`).
 */
export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** True when the session started more than {@link GUIDANCE_SESSION_TTL_MS} ago. */
export const isSessionExpired = (session: GuidanceSession, nowMs: number): boolean =>
  nowMs - session.startedAt > GUIDANCE_SESSION_TTL_MS;

/** Record the session (stored as a copy to defend against mutation) + persist. */
export const setGuidanceSession = (session: GuidanceSession): void => {
  current = { ...session };
  emit();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch((error) => {
    if (__DEV__) console.error('[guidanceSessionStore] persist failed', error);
  });
};

/** End any active guidance session + remove the persisted copy. */
export const clearGuidanceSession = (): void => {
  current = null;
  emit();
  AsyncStorage.removeItem(STORAGE_KEY).catch((error) => {
    if (__DEV__) console.error('[guidanceSessionStore] clear-persist failed', error);
  });
};

/**
 * Restore a persisted session on app boot. No-op when nothing is stored;
 * discards (and cleans up) an expired or malformed session. `nowMs` is
 * injectable for deterministic tests.
 */
export const hydrateGuidanceSession = async (nowMs: number = Date.now()): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as GuidanceSession;
    if (!parsed || typeof parsed.startedAt !== 'number' || isSessionExpired(parsed, nowMs)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    current = parsed;
    emit();
  } catch (error) {
    if (__DEV__) console.error('[guidanceSessionStore] hydrate failed', error);
  }
};
