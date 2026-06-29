/**
 * guidanceCommuteLogService — bridges live guidance sessions to commute logs.
 *
 * A guidance session is the strongest signal that a real commute happened:
 * the user explicitly chose a route and started turn-by-turn guidance. We log
 * the departure as soon as the session is active, then fill arrivalTime once
 * the guidance flow reaches the destination. This gives ML/statistics usable
 * accumulated duration data without relying on station-detail screen visits.
 */
import { commuteLogService, type CreateCommuteLogInput } from '@/services/pattern/commuteLogService';
import {
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import type { GuidanceSession } from '@/models/guidance';
import type { RouteSegment } from '@/models/route';

const formatEpochAsTime = (epochMs: number): string => {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const rideSegmentsOf = (session: GuidanceSession): readonly RouteSegment[] =>
  session.route.segments.filter(segment => !segment.isTransfer);

export const buildGuidanceCommuteLogInput = (
  session: GuidanceSession,
  completedAt?: number
): CreateCommuteLogInput | null => {
  const rideSegments = rideSegmentsOf(session);
  const first = rideSegments[0];
  const last = rideSegments[rideSegments.length - 1];
  if (!first || !last) return null;

  const routeLineIds =
    session.route.lineIds.length > 0
      ? session.route.lineIds
      : rideSegments.map(segment => segment.lineId);

  return {
    departureStationId: first.fromStationId,
    departureStationName: session.fromStationName || first.fromStationName,
    arrivalStationId: last.toStationId,
    arrivalStationName: session.toStationName || last.toStationName,
    lineIds: [...new Set(routeLineIds)],
    departureTime: formatEpochAsTime(session.startedAt),
    ...(completedAt !== undefined ? { arrivalTime: formatEpochAsTime(completedAt) } : {}),
    loggedAt: new Date(session.startedAt),
    isManual: false,
  };
};

export const startGuidanceCommuteLog = async (
  userId: string,
  session: GuidanceSession
): Promise<GuidanceSession | null> => {
  if (session.commuteLogId || session.commuteLogCompletedAt) return session;

  const input = buildGuidanceCommuteLogInput(session);
  if (!input) return null;

  const log = await commuteLogService.logCommute(userId, input);
  const current = getGuidanceSession();
  if (!current || current.startedAt !== session.startedAt) return null;

  const updated: GuidanceSession = {
    ...current,
    commuteLogId: log.id,
  };
  setGuidanceSession(updated);
  return updated;
};

export const completeGuidanceCommuteLog = async (
  userId: string,
  session: GuidanceSession,
  completedAt: number = Date.now()
): Promise<void> => {
  if (session.commuteLogCompletedAt) return;

  const input = buildGuidanceCommuteLogInput(session, completedAt);
  if (!input) return;

  let commuteLogId = session.commuteLogId;
  if (commuteLogId) {
    await commuteLogService.updateLog(userId, commuteLogId, {
      arrivalTime: input.arrivalTime,
    });
  } else {
    const log = await commuteLogService.logCommute(userId, input);
    commuteLogId = log.id;
  }

  const current = getGuidanceSession();
  if (!current || current.startedAt !== session.startedAt) return;

  setGuidanceSession({
    ...current,
    ...(commuteLogId ? { commuteLogId } : {}),
    commuteLogCompletedAt: completedAt,
  });
};
