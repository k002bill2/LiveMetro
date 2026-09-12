/**
 * Android 시스템 ANR 다이얼로그 내성 대기.
 *
 * 호스티드 에뮬레이터에서는 앱과 무관한 시스템 프로세스(런처 등)가 ANR을 내고,
 * AOSP가 띄우는 "<앱>이(가) 응답하지 않습니다" 다이얼로그가 이미 렌더된 앱 화면을
 * 덮는다 — UiAutomator 트리는 최상위 윈도우만 반영하므로 앱 testID가 전부 404가
 * 되어 대기가 타임아웃한다 (E2E run 34159050379: Quickstep ANR이 이미 그려진
 * auth 랜딩을 덮어 3개 spec이 전부 auth-hero 대기에서 죽었다. 같은 SHA가 다음
 * 두 스케줄 런에서 그린 — 앱 회귀가 아니라 러너 flake).
 *
 * 해제는 AOSP 내부 resource-id(`android:id/aerr_wait` = "대기")로만 한다:
 * 버튼 텍스트는 에뮬레이터 로케일에 따라 변하고, 닫기/강제 종료 계열
 * (`aerr_close`·`aerr_app_info`)을 누르면 테스트 대상 앱이 죽어 flake가
 * 회귀로 오진된다.
 *
 * 이 모듈은 wdio 런타임에 의존하지 않는다 — 탐지·탭·대기를 주입받아
 * (`AnrTolerantWaitDeps`) Jest 단위 테스트로 분기를 증명할 수 있게 한다.
 * `@wdio/globals`는 ESM 전용 패키지라 Jest(CJS) 테스트가 직접 import 할 수 없다.
 */

/** AOSP ANR 다이얼로그의 "대기" 버튼 resource-id (로케일 비의존). */
export const ANDROID_ANR_WAIT_ID = 'android:id/aerr_wait';

/** 폴링 기본 간격 — entry-flow의 기존 루프(500ms)와 동일하게 둔다. */
export const DEFAULT_ANR_POLL_INTERVAL_MS = 500;

export interface AnrTolerantWaitDeps {
  /** 해당 id가 화면에 표시 중인지. 미존재 시 throw 하지 않고 false. */
  readonly isDisplayed: (id: string) => Promise<boolean>;
  /** 해당 id를 탭한다. */
  readonly tap: (id: string) => Promise<void>;
  /** 폴링 간격 대기. */
  readonly pause: (ms: number) => Promise<void>;
  /** 현재 시각(ms). 테스트에서 가짜 시계를 주입한다. */
  readonly now: () => number;
}

export interface AnrTolerantWaitOptions {
  /** 전체 대기 한도(ms). */
  readonly timeout: number;
  /**
   * 시스템 ANR 다이얼로그를 탐지·해제할지. Android에서만 true —
   * iOS에는 이 resource-id가 없고, 다른 플랫폼에서 누를 대상도 없다.
   */
  readonly probeSystemAnr: boolean;
  /** 폴링 간격(ms). */
  readonly interval?: number;
}

export interface AnrTolerantWaitResult {
  /** 대상이 표시된 상태로 끝났는지. */
  readonly reached: boolean;
  /** ANR "대기" 버튼을 누른 횟수 (진단 로그용). */
  readonly anrDismissals: number;
}

/**
 * `targetId`가 표시될 때까지 폴링하되, 그 사이 시스템 ANR 다이얼로그가 화면을
 * 덮고 있으면 "대기" 버튼만 눌러 걷어낸다. 한도 내 도달 실패는 예외가 아니라
 * `reached: false`로 알린다 — 실패 메시지·증거 수집은 호출부 책임이다.
 */
export async function waitForElementDismissingAnr(
  targetId: string,
  deps: AnrTolerantWaitDeps,
  options: AnrTolerantWaitOptions
): Promise<AnrTolerantWaitResult> {
  const interval = options.interval ?? DEFAULT_ANR_POLL_INTERVAL_MS;
  const deadline = deps.now() + options.timeout;
  let anrDismissals = 0;

  for (;;) {
    // 대상 우선 판정: 이미 보이면 어떤 버튼도 누르지 않는다. ANR 해제가
    // 정상 경로에 끼어들어 랜딩 CTA를 잘못 누르는 일을 구조적으로 막는다.
    if (await deps.isDisplayed(targetId)) {
      return { reached: true, anrDismissals };
    }

    const anrPresent =
      options.probeSystemAnr && (await deps.isDisplayed(ANDROID_ANR_WAIT_ID));
    if (anrPresent) {
      await deps.tap(ANDROID_ANR_WAIT_ID);
      anrDismissals += 1;
    }

    // 해제 직후에도 한도를 다시 본다 — ANR이 반복 발생해도 예산을 넘기지 않는다.
    if (deps.now() >= deadline) {
      return { reached: false, anrDismissals };
    }
    // 해제 여부와 무관하게 항상 쉰다. 탭이 먹지 않는 다이얼로그(=이 헬퍼가
    // 방어하는 바로 그 상황)에서 무지연 루프가 되어 한도 내내 수백 번 클릭하는
    // 것을 막는다 — 호출부가 탭 예외를 삼키므로 속도 제한은 여기가 유일하다.
    await deps.pause(interval);
  }
}
