/**
 * useGuidanceBackgroundLocationSync — starts native background location while a
 * guidance session is ACTIVE and stops it otherwise. "Active" is the store SSOT
 * (isActiveGuidanceSession), used here as the real pure function so the W1
 * local-completion marker is exercised end-to-end: only the session hook and the
 * native task module are mocked.
 */
import { renderHook } from '@testing-library/react-native';
import { useGuidanceBackgroundLocationSync } from '../useGuidanceBackgroundLocationSync';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import {
  startGuidanceBackgroundLocation,
  stopGuidanceBackgroundLocation,
} from '@/services/guidance/guidanceBackgroundLocationTask';
import { createRoute, type RouteSegment } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

jest.mock('@/hooks/useGuidanceSession', () => ({
  useGuidanceSession: jest.fn(),
}));

jest.mock('@/services/guidance/guidanceBackgroundLocationTask', () => ({
  startGuidanceBackgroundLocation: jest.fn(() => Promise.resolve(true)),
  stopGuidanceBackgroundLocation: jest.fn(() => Promise.resolve()),
}));

const mockUseGuidanceSession = useGuidanceSession as jest.Mock;
const mockStart = startGuidanceBackgroundLocation as jest.Mock;
const mockStop = stopGuidanceBackgroundLocation as jest.Mock;

const seg: RouteSegment = {
  fromStationId: 's1',
  fromStationName: 'A',
  toStationId: 's2',
  toStationName: 'B',
  lineId: '2',
  lineName: '2호선',
  estimatedMinutes: 2,
  isTransfer: false,
};

const makeSession = (extra: Partial<GuidanceSession> = {}): GuidanceSession => ({
  route: createRoute([seg]),
  fromStationName: 'A',
  toStationName: 'B',
  startedAt: 1_000,
  ...extra,
});

describe('useGuidanceBackgroundLocationSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockResolvedValue(true);
    mockStop.mockResolvedValue(undefined);
  });

  it('starts background location for an active session', () => {
    mockUseGuidanceSession.mockReturnValue(makeSession());
    renderHook(() => useGuidanceBackgroundLocationSync());

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('does not start (stops) for a locally-completed session — no restart on hydrate (W1)', () => {
    // The screen marked arrival (localCompletedAt); a mid-TTL restart hydrates
    // this session. The SSOT treats it as inactive, so tracking must not restart.
    mockUseGuidanceSession.mockReturnValue(makeSession({ localCompletedAt: 5_000 }));
    renderHook(() => useGuidanceBackgroundLocationSync());

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('does not start for a remotely-completed session', () => {
    mockUseGuidanceSession.mockReturnValue(makeSession({ commuteLogCompletedAt: 5_000 }));
    renderHook(() => useGuidanceBackgroundLocationSync());

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('does not start when there is no session', () => {
    mockUseGuidanceSession.mockReturnValue(null);
    renderHook(() => useGuidanceBackgroundLocationSync());

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('stops when an active session transitions to locally completed (W1)', () => {
    mockUseGuidanceSession.mockReturnValue(makeSession());
    const { rerender } = renderHook(() => useGuidanceBackgroundLocationSync());
    expect(mockStart).toHaveBeenCalledTimes(1);

    mockUseGuidanceSession.mockReturnValue(makeSession({ localCompletedAt: 6_000 }));
    rerender(undefined);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});
