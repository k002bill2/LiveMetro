# 길안내 종점행 표시·선택 (Destination Preference) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 길안내 대기 구간(첫 탑승·환승)에서 도착 열차의 종착역을 표시하고, 사용자가 선호 종점행(복수)을 선택하면 카운트다운·탑승 알림·출발 감지가 해당 열차만 추적하며, 선택은 출퇴근 경로(`commuteSettings/<uid>`)에 저장된다.

**Architecture:** `Train.finalDestination`(이미 정규화됨)을 소비하는 순수 필터 모듈(`destinationPreference.ts`)을 신설하고, `RouteGuidanceScreen`의 기존 방면 필터 지점을 display(보조 나열용)/tracked(추적용) 2-풀로 재구성한다. 선택은 `GuidanceSession.destinationPreferences`(세션 사본)에 두고, 출퇴근 진입 세션(`sourceCommuteType`)이면 `commuteSettings` 문서의 `<leg>Route.boardingPreferences`에 dot-path 부분 업데이트로 write-back한다.

**Tech Stack:** React Native 0.72 / Expo 49 / TypeScript strict / Firebase Firestore / Jest + RNTL

**Spec:** `docs/superpowers/specs/2026-07-25-transfer-destination-preference-design.md`

**Branch:** `feat/guidance-destination-preference` (이미 체크아웃됨 — 태스크별 커밋)

## Global Constraints

- TypeScript strict: `any` 금지, 모든 exported 함수 명시적 반환 타입.
- import는 path alias만 (`@/`, `@services/`, `@models/`, `@components/`, `@hooks/`).
- 스타일 `StyleSheet.create()`, 폰트 `weightToFontFamily('700')` 형식(단독 `fontWeight` 금지 — pre-commit lint:typography가 차단), 터치 요소 44pt+`accessibilityLabel`.
- Firestore optional 필드는 **조건부 spread** (undefined 필드 전달 시 addDoc/updateDoc throw 전례).
- **미선택(선호 없음) 시 기존 동작과 바이트 단위 동일** — 회귀 0이 완료 기준.
- 서비스 함수는 throw 금지 (에러 시 result 객체/null/빈 배열).
- 테스트 실행: `npx jest <파일> --watchman=false`. `jest.mock()` factory는 inline 정의(호이스팅), partial mock은 `...jest.requireActual()` spread.
- 키 도메인: 보딩 키 = `"${stationId}|${lineId}"`. board 스텝 = `step.stationId|step.lineId`, transfer 스텝 = `step.stationId|step.toLineId` (= `CommuteRoute`의 `departureStationId|departureLineId`, `TransferStation.stationId|TransferStation.lineId` — TransferStation.lineId는 "그 역에서 갈아타 탑승하는 노선"이며 `reverseCommuteRoute`의 lineId 시프트 구현이 그 증거).
- 종착역 문자열 도메인 = `Train.finalDestination` (`bstatnNm` 정규화 결과, 예: "장암", "하남검단산"). 저장·매칭 모두 이 도메인 — 별도 재정규화 금지 (이미 정규화된 값을 그대로 왕복).

---

### Task 1: 모델 필드 + 순수 헬퍼 모듈 `destinationPreference.ts`

**Files:**
- Modify: `src/models/commute.ts` (CommuteRoute, 39-50행 부근)
- Modify: `src/models/guidance.ts` (GuidanceSession, 80-103행 부근)
- Create: `src/services/guidance/destinationPreference.ts`
- Test: `src/services/guidance/__tests__/destinationPreference.test.ts`

**Interfaces:**
- Consumes: `Train` (`@/models/train`), `CommuteRoute`/`CommuteType` (`@/models/commute`)
- Produces (후속 태스크 전부가 사용):
  - `buildBoardingKey(stationId: string, lineId: string): string`
  - `partitionWaitingTrains(input: { trains: readonly Train[]; lineId: string; directionName: string | null; preferredDestinations: readonly string[] }): WaitingTrainPools` — `{ display, tracked }`
  - `destinationOptions(display: readonly Train[], preferred: readonly string[], nowMs: number): readonly DestinationOption[]` — `{ name, etaText }[]`
  - `pruneBoardingPreferences(prefs: Readonly<Record<string, readonly string[]>>, route: CommuteRoute): Readonly<Record<string, readonly string[]>>`
  - `CommuteRoute.boardingPreferences?`, `GuidanceSession.destinationPreferences?`, `GuidanceSession.sourceCommuteType?`

- [ ] **Step 1: 모델 필드 추가** — `CommuteRoute`에:

```ts
  /** 탑승 구간별 선호 종점행. 키 = `${stationId}|${lineId}` (출발역 + 환승역 각각).
   *  값 = 선호 종착역 이름 배열 (`Train.finalDestination` 도메인). 부재/빈 배열 = 전체 열차. */
  readonly boardingPreferences?: Readonly<Record<string, readonly string[]>>;
```

`GuidanceSession`에 (progressAnchor 아래):

```ts
  /** 대기 구간별 선호 종점행 세션 사본 — 키잉은 CommuteRoute.boardingPreferences와 동일.
   *  시트에서 변경 시 즉시 갱신되고, 출퇴근 세션이면 원본에도 write-back된다. */
  readonly destinationPreferences?: Readonly<Record<string, readonly string[]>>;
  /** 이 세션의 출처 출퇴근 leg. 부재 = 일반 경로 검색 세션 (선택은 세션 한정). */
  readonly sourceCommuteType?: 'morning' | 'evening';
```

- [ ] **Step 2: 실패하는 테스트 작성** — `src/services/guidance/__tests__/destinationPreference.test.ts` (departureDetection.test 스타일의 순수 유닛 테스트, Train 픽스처는 최소 필드 헬퍼로):

```ts
import {
  buildBoardingKey,
  destinationOptions,
  partitionWaitingTrains,
  pruneBoardingPreferences,
} from '@/services/guidance/destinationPreference';
import { TrainStatus, type Train } from '@/models/train';
import type { CommuteRoute } from '@/models/commute';

const NOW = 1_753_400_000_000;

const train = (overrides: Partial<Train> & Pick<Train, 'id' | 'finalDestination'>): Train => ({
  lineId: '5',
  direction: 'up',
  currentStationId: 'S1',
  nextStationId: null,
  status: TrainStatus.NORMAL,
  arrivalTime: new Date(NOW + 180_000),
  delayMinutes: 0,
  lastUpdated: new Date(NOW),
  ...overrides,
});

const ROUTE: CommuteRoute = {
  departureTime: '08:00',
  departureStationId: 'D1',
  departureStationName: '출발',
  departureLineId: '5',
  transferStations: [
    { stationId: 'T1', stationName: '환승', lineId: '2', lineName: '2호선', order: 1 },
  ],
  arrivalStationId: 'A1',
  arrivalStationName: '도착',
  arrivalLineId: '2',
  notifications: { delayAlert: true, incidentAlert: true, alertMinutesBefore: 5 },
  bufferMinutes: 5,
};

describe('buildBoardingKey', () => {
  it('stationId|lineId 형식을 만든다', () => {
    expect(buildBoardingKey('D1', '5')).toBe('D1|5');
  });
});

describe('partitionWaitingTrains', () => {
  const hanam = train({ id: 'h1', finalDestination: '하남검단산', arrivalTime: new Date(NOW + 300_000) });
  const macheon = train({ id: 'm1', finalDestination: '마천', arrivalTime: new Date(NOW + 120_000) });
  const opposite = train({ id: 'o1', finalDestination: '방화', direction: 'down' });
  const otherLine = train({ id: 'x1', finalDestination: '성수', lineId: '2' });

  it('선호 없음 → tracked는 기존 방면 필터와 동일 (방면 매칭만)', () => {
    const { tracked } = partitionWaitingTrains({
      trains: [hanam, macheon, opposite, otherLine],
      lineId: '5',
      directionName: '하남검단산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['h1']);
  });

  it('선호 없음 + 방면 매칭 전무 → 노선 필터 결과로 폴백 (기존 동작)', () => {
    const { tracked } = partitionWaitingTrains({
      trains: [macheon, opposite],
      lineId: '5',
      directionName: '하남검단산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['m1', 'o1']);
  });

  it('display는 방면 매칭 열차와 같은 물리 방향(up/down) 전체', () => {
    const { display } = partitionWaitingTrains({
      trains: [hanam, macheon, opposite],
      lineId: '5',
      directionName: '하남검단산',
      preferredDestinations: [],
    });
    expect(display.map(t => t.id).sort()).toEqual(['h1', 'm1']);
  });

  it('선호 선택 시 tracked는 display 중 선호 종점행만 (0대 허용)', () => {
    const pick = (prefs: readonly string[]): readonly string[] =>
      partitionWaitingTrains({
        trains: [hanam, macheon, opposite],
        lineId: '5',
        directionName: '하남검단산',
        preferredDestinations: prefs,
      }).tracked.map(t => t.id);
    expect(pick(['마천'])).toEqual(['m1']);
    expect(pick(['마천', '하남검단산']).sort()).toEqual(['h1', 'm1']);
    expect(pick(['강동'])).toEqual([]);
  });

  it('비숫자 노선(lineId 필터 미적용)에서도 동작한다', () => {
    const gy = train({ id: 'g1', finalDestination: '문산', lineId: 'K4' });
    const { tracked } = partitionWaitingTrains({
      trains: [gy],
      lineId: 'K4',
      directionName: '문산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['g1']);
  });
});

describe('destinationOptions', () => {
  it('display의 distinct 종착역을 최초 도착 순으로, 저장-미도착 선호는 etaText null로 뒤에 붙인다', () => {
    const opts = destinationOptions(
      [
        train({ id: 'a', finalDestination: '하남검단산', arrivalTime: new Date(NOW + 300_000) }),
        train({ id: 'b', finalDestination: '마천', arrivalTime: new Date(NOW + 120_000) }),
        train({ id: 'c', finalDestination: '마천', arrivalTime: new Date(NOW + 500_000) }),
      ],
      ['강동'],
      NOW
    );
    expect(opts).toEqual([
      { name: '마천', etaText: '2분' },
      { name: '하남검단산', etaText: '5분' },
      { name: '강동', etaText: null },
    ]);
  });

  it('60초 미만은 "곧 도착", arrivalTime null·과거는 etaText null', () => {
    const opts = destinationOptions(
      [
        train({ id: 'a', finalDestination: '마천', arrivalTime: new Date(NOW + 30_000) }),
        train({ id: 'b', finalDestination: '강동', arrivalTime: null }),
      ],
      [],
      NOW
    );
    expect(opts).toEqual([
      { name: '마천', etaText: '곧 도착' },
      { name: '강동', etaText: null },
    ]);
  });
});

describe('pruneBoardingPreferences', () => {
  it('경로에 없는 역의 키를 제거한다 (역 단위 prune — lineId 불일치는 유지)', () => {
    const pruned = pruneBoardingPreferences(
      { 'D1|5': ['마천'], 'T1|2': ['성수'], 'GONE|7': ['도봉산'], 'D1|9': ['중앙보훈병원'] },
      ROUTE
    );
    expect(pruned).toEqual({ 'D1|5': ['마천'], 'T1|2': ['성수'], 'D1|9': ['중앙보훈병원'] });
  });

  it('빈 배열 값 키는 제거한다', () => {
    expect(pruneBoardingPreferences({ 'D1|5': [] }, ROUTE)).toEqual({});
  });
});
```

- [ ] **Step 3: 실행 → FAIL 확인** — `npx jest src/services/guidance/__tests__/destinationPreference.test.ts --watchman=false` → 모듈 부재로 FAIL.

- [ ] **Step 4: 구현** — `src/services/guidance/destinationPreference.ts`:

```ts
/**
 * destinationPreference — 대기 구간 종점행 표시·선택의 순수 계층.
 *
 * "종점행 선호"는 역의 속성이 아니라 여정의 속성이다(분기 이전 하차 = 복수 종점 유효).
 * 그래서 목적지가 고정된 CommuteRoute에 `boardingPreferences`로 귀속되고, 세션은
 * 사본(`destinationPreferences`)만 든다. 이 모듈은 그 도메인의 키잉·필터·옵션 도출·
 * prune만 담당한다 — I/O 없음, RN 없음 (departureDetection.ts와 같은 급).
 */
import type { CommuteRoute } from '@/models/commute';
import type { Train } from '@/models/train';

/** 탑승 구간 식별 키. board = stationId|lineId, transfer = stationId|toLineId. */
export const buildBoardingKey = (stationId: string, lineId: string): string =>
  `${stationId}|${lineId}`;

export interface WaitingTrainPools {
  /** 진행 방향 전체 — 보조 나열·시트 옵션 베이스 (선호 필터와 무관). */
  readonly display: readonly Train[];
  /** 추적 대상 — 칩 카운트다운·알림·출발 감지 베이스. 선호 선택 시 0대 가능. */
  readonly tracked: readonly Train[];
}

const isNumberedLine = (lineId: string): boolean => /^[1-9]$/.test(lineId);

/**
 * RouteGuidanceScreen의 기존 방면 필터(matched-else-onLine 폴백)를 보존하면서
 * display/tracked 2-풀로 확장한다. `preferredDestinations`가 비어 있으면 tracked는
 * 기존 filteredTrains와 동일해야 한다 (회귀 0 계약 — 테스트로 고정).
 */
export const partitionWaitingTrains = (input: {
  readonly trains: readonly Train[];
  readonly lineId: string;
  readonly directionName: string | null;
  readonly preferredDestinations: readonly string[];
}): WaitingTrainPools => {
  const { trains, lineId, directionName, preferredDestinations } = input;
  const onLine = isNumberedLine(lineId) ? trains.filter(t => t.lineId === lineId) : trains;
  const matched =
    directionName === null ? [] : onLine.filter(t => t.finalDestination === directionName);
  // 기존 동작: 방면 매칭 우선, 전무하면 노선 필터 결과 폴백 (단축 운행 종착역 케이스).
  const legacy = matched.length > 0 ? matched : onLine;
  // 물리 방향 anchor — 방면 매칭 열차의 up/down으로 같은 방향 전체를 얻는다.
  // 매칭이 없으면 anchor 불능 → display도 legacy로 강등 (보수적).
  const anchorDirection = matched[0]?.direction;
  const display =
    anchorDirection !== undefined ? onLine.filter(t => t.direction === anchorDirection) : legacy;
  const tracked =
    preferredDestinations.length > 0
      ? display.filter(t => preferredDestinations.includes(t.finalDestination))
      : legacy;
  return { display, tracked };
};

export interface DestinationOption {
  readonly name: string;
  /** 가장 이른 도착 ETA ("N분" | "곧 도착"), 현재 도착 창에 없으면 null. */
  readonly etaText: string | null;
}

const etaTextOf = (train: Train, nowMs: number): string | null => {
  if (train.arrivalTime === null) return null;
  const sec = Math.floor((train.arrivalTime.getTime() - nowMs) / 1000);
  if (sec < 0) return null;
  return sec < 60 ? '곧 도착' : `${Math.floor(sec / 60)}분`;
};

/**
 * 시트 옵션 목록 — display의 distinct 종착역(최초 도착 순) ∪ 저장돼 있으나 현재
 * 도착 창에 없는 선호(etaText null, 뒤에 배치 — 체크 해제 가능해야 하므로 노출 유지).
 */
export const destinationOptions = (
  display: readonly Train[],
  preferred: readonly string[],
  nowMs: number
): readonly DestinationOption[] => {
  const byName = new Map<string, { readonly ms: number; readonly etaText: string | null }>();
  for (const t of display) {
    const ms = t.arrivalTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const existing = byName.get(t.finalDestination);
    if (existing === undefined || ms < existing.ms) {
      byName.set(t.finalDestination, { ms, etaText: etaTextOf(t, nowMs) });
    }
  }
  const present = [...byName.entries()]
    .sort((a, b) => a[1].ms - b[1].ms)
    .map(([name, v]): DestinationOption => ({ name, etaText: v.etaText }));
  const absent = preferred
    .filter(name => !byName.has(name))
    .map((name): DestinationOption => ({ name, etaText: null }));
  return [...present, ...absent];
};

/**
 * 저장 직전 prune — 경로에 존재하는 역(출발+환승)의 키만 유지한다. lineId 부분은
 * 검사하지 않는다(역 단위 prune): 노선만 바뀐 스테일 키는 조회에서 자연 미적용되고,
 * 역이 경로에 있는 한 크기가 유계라 단순함을 택했다. 빈 배열 값도 제거.
 */
export const pruneBoardingPreferences = (
  prefs: Readonly<Record<string, readonly string[]>>,
  route: CommuteRoute
): Readonly<Record<string, readonly string[]>> => {
  const validStations = new Set<string>([
    route.departureStationId,
    ...route.transferStations.map(t => t.stationId),
  ]);
  return Object.fromEntries(
    Object.entries(prefs).filter(
      ([key, value]) => value.length > 0 && validStations.has(key.split('|')[0] ?? '')
    )
  );
};
```

- [ ] **Step 5: 실행 → PASS + 타입 게이트** — `npx jest src/services/guidance/__tests__/destinationPreference.test.ts --watchman=false` PASS, `npx tsc --noEmit` 통과.

- [ ] **Step 6: Commit** — `git add src/models/commute.ts src/models/guidance.ts src/services/guidance/destinationPreference.ts src/services/guidance/__tests__/destinationPreference.test.ts && git commit -m "feat(guidance): 종점행 선호 도메인 모델 + 순수 필터 모듈"`

---

### Task 2: `departureDetection` — 선호 종점행 인지

**Files:**
- Modify: `src/services/guidance/departureDetection.ts`
- Test: `src/services/guidance/__tests__/departureDetection.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Produces: `AwaitedTrain.preferredDestinations?: readonly string[]` — 비어 있지 않으면 방면명 매칭을 **대체**하고, 매칭 후보가 없으면 폴백 없이 NOT_DEPARTED (선호 밖 열차의 출발로 여정을 자동 진행시키지 않는다 — false positive가 비싼 에러라는 이 모듈의 통치 원칙 그대로).

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 테스트 파일의 Train 픽스처 헬퍼를 재사용해 describe 추가:

기존 파일의 픽스처 헬퍼는 `train(over)`와 `arriving(id, etaSec, over)` (13·27행) — 그대로 재사용:

```ts
describe('preferredDestinations', () => {
  it('선호 종점행 열차의 소멸만 출발로 판정한다', () => {
    const macheon = arriving('m1', 10, { finalDestination: '마천' });
    const hanam = arriving('h1', 15, { finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [macheon, hanam],
      next: [hanam],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: ['마천'] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'm1' });
  });

  it('선호 밖 열차(방면 매칭 포함)가 사라져도 출발로 판정하지 않는다', () => {
    const macheon = arriving('m1', 10, { finalDestination: '마천' });
    const hanam = arriving('h1', 15, { finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [macheon, hanam],
      next: [macheon],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: ['마천'] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('선호가 빈 배열이면 기존 방면 동작과 동일하다', () => {
    const hanam = arriving('h1', 15, { finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [hanam],
      next: [],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: [] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'h1' });
  });
});
```

(NOW 상수·`arriving`의 etaSec 의미는 기존 파일 상단 정의를 따른다 — 두 헬퍼 모두 이미 존재.)

- [ ] **Step 2: 실행 → FAIL 확인** — `npx jest src/services/guidance/__tests__/departureDetection.test.ts --watchman=false`

- [ ] **Step 3: 구현** — `AwaitedTrain`에 필드 추가:

```ts
  /** 사용자가 선택한 선호 종점행. 비어 있지 않으면 directionName 매칭을 대체하며,
   *  선호 밖 열차의 출발은 감지하지 않는다 (폴백 없음 — 자동 진행 방지). */
  readonly preferredDestinations?: readonly string[];
```

`detectDeparture` 본문 수정 — `directionMatches` 위에 선호 술어를 두고, 선호가 있으면 폴백 없이 그것만 쓴다:

```ts
  const prefs = awaited.preferredDestinations ?? [];
  const preferMatches = (train: Train): boolean => prefs.includes(train.finalDestination);
```

기존 92-94행의 pool 산출을 다음으로 교체:

```ts
  // 선호 종점행이 지정되면 그것만이 "기다리는 열차"다 — 방면명 best-effort 폴백과
  // 달리 선호 밖 후보로 넓히지 않는다 (선호 밖 열차 출발 = 사용자가 보내는 열차).
  const pool =
    prefs.length > 0
      ? candidates.filter(preferMatches)
      : (() => {
          const preferred =
            numbered && awaited.directionName !== null
              ? candidates.filter(directionMatches)
              : candidates;
          return preferred.length > 0 ? preferred : candidates;
        })();
  if (pool.length === 0) return NOT_DEPARTED;
```

비숫자 노선의 `qualifies` 내 `directionMatches(train)` 호출도 `prefs.length > 0 ? preferMatches(train) : directionMatches(train)`로 교체 (69행의 null-direction 조기 반환은 `prefs.length === 0`일 때만 적용하도록 `if (!numbered && awaited.directionName === null && prefs.length === 0) return NOT_DEPARTED;`).

- [ ] **Step 4: 실행 → PASS** — 기존 describe 포함 전체 파일 PASS (기존 동작 회귀 0 확인).

- [ ] **Step 5: Commit** — `git add src/services/guidance/departureDetection.ts src/services/guidance/__tests__/departureDetection.test.ts && git commit -m "feat(guidance): 출발 감지에 선호 종점행 매칭 추가"`

---

### Task 3: `commuteService` — write-back + 저장 경로 보존

**Files:**
- Modify: `src/services/commute/commuteService.ts`
- Test: `src/services/commute/__tests__/commuteService.test.ts` (기존 파일 있으면 그 mock 세팅에 추가, 없으면 신규 — firebase/firestore는 inline factory로 `jest.mock`)

**Interfaces:**
- Consumes: `pruneBoardingPreferences` (Task 1), `CommuteType` (`@/models/commute`)
- Produces: `updateBoardingPreferences(uid: string, leg: CommuteType, boardingPreferences: Readonly<Record<string, readonly string[]>>): Promise<SaveCommuteResult>`

- [ ] **Step 1: 실패하는 테스트 작성** — 검증 항목 3가지:

```ts
// (기존 commuteService.test의 firestore mock 패턴 재사용. 없으면 아래 factory로 신규 작성)
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ path: 'commuteSettings/uid-1' })),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-ts'),
}));

describe('updateBoardingPreferences', () => {
  it('leg별 dot-path로 boardingPreferences만 부분 업데이트한다', async () => {
    const result = await updateBoardingPreferences('uid-1', 'morning', { 'D1|5': ['마천'] });
    expect(result.success).toBe(true);
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      'morningRoute.boardingPreferences': { 'D1|5': ['마천'] },
      updatedAt: 'server-ts',
    });
  });

  it('evening leg은 eveningRoute 경로를 쓴다', async () => {
    await updateBoardingPreferences('uid-1', 'evening', {});
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      'eveningRoute.boardingPreferences': {},
      updatedAt: 'server-ts',
    });
  });

  it('uid 없으면 실패 result를 반환하고 쓰지 않는다', async () => {
    const result = await updateBoardingPreferences('', 'morning', {});
    expect(result.success).toBe(false);
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('저장 경로의 boardingPreferences 보존', () => {
  it('saveCommuteRoutes는 존재하는 boardingPreferences를 prune해 함께 저장한다', async () => {
    await saveCommuteRoutes('uid-1', withPrefs(MORNING, { 'D1|5': ['마천'], 'GONE|7': ['x'] }), EVENING);
    const written = (setDoc as jest.Mock).mock.calls[0][1];
    expect(written.morningRoute.boardingPreferences).toEqual({ 'D1|5': ['마천'] });
    // 없는 leg에는 필드 자체가 없어야 한다 (undefined 필드 금지)
    expect('boardingPreferences' in written.eveningRoute).toBe(false);
  });

  it('updateMorningRoute / updateEveningRoute도 동일하게 보존한다', async () => {
    await updateMorningRoute('uid-1', withPrefs(MORNING, { 'D1|5': ['마천'] }));
    const morning = (updateDoc as jest.Mock).mock.calls[0][1].morningRoute;
    expect(morning.boardingPreferences).toEqual({ 'D1|5': ['마천'] });
    await updateEveningRoute('uid-1', EVENING);
    const evening = (updateDoc as jest.Mock).mock.calls[1][1].eveningRoute;
    expect('boardingPreferences' in evening).toBe(false);
  });
});
```

(`MORNING`/`EVENING`은 Task 1 테스트의 `ROUTE` 픽스처 형태, `withPrefs = (r, p) => ({ ...r, boardingPreferences: p })`.)

> 스펙의 "계약(no-mock) 1개"에 대한 대체 노트: Firestore 에뮬레이터 round-trip 대신 **setDoc/updateDoc에 전달된 페이로드 객체를 직접 검사**한다. 이 저장 함수들은 필드-by-필드 재구성이라 계약 파손 지점이 정확히 "페이로드에 필드가 실렸는가"이고, 위 테스트가 그 지점을 mock 경유 없이(페이로드는 실제 객체) 고정한다. mocked-seam 함정("호출됨"만 증명)에 해당하지 않는다.

- [ ] **Step 2: 실행 → FAIL 확인**

- [ ] **Step 3: 구현** —
  1. `updateBoardingPreferences` 신규 (updateMorningRoute 아래):

```ts
/**
 * 특정 leg의 boardingPreferences만 dot-path로 부분 업데이트한다.
 * 경로 전체를 다시 쓰지 않으므로(설정 화면과의 동시 편집 등) 다른 필드를
 * 클로버하지 않는다 — stale 전체-객체 spread 저장이 즐겨찾기를 롤백시킨
 * 전례(updateUserPreferences 사건)와 같은 클래스의 사고를 구조적으로 차단.
 */
export const updateBoardingPreferences = async (
  uid: string,
  leg: CommuteType,
  boardingPreferences: Readonly<Record<string, readonly string[]>>
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }
  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    const field =
      leg === 'morning' ? 'morningRoute.boardingPreferences' : 'eveningRoute.boardingPreferences';
    await updateDoc(docRef, { [field]: boardingPreferences, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error) {
    console.error('Error updating boarding preferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다',
    };
  }
};
```

  2. `saveCommuteRoutes`(59-70·71-82행)·`updateMorningRoute`(197-208행)·`updateEveningRoute`(235-246행)의 route 객체 리터럴 각각에 조건부 spread 한 줄 추가 (필드-by-필드 재구성이라 추가하지 않으면 **저장할 때마다 선호가 소리 없이 증발**한다):

```ts
        ...(morningRoute.boardingPreferences !== undefined && {
          boardingPreferences: pruneBoardingPreferences(
            morningRoute.boardingPreferences,
            morningRoute
          ),
        }),
```

(evening 쪽은 `eveningRoute`로 대칭. import: `import { pruneBoardingPreferences } from '@/services/guidance/destinationPreference';` — CommuteType도 import에 추가.)

- [ ] **Step 4: 실행 → PASS + `npx tsc --noEmit`**

- [ ] **Step 5: Commit** — `git commit -m "feat(commute): boardingPreferences dot-path 부분 저장 + 저장 경로 보존"`

---

### Task 4: 세션 attach — `useStartCommuteGuidance` + HomeScreen

**Files:**
- Create: `src/services/guidance/destinationPreferenceSync.ts`
- Modify: `src/hooks/useStartCommuteGuidance.ts`
- Modify: `src/screens/home/HomeScreen.tsx` (218-224행)
- Test: `src/services/guidance/__tests__/destinationPreferenceSync.test.ts`

**Interfaces:**
- Consumes: `loadCommuteRoutes` (commuteService), `getGuidanceSession`/`setGuidanceSession` (guidanceSessionStore), `CommuteType`
- Produces: `attachDestinationPreferences(uid: string, leg: CommuteType, expectedStartedAt: number): Promise<void>`
- `useStartCommuteGuidance` args에 `commuteType?: CommuteType`, `uid?: string` 추가 — HomeScreen이 `activeCommuteType`(HomeScreen:151에 이미 존재)과 `user?.id`를 전달.

- [ ] **Step 1: 실패하는 테스트 작성** — `destinationPreferenceSync.test.ts`:

```ts
import { attachDestinationPreferences } from '@/services/guidance/destinationPreferenceSync';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import {
  clearGuidanceSession,
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';

jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const SESSION = {
  route: { segments: [] } as never,
  fromStationName: 'A',
  toStationName: 'B',
  startedAt: 1_000,
  sourceCommuteType: 'morning' as const,
};

afterEach(() => clearGuidanceSession());

it('로드된 leg의 boardingPreferences를 세션에 attach한다', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['마천'] });
});

it('세션이 바뀌었으면(startedAt 불일치) attach하지 않는다', async () => {
  setGuidanceSession({ ...SESSION, startedAt: 2_000 });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});

it('선호 없음·로드 실패는 조용히 no-op (안내를 막지 않는다)', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(attachDestinationPreferences('uid-1', 'morning', 1_000)).resolves.toBeUndefined();
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});
```

- [ ] **Step 2: 실행 → FAIL 확인**

- [ ] **Step 3: 구현** — `src/services/guidance/destinationPreferenceSync.ts`:

```ts
/**
 * destinationPreferenceSync — CommuteRoute.boardingPreferences ↔ GuidanceSession
 * 사본 사이의 I/O 브리지. 세션 시작 직후 비동기로 선호를 붙인다(attach).
 *
 * 귀속 가드: expectedStartedAt 불일치 시 no-op — 화면이 세션 스왑을 넘겨 살아남아도
 * 옛 여정의 선호가 새 세션을 오염시키지 않는다 (updateGuidanceProgressAnchor의 H2
 * 원칙 그대로). 실패는 삼킨다 — 선호는 부가 기능이며 안내 시작을 막으면 안 된다.
 */
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import {
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import type { CommuteType } from '@/models/commute';

export const attachDestinationPreferences = async (
  uid: string,
  leg: CommuteType,
  expectedStartedAt: number
): Promise<void> => {
  try {
    const settings = await loadCommuteRoutes(uid);
    const route = leg === 'morning' ? settings?.morningRoute : settings?.eveningRoute;
    const prefs = route?.boardingPreferences;
    if (!prefs || Object.keys(prefs).length === 0) return;
    const current = getGuidanceSession();
    if (current === null || current.startedAt !== expectedStartedAt) return;
    setGuidanceSession({ ...current, destinationPreferences: prefs });
  } catch (error) {
    if (__DEV__) console.error('[destinationPreferenceSync] attach failed', error);
  }
};
```

`useStartCommuteGuidance.ts` — args 인터페이스에 `commuteType?: CommuteType; uid?: string;` 추가, 구조분해(33행)에 두 변수 추가, import 2줄 추가(`attachDestinationPreferences` from `@services/guidance/destinationPreferenceSync`, `type CommuteType` from `@/models/commute`), 핸들러(40-52행)를:

```ts
  const handler = useCallback(() => {
    if (!route || !fromStationName || !toStationName) return;
    const startedAt = Date.now();
    setGuidanceSession({
      route,
      fromStationName,
      toStationName,
      startedAt,
      // sourceCommuteType은 동기 기록 — attach(원격 읽기)가 실패해도 시트에서 고른
      // 선호를 leg에 write-back할 수 있어야 한다.
      ...(commuteType !== undefined && { sourceCommuteType: commuteType }),
    });
    if (commuteType !== undefined && uid !== undefined) {
      void attachDestinationPreferences(uid, commuteType, startedAt);
    }
    void notificationService.cancelScheduledMlDepartureAlerts();
    navigation.navigate('RouteGuidance');
  }, [route, fromStationName, toStationName, commuteType, uid, navigation]);
```

`HomeScreen.tsx` 218-224행 호출에 두 줄 추가:

```ts
    commuteType: activeCommuteType,
    uid: user?.id,
```

(HomeScreen의 `user`는 기존 `useAuth()` 사용부에서 — 이미 화면에 있으면 재사용, 없으면 `const { user } = useAuth();` 추가.)

- [ ] **Step 4: 실행 → PASS + `npx tsc --noEmit`** — 기존 useStartCommuteGuidance 테스트가 있으면 함께 실행해 회귀 0 확인.

- [ ] **Step 5: Commit** — `git commit -m "feat(guidance): 출퇴근 진입 세션에 종점행 선호 attach"`

---

### Task 5: `DestinationFilterSheet` 컴포넌트

**Files:**
- Create: `src/components/guidance/DestinationFilterSheet.tsx`
- Modify: `src/components/guidance/index.ts` (export 추가)
- Test: `src/components/guidance/__tests__/DestinationFilterSheet.test.tsx`

**Interfaces:**
- Consumes: `DestinationOption` (Task 1)
- Produces:

```ts
export interface DestinationFilterSheetProps {
  readonly visible: boolean;
  readonly options: readonly DestinationOption[];
  readonly selected: readonly string[];
  readonly onToggle: (name: string) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}
export const DestinationFilterSheet: React.FC<DestinationFilterSheetProps>;
```

- [ ] **Step 1: 실패하는 테스트 작성** — 기존 `TrainSelectSheet.test.tsx`의 mock 세팅(lucide-react-native·theme)을 그대로 복제해 시작:

```ts
const OPTIONS = [
  { name: '마천', etaText: '2분' },
  { name: '하남검단산', etaText: '5분' },
  { name: '강동', etaText: null },
];

it('옵션을 "OO행 · ETA" 행으로 렌더하고 탭 시 onToggle을 호출한다', () => {
  const onToggle = jest.fn();
  const { getByTestId } = render(
    <DestinationFilterSheet visible options={OPTIONS} selected={['마천']}
      onToggle={onToggle} onClear={jest.fn()} onClose={jest.fn()} />
  );
  expect(getByTestId('destination-option-마천')).toHaveTextContent('마천행');
  expect(getByTestId('destination-option-마천')).toHaveTextContent('2분');
  expect(getByTestId('destination-option-강동')).toHaveTextContent('지금은 도착 정보 없음');
  fireEvent.press(getByTestId('destination-option-하남검단산'));
  expect(onToggle).toHaveBeenCalledWith('하남검단산');
});

it('선택된 옵션에 체크 마커, "전체 열차" 행은 선택 없음일 때 활성 표시', () => {
  const { queryByTestId, rerender } = render(
    <DestinationFilterSheet visible options={OPTIONS} selected={['마천']}
      onToggle={jest.fn()} onClear={jest.fn()} onClose={jest.fn()} />
  );
  // 체크 마커의 존재/부재 자체가 검증 대상 — queryByTestId 관용구 사용
  expect(queryByTestId('destination-check-마천')).not.toBeNull();
  expect(queryByTestId('destination-check-하남검단산')).toBeNull();
  expect(queryByTestId('destination-all-active')).toBeNull();
  rerender(
    <DestinationFilterSheet visible options={OPTIONS} selected={[]}
      onToggle={jest.fn()} onClear={jest.fn()} onClose={jest.fn()} />
  );
  expect(queryByTestId('destination-all-active')).not.toBeNull();
  expect(queryByTestId('destination-check-마천')).toBeNull();
});

it('"전체 열차" 탭 시 onClear, 백드롭 탭 시 onClose', () => {
  const onClear = jest.fn();
  const onClose = jest.fn();
  const { getByTestId } = render(
    <DestinationFilterSheet visible options={OPTIONS} selected={['마천']}
      onToggle={jest.fn()} onClear={onClear} onClose={onClose} />
  );
  fireEvent.press(getByTestId('destination-filter-all'));
  expect(onClear).toHaveBeenCalled();
  fireEvent.press(getByTestId('destination-filter-backdrop'));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: 실행 → FAIL 확인**

- [ ] **Step 3: 구현** — `TrainSelectSheet.tsx`(1-287행)를 시각 문법 그대로 따라 작성. 구조 요점 (전체 스타일은 TrainSelectSheet의 `createStyles` 항목을 복제하되 item 우측에 체크 마커 영역 추가):
  - `Modal transparent animationType="slide"` + 백드롭(`testID="destination-filter-backdrop"`) + 시트(`testID="destination-filter-sheet"`).
  - 헤더: 제목 "탈 열차의 종점행 선택", 서브 "선택한 종점행 열차만 안내와 알림에 사용해요", 닫기 버튼 44pt.
  - 최상단 고정 행 "전체 열차"(`testID="destination-filter-all"`, `accessibilityLabel="전체 열차, 종점행 필터 해제"`) — `selected.length === 0`이면 활성 마커(`testID="destination-all-active"`), 탭 시 `onClear()`.
  - `FlatList` 옵션 행 (`keyExtractor: o => o.name`): 좌측 `TrainFront` 아이콘, 제목 `${name}행`, 서브 `etaText ?? '지금은 도착 정보 없음'`, 선택 시 우측 `Check`(lucide) 마커(`testID={\`destination-check-${name}\`}`). 행 `testID={\`destination-option-${name}\`}`, `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`, `accessibilityLabel={\`${name}행${etaText ? \`, ${etaText}\` : ''}\`}`, minHeight 56.
  - 헤더 독스트링에 "다중 선택 = 분기 이전 하차 시 복수 종점행이 모두 유효하기 때문" 한 줄.
  - `index.ts`(현재 7줄, `export { TrainSelectSheet } ... export type { TrainSelectSheetProps }` 형식)에 추가:

```ts
export { DestinationFilterSheet } from './DestinationFilterSheet';
export type { DestinationFilterSheetProps } from './DestinationFilterSheet';
```

- [ ] **Step 4: 실행 → PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(guidance): 종점행 다중 선택 시트 컴포넌트"`

---

### Task 6: `GuidanceNowCard` — 대기 상태 종점행 표시

**Files:**
- Modify: `src/components/guidance/GuidanceNowCard.tsx`
- Test: `src/components/guidance/__tests__/GuidanceNowCard.test.tsx` (기존 파일에 추가)

**Interfaces:**
- Produces (Task 7이 사용):

```ts
export interface WaitPreviewItem {
  readonly destination: string;
  readonly etaText: string;   // "6분" | "곧 도착"
  readonly isMatch: boolean;  // 추적 대상 여부 (필터 없으면 전부 true)
}
```

`GuidanceNowCardProps`에 추가:

```ts
  /** 대기 보조 나열 — 진행 방향 다음 도착 순 최대 2대. 빈 배열/미전달 시 줄 숨김. */
  waitPreview?: readonly WaitPreviewItem[];
  /** 종점행 필터 활성 뱃지 라벨 (예: "하남검단산·마천행만"). null/미전달 시 숨김. */
  destinationFilterLabel?: string | null;
  /** "종점행 선택" 칩 — 미전달 시 칩 숨김 (실시간 옵션이 없는 화면 상태). */
  onOpenDestinationFilter?: () => void;
```

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 GuidanceNowCard.test의 board/transfer 스텝 픽스처 재사용:

```ts
it('대기 상태에서 waitPreview를 도착 순으로 나열하고 매칭 여부를 구분한다', () => {
  const { getByTestId } = render(
    <GuidanceNowCard step={boardStep} elapsedInStepSec={0} liveWaitText="하남검단산행 3분 24초 후 도착"
      waitPreview={[
        { destination: '마천', etaText: '6분', isMatch: false },
        { destination: '하남검단산', etaText: '9분', isMatch: true },
      ]}
      destinationFilterLabel="하남검단산행만"
      onOpenDestinationFilter={jest.fn()} />
  );
  expect(getByTestId('guidance-wait-preview')).toHaveTextContent('마천행 6분');
  expect(getByTestId('guidance-wait-preview')).toHaveTextContent('하남검단산행 9분');
  expect(getByTestId('guidance-destination-badge')).toHaveTextContent('하남검단산행만');
});

it('칩 탭 시 onOpenDestinationFilter 호출, 미전달 시 칩·뱃지 없음', () => {
  const open = jest.fn();
  const { getByTestId, queryByTestId, rerender } = render(
    <GuidanceNowCard step={boardStep} elapsedInStepSec={0} liveWaitText={null}
      onOpenDestinationFilter={open} />
  );
  fireEvent.press(getByTestId('guidance-open-destination-filter'));
  expect(open).toHaveBeenCalled();
  rerender(<GuidanceNowCard step={boardStep} elapsedInStepSec={0} liveWaitText={null} />);
  expect(queryByTestId('guidance-open-destination-filter')).toBeNull();
  expect(queryByTestId('guidance-destination-badge')).toBeNull();
});

it('ride 스텝에서는 대기 전용 UI가 렌더되지 않는다', () => {
  const { queryByTestId } = render(
    <GuidanceNowCard step={rideStep} elapsedInStepSec={0}
      waitPreview={[{ destination: '마천', etaText: '6분', isMatch: true }]}
      destinationFilterLabel="마천행만" onOpenDestinationFilter={jest.fn()} />
  );
  expect(queryByTestId('guidance-wait-preview')).toBeNull();
  expect(queryByTestId('guidance-destination-badge')).toBeNull();
});
```

- [ ] **Step 2: 실행 → FAIL 확인**

- [ ] **Step 3: 구현** — board/transfer 블록(118-188행) 내 `liveChip` 아래에 추가:

```tsx
            {destinationFilterLabel != null && (
              <View style={[styles.destinationBadge, { borderColor: lineColor }]}
                testID="guidance-destination-badge">
                <Text style={[styles.destinationBadgeText, { color: lineColor }]}>
                  {destinationFilterLabel}
                </Text>
              </View>
            )}
            {waitPreview !== undefined && waitPreview.length > 0 && (
              <View style={styles.waitPreviewRow} testID="guidance-wait-preview">
                <Text style={styles.waitPreviewLabel}>다음</Text>
                {waitPreview.map(item => (
                  <Text
                    key={item.destination}
                    style={[styles.waitPreviewItem, !item.isMatch && styles.waitPreviewDimmed]}
                  >
                    {`${item.destination}행 ${item.etaText}`}
                  </Text>
                ))}
              </View>
            )}
            {onOpenDestinationFilter && (
              <Pressable
                onPress={onOpenDestinationFilter}
                style={styles.trainSelectLink}
                accessibilityRole="button"
                accessibilityLabel="탈 열차의 종점행 선택"
                testID="guidance-open-destination-filter"
              >
                <Text style={styles.trainSelectLinkText}>
                  종점이 다른 열차가 섞여 있나요?{' '}
                  <Text style={styles.trainSelectLinkStrong}>종점행 선택</Text>
                </Text>
              </Pressable>
            )}
```

스타일 추가 (createStyles 내, 기존 문법 그대로):

```ts
    destinationBadge: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: WANTED_TOKENS.radius.pill,
      marginTop: 8,
    },
    destinationBadgeText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('800'),
    },
    waitPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    waitPreviewLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    waitPreviewItem: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    waitPreviewDimmed: {
      color: semantic.labelAlt,
    },
```

props 구조분해에 `waitPreview`, `destinationFilterLabel`, `onOpenDestinationFilter` 추가. `WaitPreviewItem` 인터페이스는 파일 상단(`SoftConfirmHandlers` 부근)에 export하고, barrel(`src/components/guidance/index.ts`)에 `export type { WaitPreviewItem } from './GuidanceNowCard';`도 추가한다 (Task 7이 화면에서 import).

- [ ] **Step 4: 실행 → PASS** (기존 카드 테스트 전체 회귀 0)

- [ ] **Step 5: Commit** — `git commit -m "feat(guidance): 대기 카드 종점행 나열·필터 뱃지·선택 칩"`

---

### Task 7: `RouteGuidanceScreen` 배선

**Files:**
- Modify: `src/screens/guidance/RouteGuidanceScreen.tsx`
- Test: `src/screens/guidance/__tests__/RouteGuidanceScreen.test.tsx` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 1-6 전부 (`partitionWaitingTrains`, `buildBoardingKey`, `destinationOptions`, `updateBoardingPreferences`, `DestinationFilterSheet`, `WaitPreviewItem`, awaited.preferredDestinations)

- [ ] **Step 1: 실패하는 테스트 추가** — `RouteGuidanceScreen.test.tsx`(기존 1,340줄)의 render 헬퍼·세션 세팅·useRealtimeTrains mock을 **그대로 재사용**해 아래 5개 검증 포인트를 완전한 테스트로 작성한다 (5호선 분기 픽스처: 하남검단산행 5분 + 마천행 2분). assertion 앵커는 `guidance-live-chip`·`guidance-wait-preview`·`destination-option-*` testID와 `jest.mock`된 commuteService의 `updateBoardingPreferences` spy:

```ts
it('종점행 선호가 있으면 칩 카운트다운이 선호 열차 기준이고 보조 나열은 전체를 보여준다', ...);
// 세션 destinationPreferences={'S1|5': ['하남검단산']} → liveChip 텍스트에 "하남검단산행",
// guidance-wait-preview에 "마천행"(dimmed)과 "하남검단산행" 둘 다 존재

it('선호 매칭 열차가 없으면 "선택한 종점행 열차가 없어요"를 칩에 표시한다', ...);
// prefs=['강동'], 도착 리스트엔 마천·하남만 → liveChip 해당 문구, preview는 여전히 나열

it('시트에서 토글하면 세션 선호가 갱신되고 출퇴근 세션이면 updateBoardingPreferences가 호출된다', ...);
// sourceCommuteType='morning' 세션 → guidance-open-destination-filter 탭 → destination-option-마천 탭
// → getGuidanceSession().destinationPreferences 반영 + updateBoardingPreferences('uid', 'morning', {...})

it('일반 검색 세션(sourceCommuteType 없음)은 시트 토글해도 원격 저장하지 않는다', ...);

it('선호 없음이면 기존 방면 필터 동작 그대로다 (칩=방면 매칭 최선두)', ...);
```

(각 케이스는 기존 테스트 파일의 render 헬퍼·mock 패턴으로 완전한 코드로 작성한다 — 위 주석은 검증 포인트 명세이고, assertion은 `getByTestId('guidance-live-chip')`/`guidance-wait-preview`/`jest.mock`된 commuteService spy로 작성.)

- [ ] **Step 2: 실행 → FAIL 확인**

- [ ] **Step 3: 구현** — 변경 지점 목록 (전부 이 파일 안):

  1. import 추가 (파일 기존 import 블록에):

```ts
import {
  buildBoardingKey,
  destinationOptions,
  partitionWaitingTrains,
} from '@/services/guidance/destinationPreference';
import { updateBoardingPreferences } from '@services/commute/commuteService';
// guidance barrel의 기존 import 라인에 DestinationFilterSheet, type WaitPreviewItem 추가
```

`setGuidanceSession`은 화면에 아직 import돼 있지 않으면 guidanceSessionStore의 기존 import 라인에 추가한다 (`getGuidanceSession`은 145행에서 이미 사용 중).
  2. `formatWaitText`(108-112행) 시그니처 확장:

```ts
const formatWaitText = (totalSec: number, destination: string | null): string => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const head = destination !== null ? `${destination}행` : '다음 열차';
  return m > 0
    ? `${head} ${m}분 ${String(s).padStart(2, '0')}초 후 도착`
    : `${head} ${s}초 후 도착`;
};
```

  3. 선호 상태 (waitingDirection 계산부 아래):

```ts
  // 종점행 선호 — 세션 사본이 SSOT. liveSession(reactive)을 읽어 attach·시트 토글이
  // 즉시 반영된다 (mount-frozen `session`이 아니라).
  const boardingKey =
    isWaitingStep && currentStep !== undefined
      ? buildBoardingKey(currentStep.stationId, waitingLineId)
      : null;
  const selectedDestinations = useMemo((): readonly string[] => {
    if (boardingKey === null) return [];
    return liveSession?.destinationPreferences?.[boardingKey] ?? [];
  }, [liveSession, boardingKey]);
```

  4. `filteredTrains` memo(296-305행)를 2-풀로 교체 — 기존 이름 유지로 diff 최소화:

```ts
  const trainPools = useMemo(
    () =>
      isWaitingStep
        ? partitionWaitingTrains({
            trains: trains ?? [],
            lineId: waitingLineId,
            directionName: waitingDirection,
            preferredDestinations: selectedDestinations,
          })
        : { display: [] as readonly Train[], tracked: [] as readonly Train[] },
    [isWaitingStep, trains, waitingLineId, waitingDirection, selectedDestinations]
  );
  const filteredTrains = trainPools.tracked;
```

(이후 `earliestTrain`(308-317)·알림 effect는 무변경 — tracked를 자동 상속.)

  5. `liveWaitText`(319-323행) 교체:

```ts
  const noMatchingSelection =
    selectedDestinations.length > 0 &&
    trainPools.tracked.length === 0 &&
    trainPools.display.length > 0;
  const liveWaitText = useMemo((): string | null => {
    if (!isWaitingStep) return null;
    if (noMatchingSelection) return '선택한 종점행 열차가 없어요';
    if (earliestTrain?.arrivalTime == null) return null;
    const sec = Math.floor((earliestTrain.arrivalTime.getTime() - nowMs) / 1000);
    return sec >= 0 ? formatWaitText(sec, earliestTrain.finalDestination) : null;
  }, [isWaitingStep, noMatchingSelection, earliestTrain, nowMs]);
```

  6. 파생 UI 데이터 (liveWaitText 아래):

```ts
  const waitPreview = useMemo((): readonly WaitPreviewItem[] => {
    if (!isWaitingStep) return [];
    const upcoming = trainPools.display
      .filter(t => t.arrivalTime !== null && t.arrivalTime.getTime() >= nowMs)
      .sort((a, b) => (a.arrivalTime as Date).getTime() - (b.arrivalTime as Date).getTime())
      .slice(0, 2);
    return upcoming.map(t => {
      const sec = Math.floor(((t.arrivalTime as Date).getTime() - nowMs) / 1000);
      return {
        destination: t.finalDestination,
        etaText: sec < 60 ? '곧 도착' : `${Math.floor(sec / 60)}분`,
        isMatch:
          selectedDestinations.length === 0 ||
          selectedDestinations.includes(t.finalDestination),
      };
    });
  }, [isWaitingStep, trainPools, nowMs, selectedDestinations]);
  const destinationFilterLabel =
    selectedDestinations.length > 0 ? `${selectedDestinations.join('·')}행만` : null;
```

  7. 시트 상태 + 콜백 (trainSelectContext state 부근):

```ts
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  const openDestinationSheet = useCallback((): void => setDestinationSheetOpen(true), []);
  const closeDestinationSheet = useCallback((): void => setDestinationSheetOpen(false), []);

  const applyDestinationPreferences = useCallback(
    (next: Readonly<Record<string, readonly string[]>>): void => {
      // 귀속 가드: mount-frozen session과 같은 여정일 때만 쓴다 (H2 원칙).
      const live = getGuidanceSession();
      if (session === null || live === null || live.startedAt !== session.startedAt) return;
      setGuidanceSession({ ...live, destinationPreferences: next });
      if (live.sourceCommuteType !== undefined && user?.id) {
        // fire-and-forget — 원격 실패해도 세션 필터는 이미 적용됨 (재시도는 다음 토글).
        void updateBoardingPreferences(user.id, live.sourceCommuteType, next);
      }
    },
    [session, user?.id]
  );
  const handleDestinationToggle = useCallback(
    (name: string): void => {
      if (boardingKey === null) return;
      const prev = getGuidanceSession()?.destinationPreferences ?? {};
      const cur = prev[boardingKey] ?? [];
      const nextList = cur.includes(name) ? cur.filter(d => d !== name) : [...cur, name];
      const next: Record<string, readonly string[]> = { ...prev };
      if (nextList.length === 0) {
        delete next[boardingKey];
      } else {
        next[boardingKey] = nextList;
      }
      applyDestinationPreferences(next);
    },
    [boardingKey, applyDestinationPreferences]
  );
  const handleDestinationClear = useCallback((): void => {
    if (boardingKey === null) return;
    const prev = getGuidanceSession()?.destinationPreferences ?? {};
    if (!(boardingKey in prev)) return;
    const next: Record<string, readonly string[]> = { ...prev };
    delete next[boardingKey];
    applyDestinationPreferences(next);
  }, [boardingKey, applyDestinationPreferences]);
```

  8. 출발 감지 effect(545-610행): `awaited`에 `preferredDestinations: selectedDestinations` 추가 + soft-confirm arm 조건(581-587행)에 `&& !destinationSheetOpen` 추가 + 두 값 deps 추가 (시트 열림 중 자동 진행으로 시트가 강제 닫히는 것 방지 — trainSelectContext와 같은 원칙).
  9. 렌더: `GuidanceNowCard`(781-788행)에 `waitPreview={waitPreview}` `destinationFilterLabel={destinationFilterLabel}` `onOpenDestinationFilter={isWaitingStep ? openDestinationSheet : undefined}` 추가. `TrainSelectSheet` 아래에:

```tsx
      <DestinationFilterSheet
        visible={destinationSheetOpen}
        options={destinationOptions(trainPools.display, selectedDestinations, nowMs)}
        selected={selectedDestinations}
        onToggle={handleDestinationToggle}
        onClear={handleDestinationClear}
        onClose={closeDestinationSheet}
      />
```

  주의: `TrainSelectSheet`에는 어떤 필터도 추가하지 않는다 (전체 후보 유지 — 사용자가 필터 밖 열차를 탔다는 사실 보고를 막으면 안 된다).

- [ ] **Step 4: 실행 → PASS** — 신규 + 기존 화면 테스트 전체. `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat(guidance): 대기 카드 종점행 필터 배선 + 시트·write-back"`

---

### Task 8: 회귀 가드 — reverse 미러 드롭 + 설정 화면 pass-through

**Files:**
- Test: `src/models/__tests__/commute.test.ts` (기존 파일에 추가, 없으면 신규)
- Verify+Modify(필요시): `src/screens/settings/CommuteSettingsScreen.tsx`

- [ ] **Step 1: reverse 드롭 테스트** — `reverseCommuteRoute`는 필드-by-필드 재구성이라 `boardingPreferences`가 자연 드롭된다(의도된 동작 — 반대 방향 종점 집합은 무의미). 회귀로 고정:

```ts
it('reverseCommuteRoute는 boardingPreferences를 미러하지 않는다', () => {
  const reversed = reverseCommuteRoute(
    { ...ROUTE, boardingPreferences: { 'D1|5': ['마천'] } },
    '18:30'
  );
  expect(reversed.boardingPreferences).toBeUndefined();
});
```

`reverseCommuteRoute` 반환 객체 위에 주석 한 줄 추가: `// boardingPreferences는 의도적으로 미러하지 않는다 — 반대 방향의 종점 집합은 별개다.`

- [ ] **Step 2: 설정 화면 pass-through 검증** — `CommuteSettingsScreen.tsx`에서 `updateMorningRoute`/`updateEveningRoute`(또는 `saveCommuteRoutes`)에 넘기는 `CommuteRoute` 객체가 **로드된 기존 route의 spread**로 만들어지는지 grep으로 확인한다. 필드-by-필드 신규 구성이라면 로드된 `boardingPreferences`를 조건부 spread로 포함시킨다 (`...(loaded?.boardingPreferences !== undefined && { boardingPreferences: loaded.boardingPreferences })`). 이 확인 결과(수정 여부·근거 파일:줄)를 태스크 보고에 명시한다.

- [ ] **Step 3: 실행 → PASS + Commit** — `git commit -m "test(commute): 종점행 선호 reverse 드롭·설정 저장 보존 회귀 가드"`

---

### Task 9: 최종 게이트

- [ ] `npx tsc --noEmit` (루트)
- [ ] `npx eslint src/services/guidance/destinationPreference.ts src/services/guidance/destinationPreferenceSync.ts src/components/guidance/DestinationFilterSheet.tsx src/components/guidance/GuidanceNowCard.tsx src/screens/guidance/RouteGuidanceScreen.tsx src/hooks/useStartCommuteGuidance.ts src/services/commute/commuteService.ts src/models/commute.ts src/models/guidance.ts --max-warnings 0`
- [ ] 관련 테스트 일괄: `npx jest src/services/guidance src/services/commute src/components/guidance src/screens/guidance src/models --watchman=false --maxWorkers=2`
- [ ] 전체 스위트는 리뷰 통과 후 머지 직전 1회: `npx jest --coverage --watchman=false --maxWorkers=2`
- [ ] 커밋 로그가 태스크당 1커밋인지 확인, 빌드 깨진 채 커밋 금지

## Known limits (구현 아님 — 리뷰어 참고)

- 멀티 클라이언트 동시 편집 시 `destinationPreferences` 맵은 마지막 쓰기 승리 (기존 whole-array 즐겨찾기와 같은 수준의 known-limit).
- 일반 경로 검색 세션의 선택은 세션 종료와 함께 소멸 (스펙의 비범위).
- `display` 풀의 물리 방향 anchor는 방면 매칭 열차가 1대도 없으면 불능 → legacy 폴백 (보수적 강등).
- 계정 삭제 파기는 `commuteSettings/<uid>` 문서 삭제에 포함 — 신규 영속 표면 없음.
