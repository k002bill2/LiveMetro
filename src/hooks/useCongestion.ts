/**
 * useCongestion Hook
 * Provides access to real-time train congestion data with crowdsourcing
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { congestionService } from '@/services/congestion/congestionService';
import {
  CongestionReport,
  CongestionReportInput,
  TrainCongestionSummary,
} from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

interface UseCongestionOptions {
  /** Line ID to subscribe to */
  lineId?: string;
  /** Train ID for specific train congestion */
  trainId?: string;
  /** Direction of train */
  direction?: 'up' | 'down';
  /** Auto-subscribe to real-time updates */
  autoSubscribe?: boolean;
}

interface UseCongestionReturn {
  /** Congestion summary for specific train */
  trainCongestion: TrainCongestionSummary | null;
  /** Congestion summaries for the line */
  lineCongestion: TrainCongestionSummary[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Submit a congestion report */
  submitReport: (input: Omit<CongestionReportInput, 'trainId' | 'lineId' | 'direction'> & {
    trainId?: string;
    lineId?: string;
    direction?: 'up' | 'down';
  }) => Promise<CongestionReport | null>;
  /** Check if user can submit a report (cooldown) */
  canSubmitReport: (carNumber: number) => Promise<boolean>;
  /** Is currently submitting */
  submitting: boolean;
  /** Refresh data manually */
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook: useTrainCongestion
// ============================================================================

/**
 * Hook for accessing specific train congestion data
 */
export function useTrainCongestion(
  lineId: string,
  direction: 'up' | 'down',
  trainId: string
): {
  congestion: TrainCongestionSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [congestion, setCongestion] = useState<TrainCongestionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!lineId || !trainId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await congestionService.getTrainCongestion(lineId, direction, trainId);
      setCongestion(data);
    } catch (err) {
      setError('혼잡도 정보를 불러오는데 실패했습니다');
      console.error('Failed to fetch train congestion:', err);
    } finally {
      setLoading(false);
    }
  }, [lineId, direction, trainId]);

  useEffect(() => {
    if (!lineId || !trainId) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    const unsubscribe = congestionService.subscribeToTrainCongestion(
      lineId,
      direction,
      trainId,
      (summary) => {
        setCongestion(summary);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [lineId, direction, trainId]);

  return { congestion, loading, error, refresh };
}

// ============================================================================
// Hook: useLineCongestion
// ============================================================================

/**
 * Hook for accessing line-wide congestion data
 */
export function useLineCongestion(lineId: string): {
  congestion: TrainCongestionSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [congestion, setCongestion] = useState<TrainCongestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!lineId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await congestionService.getLineCongestion(lineId);
      setCongestion(data);
    } catch (err) {
      setError('노선 혼잡도를 불러오는데 실패했습니다');
      console.error('Failed to fetch line congestion:', err);
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => {
    if (!lineId) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    const unsubscribe = congestionService.subscribeToLineCongestion(
      lineId,
      (summaries) => {
        setCongestion(summaries);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [lineId]);

  return { congestion, loading, error, refresh };
}

// ============================================================================
// Hook: useCongestionReport
// ============================================================================

/**
 * Hook for submitting congestion reports
 */
export function useCongestionReport(): {
  submitReport: (input: CongestionReportInput) => Promise<CongestionReport | null>;
  canSubmitReport: (trainId: string, carNumber: number) => Promise<boolean>;
  submitting: boolean;
  lastReport: CongestionReport | null;
  error: string | null;
} {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [lastReport, setLastReport] = useState<CongestionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitReport = useCallback(
    async (input: CongestionReportInput): Promise<CongestionReport | null> => {
      if (!user) {
        setError('로그인이 필요합니다');
        return null;
      }

      try {
        setSubmitting(true);
        setError(null);

        const report = await congestionService.submitReport(input, user.id);
        setLastReport(report);
        return report;
      } catch (err) {
        setError('혼잡도 제보에 실패했습니다');
        console.error('Failed to submit congestion report:', err);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [user]
  );

  const canSubmitReport = useCallback(
    async (trainId: string, carNumber: number): Promise<boolean> => {
      if (!user) return false;

      try {
        const hasRecent = await congestionService.hasRecentReport(
          user.id,
          trainId,
          carNumber
        );
        return !hasRecent;
      } catch (err) {
        console.error('Failed to check report cooldown:', err);
        return false;
      }
    },
    [user]
  );

  return { submitReport, canSubmitReport, submitting, lastReport, error };
}

// ============================================================================
// Combined Hook: useCongestion
// ============================================================================

/**
 * Combined hook for congestion data and reporting
 */
export function useCongestion(options: UseCongestionOptions = {}): UseCongestionReturn {
  const { lineId, trainId, direction, autoSubscribe = true } = options;
  const { user } = useAuth();

  const [trainCongestion, setTrainCongestion] = useState<TrainCongestionSummary | null>(null);
  const [lineCongestion, setLineCongestion] = useState<TrainCongestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Refresh data
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<void>[] = [];

      if (lineId && trainId && direction) {
        promises.push(
          congestionService.getTrainCongestion(lineId, direction, trainId).then(data => {
            setTrainCongestion(data);
          })
        );
      }

      if (lineId) {
        promises.push(
          congestionService.getLineCongestion(lineId).then(data => {
            setLineCongestion(data);
          })
        );
      }

      await Promise.all(promises);
    } catch (err) {
      setError('혼잡도 정보를 불러오는데 실패했습니다');
      console.error('Failed to refresh congestion:', err);
    } finally {
      setLoading(false);
    }
  }, [lineId, trainId, direction]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!autoSubscribe) {
      setLoading(false);
      return;
    }

    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!lineId) {
      setLoading(false);
      return;
    }

    // Subscribe to line congestion
    const unsubscribeLine = congestionService.subscribeToLineCongestion(
      lineId,
      (summaries) => {
        setLineCongestion(summaries);

        // Also update train congestion if we have trainId
        if (trainId && direction) {
          const trainSummary = summaries.find(
            s => s.trainId === trainId && s.direction === direction
          );
          setTrainCongestion(trainSummary || null);
        }

        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribeLine;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [lineId, trainId, direction, autoSubscribe]);

  // Submit report
  const submitReport = useCallback(
    async (input: Omit<CongestionReportInput, 'trainId' | 'lineId' | 'direction'> & {
      trainId?: string;
      lineId?: string;
      direction?: 'up' | 'down';
    }): Promise<CongestionReport | null> => {
      if (!user) {
        setError('로그인이 필요합니다');
        return null;
      }

      const finalTrainId = input.trainId || trainId;
      const finalLineId = input.lineId || lineId;
      const finalDirection = input.direction || direction;

      if (!finalTrainId || !finalLineId || !finalDirection) {
        setError('열차 정보가 필요합니다');
        return null;
      }

      try {
        setSubmitting(true);
        setError(null);

        const report = await congestionService.submitReport(
          {
            trainId: finalTrainId,
            lineId: finalLineId,
            direction: finalDirection,
            stationId: input.stationId,
            carNumber: input.carNumber,
            congestionLevel: input.congestionLevel,
          },
          user.id
        );

        return report;
      } catch (err) {
        setError('혼잡도 제보에 실패했습니다');
        console.error('Failed to submit congestion report:', err);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [user, trainId, lineId, direction]
  );

  // Check if can submit
  const canSubmitReport = useCallback(
    async (carNumber: number): Promise<boolean> => {
      if (!user || !trainId) return false;

      try {
        const hasRecent = await congestionService.hasRecentReport(
          user.id,
          trainId,
          carNumber
        );
        return !hasRecent;
      } catch (err) {
        console.error('Failed to check report cooldown:', err);
        return false;
      }
    },
    [user, trainId]
  );

  return {
    trainCongestion,
    lineCongestion,
    loading,
    error,
    submitReport,
    canSubmitReport,
    submitting,
    refresh,
  };
}

export default useCongestion;
