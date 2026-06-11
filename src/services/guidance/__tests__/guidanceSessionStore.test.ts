/**
 * guidanceSessionStore — ephemeral CTA → guidance screen handoff singleton.
 * Mirrors boardingSelectionStore semantics: copy-on-set, session-only.
 */
import {
  getGuidanceSession,
  setGuidanceSession,
  clearGuidanceSession,
} from '../guidanceSessionStore';
import { createRoute } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

const makeSession = (): GuidanceSession => ({
  route: createRoute([
    {
      fromStationId: 's1',
      fromStationName: 'A',
      toStationId: 's2',
      toStationName: 'B',
      lineId: '2',
      lineName: '2호선',
      estimatedMinutes: 2,
      isTransfer: false,
    },
  ]),
  fromStationName: 'A',
  toStationName: 'B',
  startedAt: 1_700_000_000_000,
});

describe('guidanceSessionStore', () => {
  afterEach(() => {
    clearGuidanceSession();
  });

  it('returns null when no session is active', () => {
    expect(getGuidanceSession()).toBeNull();
  });

  it('stores and returns the session', () => {
    const session = makeSession();
    setGuidanceSession(session);
    expect(getGuidanceSession()).toEqual(session);
  });

  it('stores a copy — later mutation of the input does not leak in', () => {
    const session = makeSession();
    setGuidanceSession(session);
    (session as { toStationName: string }).toStationName = 'MUTATED';
    expect(getGuidanceSession()?.toStationName).toBe('B');
  });

  it('clears the session', () => {
    setGuidanceSession(makeSession());
    clearGuidanceSession();
    expect(getGuidanceSession()).toBeNull();
  });

  it('overwrites a previous session on set', () => {
    setGuidanceSession(makeSession());
    setGuidanceSession({ ...makeSession(), toStationName: 'C' });
    expect(getGuidanceSession()?.toStationName).toBe('C');
  });
});
