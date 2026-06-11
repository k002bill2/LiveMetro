/**
 * guidanceSessionStore — in-memory (JS-heap) singleton holding the route the
 * user chose on the route-search screen when tapping "이 경로로 길안내 시작".
 *
 * Why a module store (mirrors `boardingSelectionStore`) instead of navigation
 * params: a Route carries 30+ per-hop segments — putting it in params taxes
 * navigation state serialization, and future surfaces (e.g. a "안내 중" home
 * banner) need access outside the screen.
 *
 * Ephemeral by design: not persisted to AsyncStorage. A guidance session is
 * only meaningful while the app session that started it is alive; `startedAt`
 * is epoch-based, so backgrounding/foregrounding keeps elapsed time honest.
 */
import type { GuidanceSession } from '@/models/guidance';

let current: GuidanceSession | null = null;

/** Active guidance session, or null when none is in progress. */
export const getGuidanceSession = (): GuidanceSession | null => current;

/** Record the session (stored as a copy to defend against mutation). */
export const setGuidanceSession = (session: GuidanceSession): void => {
  current = { ...session };
};

/** End any active guidance session. */
export const clearGuidanceSession = (): void => {
  current = null;
};
