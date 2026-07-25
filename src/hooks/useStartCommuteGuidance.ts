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
import { attachDestinationPreferences } from '@services/guidance/destinationPreferenceSync';
import { notificationService } from '@services/notification/notificationService';
import type { AppStackParamList } from '@/navigation/types';
import type { CommuteType } from '@/models/commute';

interface StartCommuteGuidanceArgs {
  fromStationId?: string;
  toStationId?: string;
  viaTransferId?: string;
  fromStationName?: string;
  toStationName?: string;
  /** 이 진입의 출처 출퇴근 leg. 부재 = 일반 경로 세션 (선호는 세션 한정). */
  commuteType?: CommuteType;
  /** 저장된 leg 선호를 읽어올 사용자. 부재(비로그인)면 attach를 건너뛴다. */
  uid?: string;
}

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export function useStartCommuteGuidance(
  args: StartCommuteGuidanceArgs,
): (() => void) | null {
  const navigation = useNavigation<NavigationProp>();
  const {
    fromStationId,
    toStationId,
    viaTransferId,
    fromStationName,
    toStationName,
    commuteType,
    uid,
  } = args;

  const route = useMemo(
    () => selectCommuteRoute(fromStationId, toStationId, viaTransferId),
    [fromStationId, toStationId, viaTransferId],
  );

  const handler = useCallback(() => {
    if (!route || !fromStationName || !toStationName) return;
    const startedAt = Date.now();
    setGuidanceSession({
      route,
      fromStationName,
      toStationName,
      startedAt,
      // sourceCommuteType은 동기 기록 — write-back 대상 leg를 attach 성패와 무관하게
      // 확정해 둔다. 실제 write-back은 attach가 경로 지문을 확인해야(sourceRouteVerified)
      // 열리므로, 원격 읽기가 실패하면 선호는 세션 한정으로 강등된다(fail-closed).
      ...(commuteType !== undefined && { sourceCommuteType: commuteType }),
      // 소유 귀속 — 영속 세션이 로그아웃/계정 전환을 넘겨 살아남아도 남의 선호가
      // 새 계정의 commuteSettings에 기록되지 않게 한다.
      ...(uid !== undefined && { ownerUid: uid }),
    });
    if (commuteType !== undefined && uid !== undefined) {
      void attachDestinationPreferences(uid, commuteType, startedAt);
    }
    // 이미 이동을 시작했으므로 오늘 예약된 ML "출발 알림"은 발사 전에 제거
    // (fire-and-forget — 실패해도 길안내 시작을 막지 않는다).
    void notificationService.cancelScheduledMlDepartureAlerts();
    navigation.navigate('RouteGuidance');
  }, [route, fromStationName, toStationName, commuteType, uid, navigation]);

  if (!route || !fromStationName || !toStationName) return null;
  return handler;
}

export default useStartCommuteGuidance;
