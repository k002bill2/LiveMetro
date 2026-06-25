/**
 * useStartCommuteGuidance — turn a saved commute OD into a one-tap "길안내
 * 시작" action for the home commute card.
 *
 * Returns `null` when guidance cannot start (no resolvable route, or missing
 * endpoint names) so the caller hides the CTA — never offer an action that
 * would dead-end. When ready, returns a handler that hands the computed Route
 * to `guidanceSessionStore` (the same handoff the route-search CTA uses) and
 * navigates to the live guidance screen.
 */
import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { selectCommuteRoute } from '@services/route/selectCommuteRoute';
import { setGuidanceSession } from '@services/guidance/guidanceSessionStore';
import type { AppStackParamList } from '@/navigation/types';

interface StartCommuteGuidanceArgs {
  fromStationId?: string;
  toStationId?: string;
  viaTransferId?: string;
  fromStationName?: string;
  toStationName?: string;
}

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export function useStartCommuteGuidance(
  args: StartCommuteGuidanceArgs,
): (() => void) | null {
  const navigation = useNavigation<NavigationProp>();
  const { fromStationId, toStationId, viaTransferId, fromStationName, toStationName } = args;

  const route = useMemo(
    () => selectCommuteRoute(fromStationId, toStationId, viaTransferId),
    [fromStationId, toStationId, viaTransferId],
  );

  const handler = useCallback(() => {
    if (!route || !fromStationName || !toStationName) return;
    setGuidanceSession({
      route,
      fromStationName,
      toStationName,
      startedAt: Date.now(),
    });
    navigation.navigate('RouteGuidance');
  }, [route, fromStationName, toStationName, navigation]);

  if (!route || !fromStationName || !toStationName) return null;
  return handler;
}

export default useStartCommuteGuidance;
