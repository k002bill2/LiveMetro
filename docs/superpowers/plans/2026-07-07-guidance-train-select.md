# 길안내 탑승 열차 선택/변경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 길안내 중 탑승 버튼을 놓쳤거나 탑승 열차를 바꿔야 할 때, 최근 출발 열차 목록에서 선택해 진행 anchor를 그 열차의 출발 시각으로 소급 보정한다.

**Architecture:** 대기 단계 폴링 스냅샷에서 사라진 열차를 heap 로그(`departedTrainLog`)에 기록하고, 공용 `TrainSelectSheet`에서 선택하면 `useGuidanceProgress`의 새 rebase API(`goNextAt`/`rebaseAt`)로 과거 시각 anchor를 세운다. 열차 정체성 추적 없음 — 시간 보정만.

**Tech Stack:** React Native 0.72 / Expo 49 / TypeScript strict / Jest + RNTL

**Spec:** `docs/superpowers/specs/2026-07-07-guidance-train-select-design.md`

## Global Constraints

- 모든 import는 `@/` path alias (상대 경로 금지)
- `StyleSheet.create()` + 테마 토큰(`useSemanticTokens`, `WANTED_TOKENS`) — 하드코딩 색상 금지
- `fontWeight` 단독 금지 → `weightToFontFamily('700')` (pre-commit `lint:typography` 차단)
- 모든 터치 요소 `accessibilityRole`/`accessibilityLabel` + 최소 44pt 높이
- `any` 금지, exported 함수 명시적 반환 타입
- 모든 `useEffect`/타이머 cleanup
- Immutability — 로그 병합은 항상 새 배열 반환
- 테스트: Happy + Error + Edge 의무, mock은 factory 내부 inline, `getByTestId` 우선
- 파일 수정 전 필독: `CLAUDE.md`, `COMPONENT_SHOWCASE.md` (mandatory-docs 규칙)
- 커밋 메시지 Conventional Commits, Task 단위 커밋

---

### Task 1: departedTrainLog — 출발 열차 로그 (순수 함수 + heap 스토어)

**Files:**
- Create: `src/services/guidance/departedTrainLog.ts`
- Test: `src/services/guidance/__tests__/departedTrainLog.test.ts`

**Interfaces (Produces):**

```typescript
export interface DepartedTrainEntry {
  readonly trainId: string;
  readonly finalDestination: string;
  readonly lineId: string;
  /** 관측된 대기 역 이름 — 표시/필터 키 */
  readonly stationName: string;
  readonly departedAtMs: number;
  readonly confidence: 'observed' | 'estimated';
}

export const DEPARTED_LOG_RETENTION_MS = 15 * 60 * 1000;
/** 추정 항목의 도착→출발 정차 가산치 */
export const ESTIMATED_DWELL_MS = 30 * 1000;

export interface CollectDeparturesInput {
  readonly prev: readonly Train[] | null;
  readonly next: readonly Train[];
  readonly lineId: string;
  readonly stationName: string;
  readonly nowMs: number;
  readonly thresholdSec?: number; // default ARRIVING_ETA_THRESHOLD_SEC
}
export const collectDepartures = (input: CollectDeparturesInput): DepartedTrainEntry[];

export interface CollectEstimatesInput {
  readonly trains: readonly Train[];
  readonly lineId: string;
  readonly stationName: string;
  readonly nowMs: number;
}
export const collectEstimates = (input: CollectEstimatesInput): DepartedTrainEntry[];

export const mergeLog = (
  log: readonly DepartedTrainEntry[],
  incoming: readonly DepartedTrainEntry[],
  nowMs: number
): DepartedTrainEntry[];

// module heap store (boardingSelectionStore 미러 — AsyncStorage 영속 없음)
export const getDepartedTrainLog = (): readonly DepartedTrainEntry[];
export const appendDepartedTrains = (entries: readonly DepartedTrainEntry[], nowMs: number): void;
export const clearDepartedTrainLog = (): void;
```

**로직 명세:**
- `collectDepartures`: `departureDetection.ts:59-100`의 사라짐 감지와 같은 원리. `prev === null || prev.length === 0` → `[]`. 후보 조건: 번호선(`/^[1-9]$/.test(lineId)`)이면 `t.lineId === lineId`, 광역선은 전체 통과(사람이 행선지로 판별); `arrivalTime !== null` 이고 `0 <= eta <= thresholdSec`. 후보 중 `next`의 id Set에 없는 열차 전부 → `departedAtMs: nowMs, confidence: 'observed'`. soft-confirm과 달리 **단일 판정이 아니라 전부 기록**하고 방면 필터는 하지 않는다.
- `collectEstimates`: 탑승 확정 순간의 마지막 스냅샷용. 노선 필터(위와 동일) + `arrivalTime !== null` + `eta >= 0`인 열차 → `departedAtMs: arrivalTime.getTime() + ESTIMATED_DWELL_MS, confidence: 'estimated'`.
- `mergeLog`: `[...log, ...incoming]`에서 ① trainId dedup — `observed`가 `estimated`를 이김, 같은 confidence면 departedAtMs 큰 쪽; ② `departedAtMs < nowMs - DEPARTED_LOG_RETENTION_MS` prune; ③ departedAtMs 내림차순 정렬. 입력 불변(새 배열 반환).
- heap 스토어: 모듈 레벨 `let log: readonly DepartedTrainEntry[] = []`. `appendDepartedTrains`는 `entries.length === 0`이면 no-op(불필요한 prune churn 회피 아님 — prune은 get에서 안 하고 append에서만 하므로 no-op 허용), 아니면 `log = mergeLog(log, entries, nowMs)`.

- [ ] **Step 1: 실패 테스트 작성** — 아래 케이스를 전부 명시적으로 작성 (생략 주석 금지):
  - `collectDepartures`: 도착 중(ETA 20s) 열차가 next에서 사라짐 → observed 1건 / next에 잔존 → 0건 / ETA 60s(threshold 밖) → 0건 / ETA null → 0건 / `prev: null` → `[]` / 번호선 lineId 불일치 제외 / 광역선(lineId `'경의중앙선'` 등 비숫자) 전체 통과 / 사라진 열차 2대 → 2건
  - `collectEstimates`: ETA 90s 열차 → `departedAtMs = arrival + 30_000` / ETA 음수 제외 / arrivalTime null 제외 / 빈 배열 → `[]`
  - `mergeLog`: 같은 trainId observed+estimated → observed 승 / 16분 경과 항목 prune / 내림차순 정렬 / 입력 배열 비변형(toEqual로 원본 확인)
  - heap store: append→get 반영, clear→빈 배열, 빈 entries append는 기존 로그 유지
  - Train 픽스처는 기존 `departureDetection` 테스트(`src/services/guidance/__tests__/departureDetection.test.ts`)의 팩토리 패턴 재사용
- [ ] **Step 2: 실행해 FAIL 확인** — `npm test -- src/services/guidance/__tests__/departedTrainLog.test.ts --watchman=false` → 모듈 없음 FAIL
- [ ] **Step 3: 구현** — 위 명세대로. 순수 함수 우선, store는 마지막.
- [ ] **Step 4: PASS 확인** — 같은 명령, 전부 green
- [ ] **Step 5: Commit** — `feat(guidance): 출발 열차 로그 모듈 (departedTrainLog)`

---

### Task 2: useGuidanceProgress — 과거 시각 anchor rebase API

**Files:**
- Modify: `src/hooks/useGuidanceProgress.ts`
- Test: 기존 `src/hooks/__tests__/useGuidanceProgress.test.ts`(경로는 실제 위치 확인) 확장

**Interfaces (Produces):**

```typescript
export interface UseGuidanceProgressResult {
  // ...기존 필드 유지...
  /** goNext와 동일하되 anchor 시각을 지정(과거 허용, 미래는 now로 clamp). */
  readonly goNextAt: (atMs: number) => void;
  /** 현재 스텝 인덱스는 유지하고 anchor 시각만 교체 (ride 중 열차 변경용). */
  readonly rebaseAt: (atMs: number) => void;
}
```

**구현 명세** (`useGuidanceProgress.ts:81-93`의 기존 functional-setState 패턴 유지):

```typescript
const goNextAt = useCallback((atMs: number): void => {
  const clamped = Math.min(atMs, Date.now());
  setAnchor(prev => {
    const cur = computeProgress(steps, prev.index, (Date.now() - prev.atMs) / 1000);
    return { index: Math.min(cur.currentIndex + 1, lastIndex), atMs: clamped };
  });
}, [steps, lastIndex]);

const goNext = useCallback((): void => goNextAt(Date.now()), [goNextAt]); // 기존 구현 대체 (DRY)

const rebaseAt = useCallback((atMs: number): void => {
  const clamped = Math.min(atMs, Date.now());
  setAnchor(prev => {
    const cur = computeProgress(steps, prev.index, (Date.now() - prev.atMs) / 1000);
    return { index: cur.currentIndex, atMs: clamped };
  });
}, [steps]);
```

- [ ] **Step 1: 실패 테스트 작성** — 기존 테스트 파일의 렌더/타이머 패턴을 따르고 (`jest.useFakeTimers` 사용 시 `afterEach`에 `useRealTimers`):
  - `goNextAt(now - 5분)`: board hold에서 호출 → ride로 진행 + 5분 경과 반영(예: hop 4분+6분 ride면 nextHop이 두 번째 hop)
  - `goNextAt(now - 30분)`: ride 총 소요를 초과하는 과거 → 다음 hold(transfer)에서 멈춤, **hold를 뚫지 않음**
  - `goNextAt(now + 10분)`: 미래 → now로 clamp (진행 점프 없음, elapsedInStepSec 0 근처)
  - `rebaseAt(now - 3분)`: ride 진행 중 호출 → currentIndex 유지 + elapsedInStepSec ≈ 180
- [ ] **Step 2: FAIL 확인** — `npm test -- useGuidanceProgress --watchman=false`
- [ ] **Step 3: 구현** — 위 코드. 기존 `goNext` 동작 회귀 없음(기존 테스트 green 유지).
- [ ] **Step 4: PASS 확인** — 파일 전체 green
- [ ] **Step 5: Commit** — `feat(guidance): useGuidanceProgress에 과거 anchor rebase API(goNextAt/rebaseAt)`

---

### Task 3: TrainSelectSheet 컴포넌트

**Files:**
- Create: `src/components/guidance/TrainSelectSheet.tsx`
- Modify: `src/components/guidance/index.ts` (barrel export 추가)
- Test: `src/components/guidance/__tests__/TrainSelectSheet.test.tsx`

**Interfaces (Produces):**

```typescript
export interface TrainSelectSheetProps {
  readonly visible: boolean;
  /** 최근 출발 후보 (이미 역/노선/세션 필터링된 상태로 전달됨) */
  readonly entries: readonly DepartedTrainEntry[];
  /** 항목 또는 "방금 출발했어요" 폴백 선택 — 출발 시각 epoch ms */
  readonly onSelect: (departedAtMs: number) => void;
  readonly onClose: () => void;
}
export const TrainSelectSheet: React.FC<TrainSelectSheetProps>; // memo + displayName
```

**UI 명세:**
- RN `Modal`(`transparent`, `animationType="slide"`, `onRequestClose={onClose}`) + 하단 시트 카드. 배경 딤 영역 터치 시 `onClose`.
- 타이틀: "탑승한 열차 선택", 서브: "선택한 열차의 출발 시각으로 안내를 보정해요".
- 목록: `FlatList` (ScrollView+map 금지). 항목 라벨: `` `${finalDestination}행` `` + 우측 시간 텍스트 — 60초 미만 "방금 출발", 이상 `` `${Math.floor((nowMs - departedAtMs)/60000)}분 전 출발` ``. `confidence === 'estimated'`면 "추정" pill 뱃지. `nowMs`는 컴포넌트 내 `Date.now()` 1회(시트는 단명 — 1Hz tick 불필요).
- 폴백 행(목록과 분리, 항상 표시): "방금 출발했어요 — 지금 기준으로 진행" → `onSelect(Date.now())`.
- testID: `train-select-sheet`, `train-select-item-${trainId}`, `train-select-now`, `train-select-close`, `train-select-backdrop`. 모든 Pressable 44pt+, accessibilityRole/Label. 스타일은 `GuidanceNowCard.tsx`의 `createStyles(semantic)` 패턴 미러.
- 항목 onPress는 `useCallback` 불가한 리스트 아이템이므로 `renderItem` 내부에서 아이템 컴포넌트로 분리(모듈 스코프)해 인라인 클로저 최소화 — `GuidanceStepRow` 사용례 참고.

- [ ] **Step 1: 실패 테스트 작성** — 케이스: visible=false 미렌더 / entries 2건 라벨("성수행", "N분 전 출발" — `toHaveTextContent`) / estimated 뱃지 표시·observed 미표시 / 항목 탭 → `onSelect`가 해당 `departedAtMs`로 호출 / 폴백 탭 → onSelect 호출(숫자 인자) / backdrop·close 탭 → onClose / **빈 entries여도 폴백 존재(Edge)**. lucide 아이콘 mock은 기존 guidance 컴포넌트 테스트의 문자열 mock 패턴 재사용.
- [ ] **Step 2: FAIL 확인** — `npm test -- TrainSelectSheet --watchman=false`
- [ ] **Step 3: 구현 + barrel export**
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: Commit** — `feat(guidance): 열차 선택 바텀시트(TrainSelectSheet)`

---

### Task 4: 진입점 3곳 배선 (NowCard 링크 2곳 + soft-confirm 확장 + 화면 통합)

**Files:**
- Modify: `src/components/guidance/GuidanceNowCard.tsx`
- Modify: `src/screens/guidance/RouteGuidanceScreen.tsx`
- Test: 기존 `GuidanceNowCard`/`RouteGuidanceScreen` 테스트 파일 확장

**Interfaces:**
- Consumes: Task 1 스토어/수집 함수, Task 2 `goNextAt`/`rebaseAt`, Task 3 `TrainSelectSheet`
- Produces (NowCard props 확장):

```typescript
export interface SoftConfirmHandlers {
  readonly onYes: () => void;
  readonly onNotYet: () => void;
  readonly onOther: () => void; // "다른 열차예요" → 시트 열기
}
interface GuidanceNowCardProps {
  // ...기존...
  /** 열차 선택 시트 열기 — 대기(이미 탔어요)/ride(열차 변경) 두 문맥 공용 */
  onOpenTrainSelect?: () => void;
}
```

**NowCard 명세:**
- 대기(board/transfer) 바디: `liveChip` 아래, soft-confirm 위에 텍스트 링크 Pressable "이미 탑승하셨나요? **열차 선택**" (testID `guidance-open-train-select`, 높이 44).
- soft-confirm 행: 기존 "아직이에요/예" 버튼 행 아래 보조 링크 "다른 열차에 탔어요" (testID `guidance-soft-confirm-other`) → `softConfirm.onOther`.
- ride 바디(`RideBody`): `alightSummaryRow` 아래 텍스트 링크 "열차 변경 · 시간 보정" (testID `guidance-change-train`) → 같은 `onOpenTrainSelect`. RideBody에 prop 전달 필요.
- `onOpenTrainSelect` 미전달 시 링크 미렌더(기존 소비처 회귀 0).

**Screen 명세 (`RouteGuidanceScreen.tsx`):**
1. **관측 기록**: 출발 감지 effect(L203-235) 안에서 `detectDeparture` 호출 직후·`prevTrainsRef.current = next` 직전에:
   ```typescript
   appendDepartedTrains(
     collectDepartures({
       prev: prevTrainsRef.current, next,
       lineId: waitingLineId, stationName: waitingStationName,
       nowMs: nowMsRef.current,
     }),
     nowMsRef.current
   );
   ```
   (effect deps에 `waitingStationName` 추가)
2. **confirm 깔때기 확장** (L175-182): `confirmBoardedAt(atMs: number)`로 일반화하고 `confirmBoarded = () => confirmBoardedAt(Date.now())`. 깔때기 안에서 `goNext()` 대신 `goNextAt(atMs)`. 진행 직전에 추정 항목 기록:
   ```typescript
   appendDepartedTrains(
     collectEstimates({
       trains: trains ?? [], lineId: waitingLineId,
       stationName: waitingStationName, nowMs: Date.now(),
     }),
     Date.now()
   );
   ```
   (deps에 `trains`, `waitingLineId`, `waitingStationName`, `goNextAt` 추가 — 기존 가드 `firedForIndexRef` 로직 불변)
3. **시트 상태 + 후보**:
   ```typescript
   const [trainSelectVisible, setTrainSelectVisible] = useState(false);
   const trainSelectEntries = useMemo((): readonly DepartedTrainEntry[] => {
     if (!session || !trainSelectVisible) return [];
     const station = isWaitingStep
       ? currentStep.stationName
       : currentStep?.kind === 'ride' ? currentStep.fromStationName : null;
     const lineId = isWaitingStep ? waitingLineId
       : currentStep?.kind === 'ride' ? currentStep.lineId : '';
     if (station === null) return [];
     const numbered = /^[1-9]$/.test(lineId);
     return getDepartedTrainLog().filter(e =>
       e.stationName === station &&
       (!numbered || e.lineId === lineId) &&
       e.departedAtMs <= nowMs &&
       e.departedAtMs >= session.startedAt);
   }, [session, trainSelectVisible, isWaitingStep, currentStep, waitingLineId, nowMs]);
   ```
4. **선택 핸들러**: 대기 중이면 `confirmBoardedAt(departedAtMs)`, ride면 `rebaseAt(departedAtMs)`; 항상 `setTrainSelectVisible(false)` 먼저.
5. **soft-confirm onOther**: `dismissSoftConfirm()` 후 `setTrainSelectVisible(true)` (`softConfirmHandlers` memo에 추가).
6. **NowCard에 `onOpenTrainSelect={openTrainSelect}` 전달** — 대기/ride 공용 (alight면 currentStep 분기상 시트가 빈 후보 + 폴백만 갖지만, alight에서는 링크 자체가 안 그려지므로 도달 불가).
7. **정리**: `handleExit`에 `clearDepartedTrainLog()` 추가.
8. **렌더**: `GuidanceControls` 아래 `<TrainSelectSheet visible={trainSelectVisible} entries={trainSelectEntries} onSelect={handleTrainSelected} onClose={closeTrainSelect} />`. open/close/select 핸들러는 전부 `useCallback`.

- [ ] **Step 1: 실패 테스트 작성** — NowCard: `onOpenTrainSelect` 전달 시 대기/ride 링크 렌더 + 탭 콜백, 미전달 시 미렌더(Edge), softConfirm `onOther` 탭 콜백. Screen(기존 테스트 파일의 세션/훅 mock 패턴 준수): 대기 단계에서 `guidance-open-train-select` 탭 → `train-select-sheet` 표시 → `train-select-now` 탭 → 다음 단계 진행(기존 confirmBoarded 검증 방식 재사용) / soft-confirm `guidance-soft-confirm-other` 탭 → 시트 표시.
- [ ] **Step 2: FAIL 확인** — `npm test -- GuidanceNowCard RouteGuidanceScreen --watchman=false`
- [ ] **Step 3: 구현** — NowCard 먼저, Screen 다음.
- [ ] **Step 4: PASS 확인** — 두 파일 + Task 1-3 테스트 전체 green
- [ ] **Step 5: Commit** — `feat(guidance): 탑승 열차 선택/변경 진입점 3곳 배선`

---

### Task 5: 전체 검증 게이트

- [ ] **Step 1**: `npx tsc --noEmit` → exit 0
- [ ] **Step 2**: `npx eslint src/services/guidance/departedTrainLog.ts src/hooks/useGuidanceProgress.ts src/components/guidance/TrainSelectSheet.tsx src/components/guidance/GuidanceNowCard.tsx src/screens/guidance/RouteGuidanceScreen.tsx --max-warnings 0` → 0 errors (worktree/샌드박스에서 무시되면 `--no-ignore`)
- [ ] **Step 3**: `npm test -- --coverage --watchman=false` → 0 failures + `jest.config.js` coverageThreshold 통과
- [ ] **Step 4**: `git status` — untracked 잔여물 없음 확인
- [ ] **Step 5**: 검증 출력 원문을 보고에 포함 (Evidence-Based Completion)

## 완료 기준 (Definition of Done)

1. Task 1-4 테스트 전부 신규 작성 + green, 기존 테스트 회귀 0
2. `tsc --noEmit` / eslint 0 err / jest coverage threshold 통과 — **fresh 실행 출력 제시**
3. rebase가 hold(board/transfer)를 자동 통과하지 않음이 테스트로 고정됨
4. 요청 범위 밖 파일 무변경 (surgical changes)

## 시도 상한

- 같은 테스트 실패를 같은 방식으로 2회 수정 실패 시 **중단하고 근본 원인 분석을 보고** (2-Strike Rule)
- 전체 작업 중 jest 전체 실행은 5회 이내 (개별 파일 실행 우선)
