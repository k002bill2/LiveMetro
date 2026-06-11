/**
 * Dev-only diagnostic: compare what each commute store stored vs. what
 * trainService.getStation() resolves to. If a store wrote an external
 * OpenAPI code instead of an internal slug, the lookup returns null here
 * even though `morningCommute` is non-null — the exact failure shape that
 * hides the fact grid on the home card (home-refresh audit B series).
 *
 * No-op in production builds and under jest. Extracted verbatim from
 * HomeScreen.tsx (file-size split) — no behavior change.
 */
import { useEffect } from 'react';

import { trainService } from '@services/train/trainService';
import type { CommuteTime } from '@models/user';
import type { CommuteRouteSummary } from '@hooks/useCommuteRouteSummary';

interface CommuteDiagnosticsInput {
  morningCommute: CommuteTime | null;
  profileMorningCommute: CommuteTime | null | undefined;
  onboardingMorningCommute: CommuteTime | null;
  routeSummary: CommuteRouteSummary;
}

export const useCommuteDiagnostics = ({
  morningCommute,
  profileMorningCommute,
  onboardingMorningCommute,
  routeSummary,
}: CommuteDiagnosticsInput): void => {
  useEffect(() => {
    if (!__DEV__) return;
    // Skip in jest — the async warn fires past act() boundaries and flakes
    // unrelated assertions. JEST_WORKER_ID is set on every jest worker.
    if (process.env.JEST_WORKER_ID) return;
    if (!morningCommute) return;
    let cancelled = false;
    (async () => {
      const ids = {
        fromProfile: profileMorningCommute
          ? {
              from: profileMorningCommute.stationId,
              to: profileMorningCommute.destinationStationId,
            }
          : null,
        fromOnboarding: onboardingMorningCommute
          ? {
              from: onboardingMorningCommute.stationId,
              to: onboardingMorningCommute.destinationStationId,
            }
          : null,
        chosen: {
          from: morningCommute.stationId,
          to: morningCommute.destinationStationId,
        },
      };
      const [fromStation, toStation] = await Promise.all([
        trainService.getStation(morningCommute.stationId).catch(() => null),
        trainService
          .getStation(morningCommute.destinationStationId)
          .catch(() => null),
      ]);
      if (cancelled) return;
      console.warn('[HomeScreen.commuteDiag] stored ids vs resolved stations', {
        ids,
        resolved: {
          from: fromStation
            ? { id: fromStation.id, name: fromStation.name }
            : null,
          to: toStation ? { id: toStation.id, name: toStation.name } : null,
        },
        routeSummary,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    routeSummary,
  ]);
};
