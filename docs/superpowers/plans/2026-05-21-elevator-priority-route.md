# 엘리베이터 우선 경로 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고령자·임산부를 위한 "엘리베이터 우선" 경로를 경로 결과 목록에 라벨 후보로 추가한다.

**Architecture:** 전 서울 역의 엘리베이터 유무를 빌드 타임에 정적 JSON으로 번들. `getDiverseRoutes`가 만든 K-최단경로 후보들을 *환승역 엘리베이터 점수*로 사후 채점해, 환승역에 엘리베이터가 있는 경로를 `category: 'elevator-priority'` 후보로 1개 추가한다.

**Tech Stack:** TypeScript (strict), React Native, Jest. 데이터 소스: data.go.kr 교통약자이용정보 API (`B553766/wksn`).

---

## Spec 정련 (설계 문서 대비 변경점)

설계 문서: `docs/superpowers/specs/2026-05-21-elevator-priority-route-design.md`.

구현 계획 단계에서 `kShortestPath.ts` 내부를 정독한 결과, spec §4.5의 "가중치를 `buildGraph`에 주입" 방식을 다음으로 **정련**한다:

| spec 원안 (Design X) | 본 계획 (Design Y) | 이유 |
|---|---|---|
| `accessibilityMultipliers` 를 `buildGraph` 환승 엣지 가중치에 곱함 | `getDiverseRoutes` 가 만든 K-후보를 *사후 채점* — 환승역 무장애 점수로 1개 선택 | `buildGraph` 가중치에 penalty를 넣으면 route의 `totalMinutes` 가 penalty만큼 부풀려져 표시됨(UX 버그). 사후 채점은 실제 시간을 보존 |
| `accessibilityWeight.ts` (multiplier 맵) | `stationAccessibility.ts` (elevator 유무 lookup) | Design Y는 multiplier가 아닌 boolean 조회만 필요 |
| 명명 상수 `NO_ELEVATOR_TRANSFER_MULTIPLIER` | 불필요 (순수 카운팅) | penalty 크기 튜닝 대신 "무장애 환승 수 최소" 결정론적 선택 |
| `buildGraph` 시그니처 변경 (2파일) | `buildGraph` 미변경 | 회귀 표면적 축소 |

**불변**: 사용자 대면 설계(핵심 모델 "환승역 엘리베이터 페널티", 데이터 전략 Approach A, UX 진입점, 에러 처리, 테스트 정책, 성공 기준, 비목표)는 모두 spec 그대로다. 바뀐 것은 *penalty가 적용되는 내부 위치*뿐이다.

---

## File Structure

| 파일 | 신규/수정 | 책임 |
|---|---|---|
| `scripts/fetchStationAccessibility.ts` | 신규 | data.go.kr → `stationAccessibility.json` 1회성 생성. 앱 번들 아님 |
| `src/data/stationAccessibility.json` | 신규 | 역별 `{ hasElevator, elevatorCount }` SoT |
| `src/services/route/stationAccessibility.ts` | 신규 | JSON 로드 → `stationHasElevator(stationId)` lookup. `transferTime.ts` 와 병렬 |
| `src/services/route/__tests__/stationAccessibility.test.ts` | 신규 | 위 모듈 unit test |
| `src/models/route.ts` | 수정 | `RouteCategory` union 에 `'elevator-priority'` 추가 |
| `src/components/route/RouteCard.tsx` | 수정 | `CATEGORY_TAGS` 에 `'elevator-priority'` 엔트리 추가 |
| `src/services/route/kShortestPath.ts` | 수정 | 순수 헬퍼 2개 + `getDiverseRoutes` 사후 선택 추가 |
| `src/services/route/__tests__/kShortestPath.test.ts` | 수정 | elevator-priority 헬퍼·통합 테스트 |

`src/data/` 가 프로젝트의 JSON SoT 위치다 (`lineSpeed.json`, `segmentSpeed.json`, `transferTimes.json` 이 모두 여기 있고 `@/data/*.json` 으로 import 됨).

---

## Task 1: 정적 데이터셋 생성 — 빌드 스크립트 + JSON

빌드 타임 1회성 작업. 라이브 API I/O라 TDD 대신 작성→실행→산출물 검증 구조.

**Files:**
- Create: `scripts/fetchStationAccessibility.ts`
- Create (스크립트 산출): `src/data/stationAccessibility.json`

- [ ] **Step 1: 빌드 스크립트 작성**

`scripts/fetchStationAccessibility.ts`:

```typescript
/**
 * fetchStationAccessibility — one-off generator for src/data/stationAccessibility.json
 *
 * data.go.kr 교통약자이용정보 API(B553766/wksn)를 역명별로 조회해 엘리베이터
 * 유무를 기록한다. 엘리베이터 유무는 거의 안 변하므로 가끔만 재실행한다.
 *
 * 실행:
 *   EXPO_PUBLIC_DATA_PORTAL_API_KEY=<key> npx ts-node scripts/fetchStationAccessibility.ts
 *
 * 네트워크: apis.data.go.kr 는 sandbox allowlist 에 없다 — sandbox 해제 또는
 * 일반 터미널에서 실행할 것.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { STATIONS } from '../src/utils/subwayMapData';

const API_KEY = process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY ?? '';
const ENDPOINT = 'https://apis.data.go.kr/B553766/wksn/stnInfoList';
const RATE_LIMIT_MS = 1100; // data.go.kr 1초 제한 + 여유

interface RawItem {
  readonly stinNm: string;
  readonly elvtrSttus?: string; // 엘리베이터 개수 (문자열)
}
interface RawResponse {
  readonly response: { readonly body: { readonly items: readonly RawItem[] } };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 한 역명의 엘리베이터 개수 조회. 실패 시 null. */
async function fetchElevatorCount(stationName: string): Promise<number | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.append('serviceKey', decodeURIComponent(API_KEY));
  url.searchParams.append('numOfRows', '10');
  url.searchParams.append('pageNo', '1');
  url.searchParams.append('stinNm', stationName);
  url.searchParams.append('type', 'json');
  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as RawResponse;
    const item = json.response?.body?.items?.[0];
    if (!item) return null;
    const count = Number.parseInt(item.elvtrSttus ?? '0', 10);
    return Number.isNaN(count) ? 0 : count;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error('EXPO_PUBLIC_DATA_PORTAL_API_KEY 미설정');
    process.exit(1);
  }

  // 역명 → 그 역명을 쓰는 stationId 목록 (환승역은 노선별 다른 id 가 같은 역명 공유)
  const nameToIds = new Map<string, string[]>();
  for (const station of Object.values(STATIONS)) {
    const list = nameToIds.get(station.name) ?? [];
    list.push(station.id);
    nameToIds.set(station.name, list);
  }

  const stations: Record<string, { hasElevator: boolean; elevatorCount: number }> = {};
  const failed: string[] = [];
  const names = [...nameToIds.keys()];

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const count = await fetchElevatorCount(name);
    if (count === null) {
      failed.push(name);
    } else {
      for (const id of nameToIds.get(name)!) {
        stations[id] = { hasElevator: count > 0, elevatorCount: count };
      }
    }
    console.log(`[${i + 1}/${names.length}] ${name}: ${count ?? 'FAILED'}`);
    if (i < names.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'data.go.kr/B553766/wksn/stnInfoList',
    stations,
  };
  const outPath = join(__dirname, '../src/data/stationAccessibility.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`\n작성: ${outPath} (${Object.keys(stations).length} stations)`);
  if (failed.length > 0) {
    console.warn(`실패 ${failed.length}역 (런타임 neutral 처리됨): ${failed.join(', ')}`);
  }
}

void main();
```

> 참고: `STATIONS` 가 `subwayMapData` 의 plain 데이터 export 라면 ts-node 에서 그대로 import 된다. RN 전용 import 를 끌어와 ts-node 실행이 실패하면, `STATIONS` 의 원천 JSON(`src/data/` 내)을 직접 읽도록 import 한 줄만 교체한다.

- [ ] **Step 2: 스크립트 실행 (네트워크 필요 — sandbox 해제 또는 일반 터미널)**

Run: `EXPO_PUBLIC_DATA_PORTAL_API_KEY=<key> npx ts-node scripts/fetchStationAccessibility.ts`
Expected: `[N/N]` 진행 로그 후 `작성: .../stationAccessibility.json (NNN stations)`. 실패 역이 있으면 경고 목록 출력 (부분 산출도 유효).

- [ ] **Step 3: 산출 JSON 검증**

Run: `node -e "const d=require('./src/data/stationAccessibility.json'); const n=Object.keys(d.stations).length; const ele=Object.values(d.stations).filter(s=>s.hasElevator).length; console.log('stations:',n,'hasElevator:',ele); if(n<200) throw new Error('too few stations');"`
Expected: `stations: NNN hasElevator: MMM` — `n` 이 200 이상, `hasElevator` 가 0보다 큼.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetchStationAccessibility.ts src/data/stationAccessibility.json
git commit -m "feat(route): 역별 엘리베이터 데이터셋 + 생성 스크립트"
```

---

## Task 2: stationAccessibility 로더 모듈

**Files:**
- Create: `src/services/route/stationAccessibility.ts`
- Test: `src/services/route/__tests__/stationAccessibility.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/services/route/__tests__/stationAccessibility.test.ts`:

```typescript
/**
 * stationAccessibility 단위 테스트.
 *
 * 번들 JSON 을 jest.mock 으로 대체해 입력을 통제한다 (factory 내부 inline 정의 —
 * .claude/rules/coverage-thresholds.md 의 호이스팅 안전 패턴).
 */
jest.mock('@/data/stationAccessibility.json', () => ({
  generatedAt: '2026-05-21T00:00:00+09:00',
  source: 'test',
  stations: {
    'STN_WITH': { hasElevator: true, elevatorCount: 2 },
    'STN_WITHOUT': { hasElevator: false, elevatorCount: 0 },
  },
}));

import { stationHasElevator } from '../stationAccessibility';

describe('stationHasElevator', () => {
  it('엘리베이터 있는 역 → true', () => {
    expect(stationHasElevator('STN_WITH')).toBe(true);
  });

  it('엘리베이터 없는 역 → false', () => {
    expect(stationHasElevator('STN_WITHOUT')).toBe(false);
  });

  it('데이터셋에 없는 역 → undefined (unknown — "없음"으로 단정하지 않음)', () => {
    expect(stationHasElevator('STN_UNKNOWN')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest src/services/route/__tests__/stationAccessibility.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../stationAccessibility'`

- [ ] **Step 3: 모듈 구현**

`src/services/route/stationAccessibility.ts`:

```typescript
/**
 * stationAccessibility — 역별 엘리베이터 유무 lookup.
 *
 * `src/data/stationAccessibility.json` (scripts/fetchStationAccessibility.ts 산출)
 * 을 읽어 stationId 로 조회한다. `transferTime.ts` 와 동일한 정적-JSON-테이블 패턴.
 *
 * Invariants:
 *  - 같은 입력 → 같은 출력 (deterministic)
 *  - 데이터셋에 없는 역 → undefined (unknown). "엘리베이터 없음"으로 단정하지 않는다.
 *  - JSON 의 stations 키 부재 시 빈 테이블 → 모두 undefined (기능 inert, graceful)
 */
import accessibilityJson from '@/data/stationAccessibility.json';

interface StationAccessibilityEntry {
  readonly hasElevator: boolean;
  readonly elevatorCount: number;
}
interface StationAccessibilityFile {
  readonly generatedAt: string;
  readonly source: string;
  readonly stations: Readonly<Record<string, StationAccessibilityEntry>>;
}

const FILE = accessibilityJson as StationAccessibilityFile;
const TABLE: Readonly<Record<string, StationAccessibilityEntry>> = FILE.stations ?? {};

/**
 * 역의 엘리베이터 보유 여부.
 * @returns `true`/`false` = 데이터 있음, `undefined` = 데이터셋 미수록(unknown)
 */
export function stationHasElevator(stationId: string): boolean | undefined {
  return TABLE[stationId]?.hasElevator;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest src/services/route/__tests__/stationAccessibility.test.ts --watchman=false`
Expected: PASS — 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/services/route/stationAccessibility.ts src/services/route/__tests__/stationAccessibility.test.ts
git commit -m "feat(route): stationAccessibility 엘리베이터 유무 로더"
```

---

## Task 3: RouteCategory 라벨 추가 + RouteCard 태그

`RouteCard.tsx` 의 `CATEGORY_TAGS` 는 `Record<RouteCategory, ...>` 라 `RouteCategory` 에 키를 더하면 *즉시* 타입 에러가 난다. 따라서 타입 변경과 `CATEGORY_TAGS` 엔트리는 **같은 커밋**이어야 빌드가 green 으로 유지된다.

**Files:**
- Modify: `src/models/route.ts` (`RouteCategory` 정의, L59-68 부근)
- Modify: `src/components/route/RouteCard.tsx` (`CATEGORY_TAGS`, L20-24)
- Test: `src/components/route/__tests__/RouteCard.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/route/__tests__/RouteCard.test.tsx` 에 추가:

```typescript
it('elevator-priority 경로 → "엘리베이터 우선" 태그 렌더', () => {
  const route = {
    segments: [],
    totalMinutes: 30,
    transferCount: 1,
    lineIds: ['2'],
    category: 'elevator-priority' as const,
    etaMinutes: 30,
  };
  const { getByText } = render(
    <RouteCard route={route as never} expanded={false} onToggleExpand={() => {}} />,
  );
  expect(getByText('엘리베이터 우선')).toBeTruthy();
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest src/components/route/__tests__/RouteCard.test.tsx --watchman=false`
Expected: FAIL — `'elevator-priority'` 가 `RouteCategory` 에 없어 타입 에러 또는 태그 미렌더

- [ ] **Step 3: RouteCategory 에 라벨 추가**

`src/models/route.ts` — `RouteCategory` 정의를 다음으로 교체:

```typescript
/**
 * Why a route was suggested. Set by `getDiverseRoutes` when picking the
 * fastest, fewest-transfer, via-station, and elevator-priority routes from
 * the K-shortest candidates.
 *
 * - 'fastest': 최단 시간 (Yen output 첫 번째)
 * - 'min-transfer': 환승 최소 (fastest보다 환승 적을 때만)
 * - 'via-station': 특정 환승역 경유 (viaTags에 라벨 텍스트)
 * - 'elevator-priority': 환승역에 엘리베이터가 있는 경로 (고령자·임산부 best-effort)
 */
export type RouteCategory = 'fastest' | 'min-transfer' | 'via-station' | 'elevator-priority';
```

- [ ] **Step 4: RouteCard 의 CATEGORY_TAGS 에 엔트리 추가**

`src/components/route/RouteCard.tsx` — `CATEGORY_TAGS`(L20-24)를 다음으로 교체:

```typescript
const CATEGORY_TAGS: Record<RouteCategory, readonly string[]> = {
  'fastest': ['추천', '최단'],
  'min-transfer': ['환승최소', '빠른길'],
  'via-station': [],
  'elevator-priority': ['엘리베이터 우선', '환승역 엘베'],
};
```

> 두 번째 태그 `'환승역 엘베'` 는 best-effort 성격을 정직하게 전달한다 — 이 경로가 보장하는 것은 "환승역에 엘리베이터가 있다"이지 "계단 0"이 아니다.

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `npx jest src/components/route/__tests__/RouteCard.test.tsx --watchman=false`
Expected: PASS — 신규 케이스 포함 전부 pass

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0 (특히 `CATEGORY_TAGS` exhaustiveness)

- [ ] **Step 7: Commit**

```bash
git add src/models/route.ts src/components/route/RouteCard.tsx src/components/route/__tests__/RouteCard.test.tsx
git commit -m "feat(route): elevator-priority RouteCategory + RouteCard 태그"
```

---

## Task 4: getDiverseRoutes 에 elevator-priority 후보 사후 선택

핵심 로직은 순수 함수 `noElevatorTransferCount` / `pickElevatorPriorityRoute` 로 분리·export 해 합성 `Route` 객체로 결정론적 단위 테스트하고, `getDiverseRoutes` 통합은 스모크로 확인한다.

**Files:**
- Modify: `src/services/route/kShortestPath.ts` (import + 헬퍼 + `getDiverseRoutes` L824-838)
- Test: `src/services/route/__tests__/kShortestPath.test.ts`

- [ ] **Step 1: 순수 헬퍼 실패 테스트 작성**

`src/services/route/__tests__/kShortestPath.test.ts` 에 추가:

```typescript
jest.mock('@/data/stationAccessibility.json', () => ({
  generatedAt: 'test', source: 'test',
  stations: {
    'STN_NO': { hasElevator: false, elevatorCount: 0 },
    'STN_YES': { hasElevator: true, elevatorCount: 1 },
  },
}));

import {
  getDiverseRoutes,
  noElevatorTransferCount,
  pickElevatorPriorityRoute,
} from '../kShortestPath';
import type { Route, RouteSegment } from '@/models/route';

function seg(fromStationId: string, isTransfer: boolean): RouteSegment {
  return {
    fromStationId,
    fromStationName: fromStationId,
    toStationId: 'DEST',
    toStationName: 'DEST',
    lineId: '1',
    lineName: '1호선',
    estimatedMinutes: 1,
    isTransfer,
  };
}
function route(segs: RouteSegment[], totalMinutes: number): Route {
  return {
    segments: segs,
    totalMinutes,
    transferCount: segs.filter((s) => s.isTransfer).length,
    lineIds: ['1'],
  };
}

describe('noElevatorTransferCount', () => {
  it('엘리베이터 없는 환승역만 카운트', () => {
    const r = route([seg('STN_NO', true), seg('STN_YES', true)], 10);
    expect(noElevatorTransferCount(r)).toBe(1);
  });
  it('데이터셋에 없는 환승역(unknown)은 카운트하지 않음', () => {
    const r = route([seg('STN_UNKNOWN', true)], 10);
    expect(noElevatorTransferCount(r)).toBe(0);
  });
  it('비-환승 세그먼트는 무시', () => {
    const r = route([seg('STN_NO', false)], 10);
    expect(noElevatorTransferCount(r)).toBe(0);
  });
});

describe('pickElevatorPriorityRoute', () => {
  it('fastest 보다 무장애 환승이 적은 경로를 반환', () => {
    const fastest = route([seg('STN_NO', true)], 10);
    const alt = route([seg('STN_YES', true)], 14);
    expect(pickElevatorPriorityRoute([fastest, alt], fastest)).toBe(alt);
  });
  it('fastest 가 이미 무장애(cost 0)면 null', () => {
    const fastest = route([seg('STN_YES', true)], 10);
    const alt = route([seg('STN_NO', true)], 14);
    expect(pickElevatorPriorityRoute([fastest, alt], fastest)).toBeNull();
  });
  it('fastest 보다 나은 후보가 없으면 null', () => {
    const fastest = route([seg('STN_NO', true)], 10);
    const alt = route([seg('STN_NO', true)], 14);
    expect(pickElevatorPriorityRoute([fastest, alt], fastest)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx jest src/services/route/__tests__/kShortestPath.test.ts -t "noElevatorTransferCount|pickElevatorPriorityRoute" --watchman=false`
Expected: FAIL — `noElevatorTransferCount` / `pickElevatorPriorityRoute` export 부재

- [ ] **Step 3: import + 순수 헬퍼 구현**

`src/services/route/kShortestPath.ts` 상단 import 에 추가:

```typescript
import { stationHasElevator } from './stationAccessibility';
```

`labelViaStation` 함수 아래에 추가:

```typescript
/**
 * 경로가 경유하는 환승역 중 엘리베이터가 *없는* 역의 수.
 * `undefined`(데이터 미수록)는 세지 않는다 — 모르는 것을 "없음"으로 단정하면
 * 거짓 신호가 된다 (설계 문서 §4.6). export 사유: 순수 함수 단위 테스트.
 */
export function noElevatorTransferCount(route: Route): number {
  return route.segments
    .filter((s) => s.isTransfer)
    .filter((s) => stationHasElevator(s.fromStationId) === false).length;
}

function labelElevatorPriority(route: Route): Route {
  return { ...route, category: 'elevator-priority' };
}

/**
 * reachableReps 중 무장애 환승이 가장 적은 raw 경로를 반환 (동점 시 최단 시간).
 * fastest 보다 *엄격히* 무장애 환승이 적을 때만 반환 — 아니면 null.
 * 라벨링하지 않은 raw rep 을 반환하므로, 호출자가 fastest/minTransfer 와
 * 참조 비교(`===`)로 중복을 판정할 수 있다 (labelXxx 는 새 객체를 만들어
 * 참조가 달라지므로 라벨링 전에 비교해야 한다).
 */
export function pickElevatorPriorityRoute(
  reachableReps: readonly Route[],
  fastest: Route,
): Route | null {
  const fastestCost = noElevatorTransferCount(fastest);
  if (fastestCost === 0) return null; // fastest 가 이미 무장애 — 별도 카드 불필요
  let best: Route | null = null;
  let bestCost = fastestCost;
  for (const r of reachableReps) {
    const cost = noElevatorTransferCount(r);
    if (cost < bestCost || (cost === bestCost && best !== null && r.totalMinutes < best.totalMinutes)) {
      best = r;
      bestCost = cost;
    }
  }
  return best !== null && bestCost < fastestCost ? best : null;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx jest src/services/route/__tests__/kShortestPath.test.ts -t "noElevatorTransferCount|pickElevatorPriorityRoute" --watchman=false`
Expected: PASS — 6 passed

- [ ] **Step 5: getDiverseRoutes 에 elevator-priority 후보 삽입**

`getDiverseRoutes` 의 "5. Adaptive selection" 블록(L824-838)을 다음으로 교체:

```typescript
  // 5. Adaptive selection up to maxRoutes
  const selected: Route[] = [labelFastest(fastest)];
  if (minTransfer) {
    selected.push(labelMinTransfer(minTransfer));
  }

  // elevator-priority: K-후보를 환승역 무장애 점수로 사후 채점해 1개 추가.
  // raw rep 으로 fastest/min-transfer 와 참조 비교해 중복을 걸러내고, via-station
  // 풀에서도 제외한다. fastest/min-transfer 와 동급의 primary 카드다.
  const elevatorRep = pickElevatorPriorityRoute(reachableReps, fastest);
  const elevatorPriority =
    elevatorRep && elevatorRep !== fastest && elevatorRep !== minTransfer
      ? elevatorRep
      : null;
  if (elevatorPriority) {
    selected.push(labelElevatorPriority(elevatorPriority));
  }

  const remaining = reachableReps.filter(
    (r) => r !== fastest && r !== minTransfer && r !== elevatorPriority,
  );
  for (const r of remaining) {
    if (selected.length >= maxRoutes) break;
    selected.push(labelViaStation(r));
  }

  return selected;
```

- [ ] **Step 6: getDiverseRoutes 통합 스모크 테스트**

`kShortestPath.test.ts` 에 추가 — 새 픽스처를 발굴하지 말고, `kShortestPath.integration.test.ts` 가 이미 쓰는 환승 포함 OD 쌍을 그대로 가져와 `SMOKE_FROM_ID`/`SMOKE_TO_ID` 로 둔다:

```typescript
describe('getDiverseRoutes — elevator-priority 통합 스모크', () => {
  it('crash 없이 동작하고, elevator-priority 가 나오면 fastest 보다 무장애 환승이 적음', () => {
    const routes = getDiverseRoutes(SMOKE_FROM_ID, SMOKE_TO_ID);
    expect(routes.length).toBeGreaterThan(0);
    const ep = routes.find((r) => r.category === 'elevator-priority');
    if (ep) {
      expect(noElevatorTransferCount(ep)).toBeLessThan(
        noElevatorTransferCount(routes[0]!),
      );
    }
  });
});
```

> 핵심 선택 로직은 Step 1 의 순수 함수 테스트가 결정론적으로 커버한다. 이 스모크는 `getDiverseRoutes` 가 헬퍼를 올바르게 호출하고 회귀 없이 동작하는지만 확인한다.

- [ ] **Step 7: 전체 route 테스트 회귀 확인**

Run: `npx jest src/services/route --watchman=false`
Expected: PASS — `getDiverseRoutes` 시그니처 무변경, 기존 통합/단위 테스트 회귀 0

- [ ] **Step 8: Commit**

```bash
git add src/services/route/kShortestPath.ts src/services/route/__tests__/kShortestPath.test.ts
git commit -m "feat(route): getDiverseRoutes elevator-priority 후보 사후 선택"
```

---

## Task 5: 통합 검증

**Files:**
- 검증만 (코드 변경 없음, 필요 시 `src/hooks/useRouteSearch.ts` 확인)

- [ ] **Step 1: useRouteSearch 가 category 필터링 없이 모든 route 전달하는지 확인**

Run: `grep -n "category" src/hooks/useRouteSearch.ts`
Expected: `getDiverseRoutes` 결과를 category 로 거르는 코드가 없음 — elevator-priority route 가 `RouteWithMLMeta` 로 래핑돼 그대로 화면까지 전달됨. (필터링이 있다면 `'elevator-priority'` 를 통과 목록에 포함하도록 수정 + 그 변경에 테스트 추가.)

- [ ] **Step 2: 전체 타입체크 + 라우트/컴포넌트 테스트**

Run: `npx tsc --noEmit && npx jest src/services/route src/components/route --watchman=false`
Expected: 타입 에러 0, 테스트 전부 pass

- [ ] **Step 3: 커버리지 확인**

Run: `npx jest src/services/route/__tests__/stationAccessibility.test.ts src/services/route/__tests__/kShortestPath.test.ts --coverage --collectCoverageFrom='src/services/route/stationAccessibility.ts' --watchman=false`
Expected: `stationAccessibility.ts` 커버리지 Stmt 75% / Fn 70% / Branch 60% 이상

- [ ] **Step 4: Commit (검증 단계라 변경 있을 때만)**

Step 1 에서 `useRouteSearch` 수정이 필요했을 경우에만:

```bash
git add src/hooks/useRouteSearch.ts
git commit -m "fix(route): useRouteSearch 가 elevator-priority route 전달하도록 보정"
```

---

## 성공 기준 점검 (설계 문서 §5)

| # | 기준 | 검증 |
|---|---|---|
| 1 | 경로 목록에 "엘리베이터 우선" 후보가 (해당될 때) 나타남 | Task 4 Step 6 (통합 스모크) |
| 2 | 환승역에 엘리베이터 있는 경로가 선택됨 | Task 4 Step 1·4 (`pickElevatorPriorityRoute` 순수 함수 테스트) |
| 3 | 데이터 부재/오류 시 크래시 없이 기존 경로만 표시 | Task 2 Step 1 (빈/미수록 → undefined) + Task 4 Step 1 ("fastest cost 0 → null") |
| 4 | 기존 route 테스트 회귀 0 | Task 4 Step 7 |
| 5 | 커버리지 75/70/60 충족 | Task 5 Step 3 |
| 6 | UI 라벨이 best-effort 성격 정직 표기 | Task 3 Step 4 (`'환승역 엘베'` 태그) |

---

## 실행 순서 / 의존성

```
Task 1 (데이터셋) ──┐
                   ├─→ Task 4 (getDiverseRoutes) ─→ Task 5 (통합 검증)
Task 2 (로더) ──────┤
Task 3 (라벨+태그) ─┘
```

Task 1·2·3 은 서로 독립 — 병렬 가능. Task 4 는 1·2·3 모두 완료 후 (Task 2 의 `stationHasElevator`, Task 3 의 `'elevator-priority'` 타입에 의존). Task 5 는 마지막.
모든 파일이 `src/services/route/` + `src/models/` + `src/components/route/` 에 모여 있어 File Lock 충돌 위험 낮음.
