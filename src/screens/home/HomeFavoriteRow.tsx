/**
 * One favorite-row item with its own real-time arrivals subscription. Each
 * card is gated on `isFocused` to avoid background polling
 * (project_inactive_screen_polling_gating.md).
 *
 * `isFirst` enables the design-handoff treatment for the topmost favorite:
 * shows an extra "초" countdown and a green "곧 도착" label, ticking once
 * per second (main.jsx:259-294). Subsequent rows show only minutes.
 *
 * Extracted verbatim from HomeScreen.tsx (file-size split) — no behavior change.
 */
import React, { memo, useEffect, useState } from 'react';

import { useRealtimeTrains } from '@hooks/useRealtimeTrains';
import { FavoriteRow } from '@components/design';
import type { LineId } from '@components/design';
import type { Station } from '@models/train';
import { isOnCanonicalLine, resolveCanonicalLineId } from '@/utils/canonicalLine';
import { isEtaFresh } from '@/utils/arrivalFreshness';

interface HomeFavoriteRowProps {
  station: Station;
  alias?: string | null;
  /** Favorite's own line; falls back to `station.lineId`. */
  lineId?: string;
  /** Favorite's saved direction; 'both'/undefined considers both directions. */
  direction?: 'up' | 'down' | 'both';
  isFocused: boolean;
  isFirst?: boolean;
  onPress: () => void;
  testID?: string;
}

export const HomeFavoriteRow: React.FC<HomeFavoriteRowProps> = memo(
  ({ station, alias, lineId, direction, isFocused, isFirst = false, onPress, testID }) => {
    const { trains, error } = useRealtimeTrains(station.name, { enabled: isFocused });
    // The arrival snapshot is per station, so a transfer station mixes lines and
    // both directions — the earliest of all of them is almost always "0분". Keep
    // only this favorite's line (fail-closed on an unknown line, per
    // canonicalLine) and its saved direction, as the Favorites tab does.
    const canonicalLine = resolveCanonicalLineId(lineId ?? station.lineId);
    const candidates = trains.filter(
      (t) =>
        canonicalLine !== null &&
        isOnCanonicalLine(canonicalLine, t.lineId) &&
        (direction === undefined || direction === 'both' || t.direction === direction),
    );
    // Earliest train with a known, fresh ETA. A train may carry
    // arrivalTime === null (unknown, e.g. arvlCd 99) or a cached ETA long past
    // (#360) — both used to render a false "0분".
    const now = Date.now();
    const next = candidates.reduce<(typeof trains)[number] | undefined>(
      (best, t) =>
        t.arrivalTime !== null &&
        isEtaFresh(t.arrivalTime, now) &&
        (best?.arrivalTime == null || t.arrivalTime.getTime() < best.arrivalTime.getTime())
          ? t
          : best,
      undefined,
    );

    // Re-render on a clock while focused: 1Hz for the first row (seconds
    // countdown), 30s for the rest. The slow tick re-judges ETA staleness even
    // when no data callback arrives (e.g. quota exhausted, #360) — avoids 1Hz
    // timers across the whole favorite stack.
    const [, setTick] = useState(0);
    useEffect(() => {
      if (!isFocused) return;
      const id = setInterval(() => setTick((t) => t + 1), isFirst ? 1000 : 30_000);
      return () => clearInterval(id);
    }, [isFirst, isFocused]);

    const totalSecondsLeft =
      next?.arrivalTime != null
        ? Math.max(0, Math.round((next.arrivalTime.getTime() - Date.now()) / 1000))
        : null;
    const nextMinutes = totalSecondsLeft !== null ? Math.floor(totalSecondsLeft / 60) : null;

    const destLabel = next?.finalDestination
      ? `${next.finalDestination} 방면`
      : undefined;

    const imminent =
      isFirst && totalSecondsLeft !== null && totalSecondsLeft > 0 && totalSecondsLeft <= 90;

    return (
      <FavoriteRow
        lines={[station.lineId as LineId]}
        stationName={station.name}
        nickname={alias ?? null}
        destinationLabel={destLabel}
        nextMinutes={nextMinutes}
        connectionLost={error !== null && error !== undefined}
        imminent={imminent}
        onPress={onPress}
        testID={testID}
      />
    );
  },
);
HomeFavoriteRow.displayName = 'HomeFavoriteRow';
