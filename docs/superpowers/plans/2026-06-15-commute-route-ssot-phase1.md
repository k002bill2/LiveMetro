# 출퇴근 경로 SSOT 통일 — Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 홈 "오늘의 출근 경로" 카드의 허구 "5호선 직행" 표기를 제거하고, 카드가 실제 canonical(최단) 경로의 첫 탑승 노선·환승 수를 정직하게 표시하도록 한다 — 홈 fact grid·ML 타임라인과 완전 일치.

**Architecture:** `useCommuteRouteSummary`가 이미 계산하는 `getDiverseRoutes[0]` Route에서 첫 비환승 segment의 `lineId`를 노출하고, `CommuteRouteCard` 중앙 노드 라벨을 `transferCount`에 따라 "직행" ↔ "환승 N회"로 분기한다. HomeScreen은 카드 `lineId`를 `originLineId`(출발역 첫 노선)에서 `routeSummary.lineId`(실제 탑승 노선) 우선으로 교체한다.

**Tech Stack:** React Native, TypeScript strict, Jest + React Native Testing Library.

**범위 정제(spec 대비):** 리졸버 추출은 행동 변화가 없는 Phase 1에서 빼고 via와 함께 Phase 2로 이동(YAGNI). Phase 1은 홈 카드 정직성 + `lineId` 노출만.

---

### Task 1: `useCommuteRouteSummary`가 첫 탑승 노선 `lineId` 노출

**Files:**
- Modify: `src/hooks/useCommuteRouteSummary.ts`
- Test: `src/hooks/__tests__/useCommuteRouteSummary.test.ts`

- [ ] **Step 1: 실패 테스트 추가** — 첫 비환승 segment의 lineId를 노출하는지

`src/hooks/__tests__/useCommuteRouteSummary.test.ts`의 기존 "counts non-transfer segments..." 테스트(현재 toEqual)를 갱신하고, 신규 케이스를 추가한다.

기존 테스트 mock 첫 segment에 `lineId` 추가 + 기대값에 `lineId` 추가:
```ts
mockedDiverse.mockReturnValue([
  {
    segments: [
      { isTransfer: false, lineId: '2' }, // station ride 1 (첫 탑승 노선)
      { isTransfer: false, lineId: '2' }, // station ride 2
      { isTransfer: true, lineId: '3' },  // transfer leg — excluded
      { isTransfer: false, lineId: '3' }, // station ride 3
    ],
    totalMinutes: 28,
    transferCount: 1,
    lineIds: ['2', '3'],
  },
]);
mockedFare.mockReturnValue({ totalFare: 1450 });
// ...
expect(result.current).toEqual({
  transferCount: 1,
  stationCount: 3,
  fareKrw: 1450,
  rideMinutes: 28,
  lineId: '2',
  ready: true,
});
```

신규 테스트:
```ts
it('exposes the first non-transfer segment lineId (not a transfer leg line)', () => {
  mockedDiverse.mockReturnValue([
    {
      segments: [
        { isTransfer: false, lineId: '1' },
        { isTransfer: true, lineId: '9' },
        { isTransfer: false, lineId: '9' },
      ],
      totalMinutes: 30,
      transferCount: 1,
      lineIds: ['1', '9'],
    },
  ]);
  mockedFare.mockReturnValue({ totalFare: 1450 });
  const { result } = renderHook(() => useCommuteRouteSummary('A', 'B'));
  expect(result.current.lineId).toBe('1');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/hooks/__tests__/useCommuteRouteSummary.test.ts --watchman=false`
Expected: FAIL — `lineId` 미정의(undefined ≠ '2'/'1').

- [ ] **Step 3: 최소 구현** — `useCommuteRouteSummary.ts`

인터페이스에 필드 추가(`CommuteRouteSummary`):
```ts
  /** Line id of the first boarded (non-transfer) segment — drives the home card mid-node badge. */
  lineId?: string;
```

`route` 획득 후 반환부 수정:
```ts
      const stationCount = route.segments.filter((s) => !s.isTransfer).length;
      const lineId = route.segments.find((s) => !s.isTransfer)?.lineId;
      const fare = fareService.calculateFare(stationCount).totalFare;
      return {
        transferCount: route.transferCount,
        stationCount,
        fareKrw: fare,
        rideMinutes: route.totalMinutes,
        lineId,
        ready: true,
      };
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/hooks/__tests__/useCommuteRouteSummary.test.ts --watchman=false`
Expected: PASS (기존 + 신규 전부).

- [ ] **Step 5: 커밋** (사용자 승인 시)

```bash
git add src/hooks/useCommuteRouteSummary.ts src/hooks/__tests__/useCommuteRouteSummary.test.ts
git commit -m "feat(commute): useCommuteRouteSummary가 첫 탑승 노선 lineId 노출"
```

---

### Task 2: `CommuteRouteCard` 중앙 노드 정직 라벨 (직행 ↔ 환승 N회)

**Files:**
- Modify: `src/components/design/CommuteRouteCard.tsx:248-252`
- Test: `src/components/design/__tests__/CommuteRouteCard.test.tsx`

- [ ] **Step 1: 실패 테스트 추가**

```tsx
it('shows "환승 N회" (not "직행") in the mid-node when transferCount > 0', () => {
  const { getByText, queryByText } = render(
    <CommuteRouteCard
      origin="신길"
      destination="선릉"
      lineId="1"
      rideMinutes={36}
      transferCount={2}
      stationCount={13}
    />,
  );
  expect(getByText('환승 2회')).toBeTruthy();      // mid-node meta
  expect(queryByText('직행 36분')).toBeNull();      // 거짓 직행 제거
  expect(getByText('1호선')).toBeTruthy();          // 실제 첫 탑승 노선
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/components/design/__tests__/CommuteRouteCard.test.tsx --watchman=false`
Expected: FAIL — 여전히 "직행 36분" 렌더(transferCount 무시).

- [ ] **Step 3: 최소 구현** — `CommuteRouteCard.tsx` 중앙 노드 meta 분기

기존(248-252):
```tsx
          {rideMinutes !== undefined && (
            <Text style={[styles.nodeMeta, { color: semantic.labelAlt }]}>
              직행 {truncateMinutes(rideMinutes)}분
            </Text>
          )}
```
교체:
```tsx
          {transferCount !== undefined && transferCount > 0 ? (
            <Text style={[styles.nodeMeta, { color: semantic.labelAlt }]}>
              환승 {transferCount}회
            </Text>
          ) : (
            rideMinutes !== undefined && (
              <Text style={[styles.nodeMeta, { color: semantic.labelAlt }]}>
                직행 {truncateMinutes(rideMinutes)}분
              </Text>
            )
          )}
```
(`transferCount` undefined/0 → "직행 N분" 보존 → 기존 테스트 green. >0 → "환승 N회".)

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/components/design/__tests__/CommuteRouteCard.test.tsx --watchman=false`
Expected: PASS (기존 "직행 18분"/"0회" 테스트 + 신규 "환승 2회" 전부).

- [ ] **Step 5: 커밋** (사용자 승인 시)

```bash
git add src/components/design/CommuteRouteCard.tsx src/components/design/__tests__/CommuteRouteCard.test.tsx
git commit -m "fix(home): 출근 경로 카드 환승 존재 시 거짓 '직행' 제거 → '환승 N회'"
```

---

### Task 3: HomeScreen이 실제 탑승 노선을 카드에 배선

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx:365`
- Test: `src/screens/home/__tests__/HomeScreen.test.tsx` (기존 green 유지 확인)

- [ ] **Step 1: 배선 교체** — `originLineId` → `routeSummary.lineId` 우선

기존(365):
```tsx
            lineId={commuteStationNames.originLineId as LineId | undefined}
```
교체:
```tsx
            lineId={(routeSummary.lineId ?? commuteStationNames.originLineId) as LineId | undefined}
```
(`routeSummary.lineId` 미해결 시 `originLineId` 폴백 → 등록만 됐고 그래프 미해결인 회귀 케이스 보존.)

- [ ] **Step 2: 기존 HomeScreen 테스트 green 확인**

Run: `npm test -- src/screens/home/__tests__/HomeScreen.test.tsx --watchman=false`
Expected: PASS (mock routeSummary에 lineId 없음 → originLineId 폴백 → 기존 동작 동일).

- [ ] **Step 3: 커밋** (사용자 승인 시)

```bash
git add src/screens/home/HomeScreen.tsx
git commit -m "feat(home): 출근 경로 카드 노선 배지를 실제 탑승 노선으로 배선"
```

---

### Task 4: 게이트 + 4표면 일치 검증 (ultracode Workflow)

- [ ] **Step 1: 전체 게이트**

Run:
```bash
npm run type-check
npm run lint
npm test -- --watchman=false
```
Expected: tsc exit 0, lint 0 warnings, jest 0 failures.

- [ ] **Step 2: 검증 Workflow (adversarial, 검증 전용 — 병렬 파일편집 아님)**

4개 표면(홈 카드 중앙/홈 fact grid/ML 타임라인/편집 미리보기)이 신길→선릉 기본(최단) 경로에서 동일 canonical 경로를 렌더하고, 홈 카드에 더 이상 "직행"+"환승 2회" 자기모순이 없는지 코드/테스트 기준으로 adversarial 확인.

---

## Self-Review

- **Spec 커버리지(Phase 1 분):** 홈 카드 정직성 ✓(Task 2), `lineId` 노출 ✓(Task 1), 배선 ✓(Task 3), 기본 최단 전 화면 일치 ✓(fact grid·ML은 무변경으로 이미 일치, 카드만 교정). 리졸버·via·편집화면은 Phase 2(범위 명시).
- **플레이스홀더:** 없음(모든 step에 실제 코드/명령/기대값).
- **타입 일관성:** `lineId?: string` (Task 1 정의) ↔ Task 3에서 `LineId | undefined` 캐스트(기존 originLineId 캐스트와 동일 패턴). `transferCount` prop은 `CommuteRouteCard` 기존 prop 재사용.
