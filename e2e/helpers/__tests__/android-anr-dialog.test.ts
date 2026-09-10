/**
 * waitForElementDismissingAnr 회귀 테스트.
 *
 * 증명 대상 (E2E run 34159050379 회귀 방지):
 *   1. 대상이 이미 보이면 아무것도 탭하지 않는다 — 해제 로직이 정상 경로를
 *      오염시키면 랜딩 CTA를 엉뚱하게 누를 수 있다.
 *   2. 시스템 ANR 다이얼로그가 떠 있으면 `android:id/aerr_wait`만 눌러 해제하고
 *      대상에 도달한다 — 로케일 의존 텍스트·앱 종료 버튼을 쓰지 않는다.
 *   3. Android가 아니면 ANR 버튼을 건드리지 않는다.
 */
import {
  ANDROID_ANR_WAIT_ID,
  waitForElementDismissingAnr,
  type AnrTolerantWaitDeps,
} from '../android-anr-dialog';

const TARGET = 'auth-hero';
/** 같은 다이얼로그의 "닫기" 버튼 — 구현이 잘못된 버튼을 누르면 탐지된다. */
const ANR_CLOSE_ID = 'android:id/aerr_close';

interface Harness {
  readonly deps: AnrTolerantWaitDeps;
  readonly visible: Set<string>;
  readonly tap: jest.Mock<Promise<void>, [string]>;
  readonly elapsed: () => number;
}

/**
 * 가짜 화면 + 가짜 시계. pause()가 시계를 전진시켜 타임아웃 경로도 즉시 끝난다.
 * 모든 mock은 id로 분기하는 단일 구현이다 — mockResolvedValueOnce 큐는 미구현
 * 함수가 큐를 소비하지 않아 인접 테스트로 누출된다(프로젝트 기록된 함정).
 */
function createHarness(
  initiallyVisible: readonly string[],
  onTap: (id: string, visible: Set<string>) => void = (): void => {}
): Harness {
  const visible = new Set<string>(initiallyVisible);
  let clock = 0;
  const tap = jest.fn(async (id: string): Promise<void> => {
    onTap(id, visible);
  });
  return {
    visible,
    tap,
    elapsed: (): number => clock,
    deps: {
      isDisplayed: async (id: string): Promise<boolean> => visible.has(id),
      tap,
      pause: async (ms: number): Promise<void> => {
        clock += ms;
      },
      now: (): number => clock,
    },
  };
}

describe('waitForElementDismissingAnr', () => {
  it('대상이 이미 보이면 아무 버튼도 탭하지 않고 즉시 도달 처리한다', async () => {
    const harness = createHarness([TARGET]);

    const result = await waitForElementDismissingAnr(TARGET, harness.deps, {
      timeout: 30000,
      probeSystemAnr: true,
    });

    expect(result).toEqual({ reached: true, anrDismissals: 0 });
    expect(harness.tap).not.toHaveBeenCalled();
    expect(harness.elapsed()).toBe(0);
  });

  it('시스템 ANR 다이얼로그를 aerr_wait로만 해제하고 대상에 도달한다', async () => {
    const harness = createHarness(
      [ANDROID_ANR_WAIT_ID, ANR_CLOSE_ID],
      (id, visible) => {
        // "대기"를 누르면 다이얼로그가 사라지고 그 아래 렌더돼 있던 앱이 드러난다.
        if (id === ANDROID_ANR_WAIT_ID) {
          visible.delete(ANDROID_ANR_WAIT_ID);
          visible.delete(ANR_CLOSE_ID);
          visible.add(TARGET);
        }
      }
    );

    const result = await waitForElementDismissingAnr(TARGET, harness.deps, {
      timeout: 30000,
      probeSystemAnr: true,
    });

    expect(result).toEqual({ reached: true, anrDismissals: 1 });
    expect(harness.tap).toHaveBeenCalledTimes(1);
    expect(harness.tap).toHaveBeenCalledWith(ANDROID_ANR_WAIT_ID);
  });

  it('대상이 끝까지 안 보이면 탭 없이 미도달을 반환한다', async () => {
    const harness = createHarness([]);

    const result = await waitForElementDismissingAnr(TARGET, harness.deps, {
      timeout: 2000,
      probeSystemAnr: true,
      interval: 500,
    });

    expect(result).toEqual({ reached: false, anrDismissals: 0 });
    expect(harness.tap).not.toHaveBeenCalled();
    expect(harness.elapsed()).toBeGreaterThanOrEqual(2000);
  });

  it('probeSystemAnr가 false면 ANR 버튼이 떠 있어도 탭하지 않는다', async () => {
    const harness = createHarness([ANDROID_ANR_WAIT_ID]);

    const result = await waitForElementDismissingAnr(TARGET, harness.deps, {
      timeout: 1000,
      probeSystemAnr: false,
      interval: 500,
    });

    expect(result).toEqual({ reached: false, anrDismissals: 0 });
    expect(harness.tap).not.toHaveBeenCalled();
  });
});
