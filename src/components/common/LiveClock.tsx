/**
 * LiveClock — Self-updating clock text isolated from parent re-renders.
 *
 * Putting `setInterval(setState)` inside the parent screen forces every
 * sibling subtree to re-render once per tick. Encapsulating the ticking
 * state inside a small child confines the cost to this component only.
 */

import React, { memo, useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface LiveClockProps extends Omit<TextProps, 'children'> {
  /** Update interval in ms. Default: 60000 (1 minute) */
  intervalMs?: number;
  /** Custom formatter. Default: ko-KR HH:mm 24h */
  format?: (date: Date) => string;
}

const DEFAULT_INTERVAL_MS = 60 * 1000;

const defaultFormat = (date: Date): string =>
  date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const LiveClock: React.FC<LiveClockProps> = memo(
  ({ intervalMs = DEFAULT_INTERVAL_MS, format = defaultFormat, ...textProps }) => {
    const [now, setNow] = useState<Date>(() => new Date());

    useEffect(() => {
      const timer = setInterval(() => setNow(new Date()), intervalMs);
      return () => clearInterval(timer);
    }, [intervalMs]);

    return <Text {...textProps}>{format(now)}</Text>;
  }
);

LiveClock.displayName = 'LiveClock';
