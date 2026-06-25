/**
 * useGuidanceSession — reactive read of the active guidance session.
 *
 * Wraps `guidanceSessionStore` via useSyncExternalStore so any surface (the
 * "안내 중" home banner, future status chips) re-renders the moment a session
 * starts, ends, or is hydrated on boot. The store's `subscribe` already returns
 * an unsubscribe fn, so React handles listener cleanup automatically.
 */
import { useSyncExternalStore } from 'react';
import {
  subscribe,
  getGuidanceSession,
} from '@services/guidance/guidanceSessionStore';
import type { GuidanceSession } from '@/models/guidance';

export function useGuidanceSession(): GuidanceSession | null {
  return useSyncExternalStore(subscribe, getGuidanceSession, getGuidanceSession);
}

export default useGuidanceSession;
