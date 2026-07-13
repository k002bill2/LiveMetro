/**
 * boardingAlertService — orchestrates the "탑승 열차 30초 전 도착 알림".
 *
 * Sits on top of `notificationService.scheduleArrivalAlert` (which owns the
 * expo-notifications scheduling) and adds the boarding-specific lifecycle:
 *   - requests notification permission at board time (skipped silently if denied),
 *   - de-duplicates: cancels the previously scheduled boarding alert before
 *     scheduling a new one, so re-boarding a different train never leaves a stale
 *     alert pending,
 *   - composes the user-facing copy from station + destination.
 *
 * The scheduled id is tracked at module scope (JS-heap, like
 * boardingSelectionStore) — NOT in the screen — because the boarding screen
 * unmounts (goBack) right after scheduling. A screen-ref + unmount-cleanup would
 * cancel the very alert we just scheduled; module-level dedup avoids that trap.
 */
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationType } from './notificationService';
import type { NotificationSettings } from '@models/user';

const DEFAULT_SECONDS_BEFORE = 30;

/**
 * 예약 data에 심는 탑승 알림 전용 식별자. 프로세스 재시작으로 모듈 스코프
 * 추적 ID(lastAlertId)가 소실돼도 OS 큐를 이 마커로 sweep해 고아 탑승 알림을
 * 청소한다. alightAlertService의 ALIGHT_ALERT_KIND와 절대 겹치지 않아 두
 * 서비스의 sweep이 서로를 건드리지 않는다.
 */
export const BOARDING_ALERT_KIND = 'boarding-alert';

/**
 * 같은 열차 재알림 억제 창. 열차 번호(btrainNo)는 다른 날 재사용될 수 있어
 * 억제를 무기한 유지하면 정당한 알림까지 삼킨다 — 한 번의 승강장 대기를
 * 충분히 덮는 길이로 제한.
 */
const FIRED_DEDUP_WINDOW_MS = 10 * 60 * 1000;

let lastAlertId: string | null = null;
// 추적 중인 알림의 컨텍스트/세션 키. 추적 슬롯(lastAlertId)은 guidance·standalone이
// 공유하므로, guidance 정리(cancel)가 standalone 알림을 오취소하지 않도록 컨텍스트를
// 함께 추적한다(K1). guidance일 때 sessionKey를 저장해 keep 비교를 추적 ID에도 일관
// 적용한다. (단일 추적 슬롯이라 컨텍스트 간 교체 시 이전 것을 놓치는 건 known-limit.)
let trackedContext: 'guidance' | 'standalone' | null = null;
let trackedSessionKey: string | null = null;
// 마지막으로 예약한 알림의 (열차 키, 발사 시각) — "이미 발사된 알림은 취소
// 불가"라는 OS 제약 아래에서, 발사 후 재스케줄(=즉시발사 강등 → 중복 배너)을
// 차단하는 발사 이력. trainId를 넘긴 호출자에게만 적용된다.
let lastScheduledTrainId: string | null = null;
let lastScheduledFireAtMs: number | null = null;

interface BoardingAlertParamsBase {
  readonly stationName: string;
  readonly finalDestination: string;
  readonly arrivalTime: Date | null;
  readonly secondsBefore?: number;
  /** Copy variant: 'board' (first train, default) or 'transfer' (transfer train). */
  readonly variant?: 'board' | 'transfer';
  /** Poll-stable train id (btrainNo 기반) — 제공 시 발사-이력 dedup 활성화. */
  readonly trainId?: string;
  /** 사용자 알림 설정 — 제공 시 shouldSendNotification 게이트를 통과해야 예약. */
  readonly settings?: NotificationSettings | null;
}

/**
 * 길안내 세션 소속 탑승 알림. kind 마커 + `sessionKey`를 예약 data에 심어 세션
 * 종료/교체 정리와 재시작 고아 sweep의 대상이 된다. `sessionKey`는 호출 시점에
 * 화면이 고정 read한 세션의 키여야 한다 — 서비스가 await 이후 스토어를 다시 읽으면
 * in-flight 교체 시 새 startedAt으로 오스탬프되어 stale 알림이 keep 필터로 보존되는
 * 레이스가 생긴다(Codex 3R H2). 그래서 키의 유일 소스는 이 param이다.
 */
export interface GuidanceBoardingAlertParams extends BoardingAlertParamsBase {
  readonly context: 'guidance';
  readonly sessionKey: string;
}

/**
 * 세션 무관 단독 탑승 알림(TrainSelectionScreen). kind 마커가 없어 길안내 고아
 * sweep의 대상이 아니다 — 다음 부팅 정리가 유효한 단독 알림을 오취소하지 않는다.
 */
export interface StandaloneBoardingAlertParams extends BoardingAlertParamsBase {
  readonly context: 'standalone';
}

export type BoardingAlertParams =
  | GuidanceBoardingAlertParams
  | StandaloneBoardingAlertParams;

// 공개 API 호출을 도착 순서대로 직렬화한다 — cancel의 무필터 OS sweep이 진행 중일 때
// 다른 세션의 schedule이 끼어들면, sweep 스냅샷에 방금 예약된 알림이 포함돼 잘못
// 취소되는 레이스(J2)를 원천 차단한다. alightAlertService의 직렬화 큐 패턴 복제 —
// 두 서비스는 독립 큐라 서로 대기하지 않는다(surgical).
let opQueue: Promise<unknown> = Promise.resolve();

const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
  const run = opQueue.then(op, op);
  opQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

/**
 * Schedule a 30s-before-arrival local notification for the boarded train.
 * Returns the scheduled identifier, or null when not scheduled (no arrival time,
 * permission denied, or an error). 공개 함수는 직렬화 큐를 통해 순차 실행된다.
 * Never throws.
 */
export const scheduleBoardingAlert = (
  params: BoardingAlertParams
): Promise<string | null> => enqueue(() => scheduleBoardingAlertInner(params));

const scheduleBoardingAlertInner = async (
  params: BoardingAlertParams
): Promise<string | null> => {
  const {
    stationName,
    finalDestination,
    arrivalTime,
    secondsBefore = DEFAULT_SECONDS_BEFORE,
    variant = 'board',
    trainId,
    settings,
  } = params;

  // 명시적 null 체크 — Date는 falsy가 아니므로 안전하지만 의도 명확화.
  if (arrivalTime === null) return null;

  try {
    const permission = await notificationService.requestPermissions();
    if (!permission.granted) return null;

    if (
      settings != null &&
      !notificationService.shouldSendNotification(settings, NotificationType.ARRIVAL_REMINDER)
    ) {
      return null;
    }

    // 발사 이력 dedup: 같은 열차의 알림이 이미 발사됐다면(fireAt 경과) 재예약
    // 금지 — 재예약은 과거 트리거로 강등되어 즉시 중복 배너가 된다.
    const fireAtMs = arrivalTime.getTime() - secondsBefore * 1000;
    if (
      trainId != null &&
      trainId === lastScheduledTrainId &&
      lastScheduledFireAtMs !== null
    ) {
      const now = Date.now();
      const alreadyFired =
        now >= lastScheduledFireAtMs && now - lastScheduledFireAtMs < FIRED_DEDUP_WINDOW_MS;
      if (alreadyFired) return null;
    }

    // 다른 열차로 재탑승 시 이전 알림이 남지 않도록 먼저 취소. 이미 큐 안에서
    // 실행 중이므로 inner를 직접 호출한다(공개 cancelBoardingAlert 재진입 = 데드락).
    // scheduleContext=이번 예약 context — (a) 추적 ID는 같은 컨텍스트 교체분만 취소,
    // (b) kind sweep은 guidance 예약일 때만 실행한다. standalone 예약이 마커 없는
    // 자기 알림만 교체하고 남의(guidance) 알림을 오취소하지 않게 한다(T1).
    await cancelBoardingAlertInner({ scheduleContext: params.context });

    // 환승은 종착역(finalDestination)이 대기 방향과 어긋날 수 있어 카피에서 생략.
    const copy =
      variant === 'transfer'
        ? { title: '환승 열차 곧 도착', body: `${stationName} 환승 승강장으로 이동하세요` }
        : {
            title: `${finalDestination} 방면 곧 도착`,
            body: `${stationName}역 승강장으로 이동할 시간이에요`,
          };

    // 길안내 소속 알림만 kind 마커 + 세션 키를 심는다(세션 정리/고아 sweep 대상).
    // 단독 알림은 마커 없음. sessionKey는 호출자 param이 유일 소스 — 서비스는 스토어를
    // 다시 읽지 않는다(await 이후 in-flight 세션 교체 오스탬프 방지, H2).
    const guidanceMarker =
      params.context === 'guidance'
        ? { kind: BOARDING_ALERT_KIND, sessionKey: params.sessionKey }
        : {};

    const id = await notificationService.scheduleArrivalAlert(arrivalTime, {
      secondsBefore,
      title: copy.title,
      body: copy.body,
      data: {
        stationName,
        finalDestination,
        variant,
        ...guidanceMarker,
      },
    });

    lastAlertId = id;
    trackedContext = params.context;
    trackedSessionKey = params.context === 'guidance' ? params.sessionKey : null;
    if (id !== null) {
      lastScheduledTrainId = trainId ?? null;
      lastScheduledFireAtMs = fireAtMs;
    }
    return id;
  } catch (error) {
    console.error('Error scheduling boarding alert:', error);
    return null;
  }
};

/**
 * 추적 중인 탑승 알림을 취소하고, OS 큐에 남은 탑승 알림 고아까지 sweep한다.
 * 프로세스 재시작으로 모듈 스코프 lastAlertId가 소실된 경우까지 커버한다.
 * 마커 없는 구버전 잔여 알림은 sweep 대상이 아니다 — boardingAlertService의
 * 발사 이력 dedup + 발사시각 게이트가 중복 발사를 완화한다(known-limit).
 *
 * keep 모드(`options.keepSessionKey` 지정, 세션 교체 정리): 추적 알림의 sessionKey가
 * 보존 대상과 일치하면 건드리지 않고, 아니면 취소한다(OS sweep의 keep 필터와 동일
 * 기준을 추적 ID에도 적용). sweep도 kind 매칭이라도 `data.sessionKey === keepSessionKey`
 * 면 보존한다. 미지정 시(종료/고아 정리) 추적 ID 전량 취소.
 *
 * K1: 공개 cancel(= guidance 수명주기 진입점)은 추적 컨텍스트가 standalone이면 추적
 * ID를 건드리지 않는다 — standalone 알림은 추적 슬롯을 공유하지만 guidance 정리가
 * 취소해선 안 된다(마커 sweep은 무마커 standalone을 이미 제외하나 추적 ID 경로가 그
 * 격리를 우회함). schedule 내부 dedup은 `respectContextIsolation:false`로 기존 의미
 * (같은 컨텍스트 교체 시 이전 취소)를 유지한다 — 컨텍스트 간 교체 시 이전 것을 놓치는
 * 것은 단일 추적 슬롯의 known-limit. 공개 함수는 직렬화 큐로 순차 실행된다. Never throws.
 */
export const cancelBoardingAlert = (
  options?: { readonly keepSessionKey?: string }
): Promise<void> => enqueue(() => cancelBoardingAlertInner(options));

const cancelBoardingAlertInner = async (
  options?: {
    readonly keepSessionKey?: string;
    readonly respectContextIsolation?: boolean;
    readonly scheduleContext?: 'guidance' | 'standalone';
  }
): Promise<void> => {
  const keepSessionKey = options?.keepSessionKey;
  const scheduleContext = options?.scheduleContext;
  // 추적 ID 취소 판정. 내부 dedup(scheduleContext 지정)은 같은 컨텍스트 교체분만
  // 취소한다(T1). 공개 lifecycle cancel(scheduleContext 미지정)은 K1 격리 + keep 필터.
  let cancelTracked: boolean;
  if (scheduleContext !== undefined) {
    cancelTracked = trackedContext === scheduleContext;
  } else {
    const respectContextIsolation = options?.respectContextIsolation !== false;
    const skipStandaloneTracked = respectContextIsolation && trackedContext === 'standalone';
    const keptByFilter =
      keepSessionKey !== undefined && trackedSessionKey === keepSessionKey;
    cancelTracked = !skipStandaloneTracked && !keptByFilter;
  }
  if (cancelTracked) {
    const id = lastAlertId;
    lastAlertId = null;
    trackedContext = null;
    trackedSessionKey = null;
    if (id !== null) {
      try {
        await notificationService.cancelNotification(id);
      } catch (error) {
        console.error('Error cancelling boarding alert:', error);
      }
    }
  }
  // OS 큐를 훑어 kind 마커가 붙은 탑승 알림을 취소한다 — 앱/JS 재시작으로 추적이
  // 끊긴 고아까지 청소한다. alight 알림(kind=ALIGHT_ALERT_KIND)은 상수가 달라
  // 건드리지 않는다. keepSessionKey 세션 알림은 보존한다. 단, 내부 dedup의 kind
  // sweep은 guidance 예약일 때만 실행한다 — standalone 예약이 남의 guidance 알림을
  // 오취소하지 않게 한다(T1).
  if (scheduleContext !== undefined && scheduleContext !== 'guidance') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      const data = request.content?.data;
      if (data?.kind !== BOARDING_ALERT_KIND) continue;
      if (keepSessionKey !== undefined && data?.sessionKey === keepSessionKey) continue;
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  } catch (error) {
    console.error('Error sweeping boarding alerts:', error);
  }
};
