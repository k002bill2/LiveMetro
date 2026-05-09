# RoutesScreen 풀 구현 + ML 데이터 통합 — Design Spec

> 작성일: 2026-05-09
> 작성자: Claude (brainstorming session)
> 대상 phase: Tier 3 — RoutesScreen
> 시안 출처: `rest.jsx:7-142` (Wanted bundle v3, `j01iuVhlroduq84dc3azIA`)
> 갭 문서: `docs/design/wanted-bundle-gap.md` §6 미검증 항목 #7

---

## 1. 목적 (Why)

현재 `RoutesTabScreen.tsx`(175줄)는 시안 풀 RoutesScreen으로 가는 빈 상태 launcher만 구현된 상태입니다(파일 주석 `:10-13` "deferred to a follow-up phase"). 이번 phase는 deferred 작업을 완료해 **bottom tab "경로"의 정식 화면**을 시안과 일치시키며, LiveMetro의 ML 자산(useMLPrediction / useDelayDetection / useCongestion)을 표면화해 사용자 의사결정 가치를 높입니다.

### 성공 조건

1. RoutesTabScreen이 시안 `rest.jsx:7-142` visual layout과 일치 (Wanted 토큰 적용)
2. 사용자는 출발/도착 역을 inline search bar에서 선택 가능 (모달)
3. 시간 칩(`지금 출발 / 시간 지정 / 도착 시간 지정`) 인터랙션이 ML 데이터 갱신을 트리거
4. 각 경로 카드는 ETA 신뢰구간 + 지연 위험 + 시간대별 혼잡도 표면화
5. `/verify-app` 통과 (tsc 0 / lint 0 / 커버리지 75/70/60 충족)
6. `AlternativeRoutesScreen` 회귀 0건 (지연 대체 경로 화면은 변경 없음)

---

## 2. 범위

### In-scope

- `RoutesTabScreen.tsx` 풀 재작성 (현재 175줄 → 약 280줄)
- 신규 컴포넌트 4종: `StationSearchBar` / `TimeChipRow` / `RouteCard` / `StationPickerModal`
- 신규 hook 1종: `useRouteSearch` (4개 underlying hook 어댑터)
- 신규 테스트 5종: `RoutesTabScreen` / `RouteCard` / `StationSearchBar` / `TimeChipRow` / `useRouteSearch`

### Out-of-scope (명시 거부)

- 검색 기록 영속화 (Firestore/AsyncStorage) — 별도 phase
- 즐겨찾기 화면과의 양방향 연동 — 별도 phase
- 다인원/가족 공유 경로 — 미정
- `AlternativeRoutesScreen` 재디자인 — 변경 없음
- `OnboardingStationPickerScreen` 변경 — `StationPickerModal`은 핵심 로직 추출이지 원본 수정 아님
- ML 모델 학습/튜닝 — 본 phase는 read-only consumer
- 검색어 자동완성 ML — 별도 phase

---

## 3. 아키텍처 — 파일 구조

```
src/screens/route/
├── RoutesTabScreen.tsx              # ★ 풀 재작성
├── AlternativeRoutesScreen.tsx      # 변경 없음
└── __tests__/
    └── RoutesTabScreen.test.tsx     # ★ 신규

src/components/route/
├── RouteCard.tsx                    # ★ 신규
├── StationSearchBar.tsx             # ★ 신규
├── TimeChipRow.tsx                  # ★ 신규
├── StationPickerModal.tsx           # ★ 신규 (OnboardingStationPicker 핵심 로직 추출)
├── AlternativeRouteCard.tsx         # 변경 없음
├── RouteComparisonView.tsx          # 변경 없음
└── __tests__/
    ├── RouteCard.test.tsx           # ★ 신규
    ├── StationSearchBar.test.tsx    # ★ 신규
    └── TimeChipRow.test.tsx         # ★ 신규

src/hooks/
├── useRouteSearch.ts                # ★ 신규 — 4개 hook 어댑터
└── __tests__/
    └── useRouteSearch.test.ts       # ★ 신규
```

기존 atom 재사용 (변경 없음): `JourneyStrip`, `CongestionBar`, `Pill`, `LineBadge`, `SectionHeader`.

---

## 4. 컴포넌트 contracts

### 4.1 RoutesTabScreen (orchestrator)

자체 상태:

```typescript
const [fromStation, setFromStation] = useState<Station | null>(null);
const [toStation, setToStation] = useState<Station | null>(null);
const [departureMode, setDepartureMode] = useState<'now' | 'depart' | 'arrive'>('now');
const [departureTime, setDepartureTime] = useState<Date | null>(null);
const [pickerSlot, setPickerSlot] = useState<'from' | 'to' | null>(null);
const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
```

hook 호출 (단일 어댑터):

```typescript
const { routes, loading, error, refetch } = useRouteSearch({
  fromId: fromStation?.id,
  toId: toStation?.id,
  departureTime,
  departureMode,
});
```

closestStation seed: `useNearbyStations({radius:1000, maxStations:1, autoUpdate:false})`. 사용자가 비우기 전까지 fromStation에 자동 적용.

### 4.2 StationSearchBar

```typescript
type Props = {
  fromStation: Station | null;
  toStation: Station | null;
  onPressFrom: () => void;
  onPressTo: () => void;
  onSwap: () => void;
};
```

레이아웃 규칙: 두 row가 **동일한 컴포넌트**로 렌더 (출발/도착 동일 row 스타일). 빈 상태는 텍스트 색상만 `labelAlt`로, 배경/border 변경 없음. dashed border 박스 사용 금지.

### 4.3 TimeChipRow

```typescript
type Props = {
  mode: 'now' | 'depart' | 'arrive';
  time: Date | null;
  onChangeMode: (mode: 'now' | 'depart' | 'arrive') => void;
  onChangeTime: (time: Date) => void;
};
```

DateTimePicker 의존: `@react-native-community/datetimepicker@^7.2.0` (이미 설치됨). `mode === 'now'`일 때 `time` 무시.

### 4.4 RouteCard

```typescript
type Props = {
  route: RouteWithMLMeta;
  expanded: boolean;
  onToggleExpand: () => void;
};
```

내부 hook 호출 금지 (parent가 enrich한 route 받음). 5-step detail은 `expanded === true`일 때만 렌더.

### 4.5 StationPickerModal

```typescript
type Props = {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (station: Station) => void;
  recentStations?: Station[];  // 본 phase에서는 부모가 빈 배열 전달; 영속화는 §2 out-of-scope
};
```

`OnboardingStationPickerScreen`의 핵심 로직(검색 + browseMode 노선 탭 + 가나다순) 추출. **원본 화면은 변경 없음**.

### 4.6 useRouteSearch (어댑터)

```typescript
type Input = {
  fromId?: string;
  toId?: string;
  departureTime: Date | null;
  departureMode: 'now' | 'depart' | 'arrive';
};

type RouteWithMLMeta = AlternativeRoute & {
  etaMinutes: number;
  etaConfidenceMinutes: number;
  delayRiskLineIds: string[];
  hourlyCongestion: number[];
};

type Output = {
  routes: RouteWithMLMeta[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};
```

4개 underlying hook (`useAlternativeRoutes`, `useDelayDetection`, `useCongestion`, `useMLPrediction`)을 합성. RoutesTabScreen은 이 hook 하나만 의존.

---

## 5. 데이터 흐름

### 5.1 진입 시퀀스

1. mount → `useNearbyStations` → `closestStation` → `fromStation` seed
2. `toStation = null` → `useRouteSearch` idle (fetch 안 함)
3. 빈 상태 hint: "도착역을 선택하세요"

### 5.2 시간 칩 변경 트리거

| 사용자 액션 | 상태 변화 | 효과 |
|---|---|---|
| `지금 출발` 탭 | `mode='now', time=null` | refetch (300ms debounce) |
| `시간 지정` 탭 | `mode='depart', picker open` | fetch 트리거 안 함 |
| picker confirm | `time=selectedDate` | refetch (300ms debounce) |
| `도착시간` 탭 | `mode='arrive', picker open` | fetch 트리거 안 함 |
| picker confirm | `time=selectedDate` | refetch (도착 역산) |

### 5.3 useRouteSearch 내부

```
1. fromId/toId 미정 → return idle
2. cacheKey = `${fromId}|${toId}|${mode}|${timeBucket(time)}`
   timeBucket = floor(epochMs / 300000)  # 5분 버킷
3. cache hit && age < 60s → return cached
4. parallel:
   - routeService.calculate(fromId, toId, time)
   - delayService.detect()
   - mlPrediction.eta(fromId, toId, time)
   - congestionService.hourlyForRoute(routeIds, time)
5. enrich + cache + return
```

캐시 lifecycle: in-memory Map, RoutesTabScreen unmount 시 destroy.

### 5.4 폴링 정책

- 사용자 주도 refetch만 (자동 polling 없음)
- Seoul API 30초 정책 준수
- Pull-to-refresh = `refetch()` + cache invalidate

### 5.5 에러/빈 결과

| 케이스 | UI |
|---|---|
| `loading && routes.length===0` | ActivityIndicator + "경로를 계산 중..." |
| `error !== null` | ErrorView + "다시 시도" 버튼 |
| `routes.length===0 (no error)` | EmptyView "이 시간대에 가능한 경로가 없습니다" |
| `fromId === toId` | InlineError "출발/도착이 같습니다" + fetch 차단 |

---

## 6. Visual reference

### 6.1 레이아웃 구조

```
┌─────────────────────────────────────┐
│  ←  경로 검색                        │  Header (navigation)
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ●  강남역                    ⇅  │ │  StationSearchBar
│ │ ─────────────────────────────── │ │
│ │ ●  도착역을 입력하세요          │ │  (두 row 동일 스타일)
│ └─────────────────────────────────┘ │
│                                     │
│ [지금 출발] [오전 8:32] [도착시간]  │  TimeChipRow
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 32분 ±3분            [추천]     │ │
│ │ 🦶4분  ②──↔──⑨  🦶2분         │ │  RouteCard
│ │ ─────────────────────────────── │ │
│ │ [정시 운행] [환승 1회]          │ │  ML pills
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━     │ │  Congestion bar
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 38분 ±5분             (확장됨)  │ │
│ │ 🦶2분  신분당──↔──②  🦶6분    │ │
│ │ ─────────────────────────────── │ │
│ │ [2호선 지연 위험] [환승 1회]    │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━     │ │
│ │ ─────────────────────────────── │ │
│ │ 🦶 강남역까지 도보 2분 (180m)  │ │  Detail steps
│ │ 🚇 신분당 강남→양재 (3분)       │ │
│ │ ↔ 양재 환승 (4분)               │ │
│ │ 🚇 2호선 양재→잠실 (24분)       │ │
│ │ 🦶 잠실역에서 도보 6분 (480m)  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 6.2 아이콘 정책

- 도보(walk): `lucide-react-native`의 `Footprints` 아이콘 (size=14, strokeWidth=1.7, color=`labelAlt`)
- emoji 사용 금지 (LiveMetro 코드베이스 lucide 일관성)
- 환승: 기존 `JourneyStrip` atom의 `ArrowRightLeft` 재사용
- ML pill: 기존 `Pill` atom (tones: `pos` / `neg` / `warn` / `neutral`)

### 6.3 토큰

전 화면 `WANTED_TOKENS` + `weightToFontFamily` 사용 (Phase 21 typography 정책 준수). hardcoded 색상/font weight 금지.

### 6.4 검증 시점에 atom 정합 확인

`JourneyStrip.tsx` 현재 구현이 lucide 아이콘 사용 중인지 verify 필요. 사용 중이 아니면 atom 자체에 `Footprints` 도입 (단, 본 phase 범위에서 atom 변경은 surgical하게).

---

## 7. 테스트 전략

### 7.1 단위 테스트 매트릭스

| 파일 | 핵심 케이스 |
|---|---|
| `RoutesTabScreen.test.tsx` | (1) closestStation seed (2) idle hint (3) useRouteSearch 호출 (4) 시간 칩 토글 (5) pull-to-refresh |
| `RouteCard.test.tsx` | (1) ETA 신뢰구간 (2) 지연 Pill (3) Congestion bar (4) tap → toggle (5) expanded detail steps |
| `StationSearchBar.test.tsx` | (1) 빈 placeholder (2) 채워진 이름 (3) onPress* 콜백 (4) swap |
| `TimeChipRow.test.tsx` | (1) 활성 칩 (2) picker open (3) confirm callback |
| `useRouteSearch.test.ts` | (1) idle (2) 4 hook 합성 (3) cache hit (4) debounced refetch (5) error |

### 7.2 Mock 정책 (메모리 적용)

```typescript
// useRouteSearch 테스트
jest.mock('@/hooks/useAlternativeRoutes', () => ({ useAlternativeRoutes: jest.fn() }));
jest.mock('@/hooks/useDelayDetection', () => ({ useDelayDetection: jest.fn() }));
jest.mock('@/hooks/useCongestion', () => ({ useCongestion: jest.fn() }));
jest.mock('@/hooks/useMLPrediction', () => ({ useMLPrediction: jest.fn() }));

// RouteCard 테스트 — Pill atom mock에 Text wrap (메모리: feedback_pill_atom_mock_text_wrap.md)
jest.mock('@/components/design/Pill', () => ({
  Pill: ({ children }: any) => <Text>{children}</Text>,
}));
```

회피 메모리:
- `feedback_atom_barrel_test_cascade.md` — `@/components/design` barrel 대신 direct path import
- `project_jest_partial_mock_requireactual.md` — i18n 등 부분 mock 시 `...jest.requireActual()` spread
- `feedback_pill_atom_mock_text_wrap.md` — Pill mock에 `<Text>` wrap

### 7.3 커버리지 임계값

`.claude/rules/coverage-thresholds.md` 기준 75% / 70% / 60%. 신규 5 파일 모두 테스트 동반.

### 7.4 회귀 net

- `AlternativeRoutesScreen` 변경 없음 → 기존 테스트 영향 없음
- 4개 underlying hook 변경 없음 → 기존 테스트 영향 없음
- `OnboardingStationPickerScreen` 변경 없음 → 기존 테스트 영향 없음

### 7.5 Manual QA 체크리스트

- [ ] 진입 시 출발역 자동 선택 (위치 권한 grant)
- [ ] 위치 권한 deny 시 빈 상태 + 검색 가능
- [ ] 출발 == 도착 inline error
- [ ] `시간 지정` → DateTimePicker → confirm → ETA 갱신
- [ ] 카드 expand 시 detail steps + 콘텐츠 잘림 없음
- [ ] 다크 모드 모든 영역 가독성
- [ ] Pull-to-refresh
- [ ] 검색 모달 → 역 선택 → 모달 닫힘 + 채움
- [ ] iOS/Android DateTimePicker presentation

### 7.6 검증 루프

```
1. 단위 테스트 작성 (RED)
2. 구현 (GREEN)
3. /verify-app (tsc + lint + test + 커버리지)
4. 수동 QA golden path
```

---

## 8. 의존성 & 영향

### 8.1 신규 의존성

없음. `@react-native-community/datetimepicker@^7.2.0` 이미 설치.

### 8.2 영향받는 파일 카운트

- 신규: 10 (컴포넌트 4 + hook 1 + 테스트 5)
- 수정: 1 (`RoutesTabScreen.tsx` 풀 재작성)
- 변경 없음: `AlternativeRoutesScreen.tsx`, `OnboardingStationPickerScreen.tsx`, 4개 underlying hook, atom 11종

### 8.3 PR 사이즈

예상 변경: ~1200 lines (구현 ~700 + 테스트 ~500). 단일 PR로 머지.

---

## 9. 위험 & 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| `JourneyStrip` atom의 lucide 미사용 | 도보 아이콘 일관성 깨짐 | 구현 직전 verify, 미사용 시 atom 수정 (surgical) |
| 4개 hook 합성 race | 시간 칩 빠른 토글 시 stale 결과 | 300ms debounce + cacheKey 기반 stale 폐기 |
| Seoul API 폴링 위반 | 차단 위험 | 본 화면은 사용자 주도 refetch만 (자동 polling 없음) |
| `StationPickerModal` 추출 시 OnboardingStationPickerScreen 회귀 | 온보딩 화면 깨짐 | 추출은 신규 컴포넌트 작성, 원본 import만 그대로 (수정 없음) |
| Modal navigation race | 모달 close 후 navigation 호출 race | `onSelect` 동기 콜백 + parent에서 모달 close |

---

## 10. 다음 단계

이 spec 승인 후 `superpowers:writing-plans` 스킬로 구현 계획(task breakdown + dependency graph)을 작성합니다. 계획에는:

- task별 RED/GREEN 단계
- task 간 의존성 (예: `useRouteSearch` 먼저 → `RouteCard` 다음)
- 검증 게이트 (`/verify-app` 실행 시점)
- 회귀 보호 단계
