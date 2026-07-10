/**
 * guidanceCommuteLogService — bridges live guidance sessions to commute logs.
 *
 * A guidance session is the strongest signal that a real commute happened:
 * the user explicitly chose a route and started turn-by-turn guidance. We log
 * the departure as soon as the session is active, then fill arrivalTime once
 * the guidance flow reaches the destination. This gives ML/statistics usable
 * accumulated duration data without relying on station-detail screen visits.
 */
import {
  commuteLogService,
  findAdoptableOpenLog,
  type CreateCommuteLogInput,
} from '@/services/pattern/commuteLogService';
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

  // Settings auto-logging may have already opened a log for this same leg
  // (matched by departureStationName — the two paths use different stationId
  // domains). Adopt it instead of creating a duplicate doc.
  const legLogs = await commuteLogService.getTodayLogsByDeparture(
    userId,
    input.departureStationName
  );
  const adoptable = findAdoptableOpenLog(legLogs, input.arrivalStationName);

  let commuteLogId: string;
  if (adoptable) {
    // Guidance departure time is measured (not estimated), so refresh it. A
    // destination-less stub (autoLogIfAppropriate) also gets its route repaired.
    const repair: Partial<CreateCommuteLogInput> = adoptable.needsRepair
      ? {
          arrivalStationId: input.arrivalStationId,
          arrivalStationName: input.arrivalStationName,
          lineIds: input.lineIds,
        }
      : {};
    await commuteLogService.updateLog(userId, adoptable.log.id, {
      departureTime: input.departureTime,
      ...repair,
    });
    commuteLogId = adoptable.log.id;
  } else {
    const log = await commuteLogService.logCommute(userId, input);
    commuteLogId = log.id;
  }

  const current = getGuidanceSession();
  if (!current || current.startedAt !== session.startedAt) return null;

  const updated: GuidanceSession = {
    ...current,
    commuteLogId,
  };
  setGuidanceSession(updated);
  return updated;
};

export const completeGuidanceCommuteLog = async (
  userId: string,
  session: GuidanceSession,
  completedAt: number = Date.now()
): Promise<void> => {
  // The screen may hold a frozen session snapshot taken before commuteLogId was
  // attached asynchronously; consult the live store (same journey) too.
  const live = getGuidanceSession();
  const liveSession =
    live !== null && live.startedAt === session.startedAt ? live : null;

  if (session.commuteLogCompletedAt || liveSession?.commuteLogCompletedAt) return;

  const input = buildGuidanceCommuteLogInput(session, completedAt);
  if (!input) return;

  let commuteLogId = session.commuteLogId ?? liveSession?.commuteLogId;
  let repair: Partial<CreateCommuteLogInput> = {};
  if (!commuteLogId) {
    // Neither snapshot has the id — fall back to a same-leg open log created by
    // settings auto-logging or the departure step, before creating a new doc.
    // A destination-less stub also gets its route repaired.
    const legLogs = await commuteLogService.getTodayLogsByDeparture(
      userId,
      input.departureStationName
    );
    const adoptable = findAdoptableOpenLog(legLogs, input.arrivalStationName);
    if (adoptable) {
      commuteLogId = adoptable.log.id;
      if (adoptable.needsRepair) {
        repair = {
          arrivalStationId: input.arrivalStationId,
          arrivalStationName: input.arrivalStationName,
          lineIds: input.lineIds,
        };
      }
    }
  }

  if (commuteLogId) {
    await commuteLogService.updateLog(userId, commuteLogId, {
      arrivalTime: input.arrivalTime,
      ...repair,
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
