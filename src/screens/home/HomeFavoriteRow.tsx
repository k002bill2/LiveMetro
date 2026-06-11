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

interface HomeFavoriteRowProps {
  station: Station;
  alias?: string | null;
  isFocused: boolean;
  isFirst?: boolean;
  onPress: () => void;
  testID?: string;
}

export const HomeFavoriteRow: React.FC<HomeFavoriteRowProps> = memo(
  ({ station, alias, isFocused, isFirst = false, onPress, testID }) => {
    const { trains } = useRealtimeTrains(station.name, { enabled: isFocused });
    const next = trains[0];

    // Tick every second only when this is the first row AND the screen is
    // focused — avoids 1Hz timers across the favorite stack.
    const [, setTick] = useState(0);
    useEffect(() => {
      if (!isFirst || !isFocused) return;
      const id = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(id);
    }, [isFirst, isFocused]);

    const totalSecondsLeft = next?.arrivalTime
      ? Math.max(0, Math.round((next.arrivalTime.getTime() - Date.now()) / 1000))
      : 0;
    const nextMinutes = Math.floor(totalSecondsLeft / 60);

    const destLabel = next?.finalDestination
      ? `${next.finalDestination} 방면`
      : undefined;

    const imminent =
      isFirst && totalSecondsLeft > 0 && totalSecondsLeft <= 90;

    return (
      <FavoriteRow
        lines={[station.lineId as LineId]}
        stationName={station.name}
        nickname={alias ?? null}
        destinationLabel={destLabel}
        nextMinutes={nextMinutes}
        imminent={imminent}
        onPress={onPress}
        testID={testID}
      />
    );
  },
);
HomeFavoriteRow.displayName = 'HomeFavoriteRow';
