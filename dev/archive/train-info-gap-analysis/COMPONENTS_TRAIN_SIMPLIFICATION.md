# components/train 영역 단순화 분석 (2026-05-17)

F5.2b 머지(PR #139)로 inline `TrainArrivalItem` 제거 후 잔여 컴포넌트의
사용처를 grep으로 확인. 결과: **3개 잠재 dead code 발견 (~953 LOC)**.

## 사용처 매트릭스

| 컴포넌트 | LOC | live import | 결론 |
|----------|-----|-------------|------|
| `TrainArrivalList.tsx` | 332 | `screens/station/StationNavigatorScreen.tsx` | ✅ LIVE |
| `TrainArrivalCard.tsx` | 519 | `TrainArrivalList`(F5.2b 이후) | ✅ LIVE |
| `train/StationCard.tsx` | 628 | **0** (HomeScreen.test가 mock하지만 실 HomeScreen은 `NearbyStationCard` 사용) | 🟡 잠재 dead, 보류 |
| `SubwayLineList.tsx` | 118 | **0** | 🔴 확실 dead |
| `TrainArrivalCard.example.tsx` | 207 | **0** | 🔴 확실 dead |

## 즉시 정리 (확실 dead — 별도 PR 후보)

### `SubwayLineList.tsx` (118 LOC) + `__tests__/SubwayLineList.test.tsx`
- 어디서도 import 0. `train/index.ts` barrel에 export 없음.
- 자체 테스트만 의존. 삭제 안전.

### `TrainArrivalCard.example.tsx` (207 LOC)
- 어떤 screen / Storybook 시스템도 import 0.
- example 패턴은 Storybook 환경 또는 design system playground에서만 가치 — LM은 둘 다 없음.
- 삭제 안전.

**예상 정리 LOC**: ~325 + 자체 테스트 (SubwayLineList.test.tsx 삭제로 추가 ~150 LOC)

## 보류 (잠재 dead — 추가 검토 phase)

### `train/StationCard.tsx` (628 LOC)
**상황**:
- HomeScreen은 `NearbyStationCard`(design/ 아래)를 사용 — `train/StationCard` 아님.
- HomeScreen.test.tsx:225에 `jest.mock('@/components/train/StationCard', ...)` 잔존.
- `train/index.ts` barrel은 여전히 `StationCard` export.
- `train/__tests__/StationCard.test.tsx` 존재.

**가능성**:
1. **Legacy mock**: HomeScreen이 과거 train/StationCard를 사용하다 NearbyStationCard로 마이그레이션. mock만 남음.
2. **Indirect import**: 다른 화면이 barrel을 통해 import 가능 — `grep "components/train"`은 잡지만 barrel re-export 경유는 미세하게 다를 수 있음.

**조치 필요**:
- HomeScreen.test의 mock을 stale로 삭제 (mock object 추가 grep)
- barrel `train/index.ts`에서 `StationCard` export 제거
- `train/__tests__/StationCard.test.tsx` 영향 평가 (테스트 자체 의미 있는지)
- 다른 import 경로(`react-native-paper` 등 외부 ref) 누락 grep

**왜 보류**:
- 628 LOC + 자체 테스트 + barrel 변경 + HomeScreen.test 변경 → 영향 큼
- F5.2b는 inline Item 제거였고, 이건 별도 component 통째 삭제 — review 단위 분리 권장
- 다음 세션에서 별도 phase로 진행

### 컴포넌트명 충돌
`src/components/station/StationCard.tsx`와 `src/components/train/StationCard.tsx`가 같은 이름으로 공존. 위 정리 진행 시 자동 해소되지만, 본 phase로 별도 결정 필요한 경우:
- station/StationCard가 production 사용처라면 train/StationCard만 삭제
- 두 컴포넌트가 다른 역할이면 이름 재명명 검토 (예: `train/StationFavoriteCard`)

[StationCard ↔ FavoriteRow 통합 분석] 메모리는 train/StationCard 가정. 실제는 `design/FavoriteRow`(별도 디렉토리) — 통합 검토 시 cross-directory 영역.

## 액션 계획

### 본 세션 (#3): 확실 dead 2건 정리
별도 surgical PR:
- `rm src/components/train/SubwayLineList.tsx`
- `rm src/components/train/__tests__/SubwayLineList.test.tsx`
- `rm src/components/train/TrainArrivalCard.example.tsx`
- 검증: `tsc --noEmit` + `jest` + grep으로 잔존 reference 0 확인
- 예상 변경: 3 file 삭제, +0 / -700 LOC

### 다음 세션 (별도 phase): train/StationCard 처리
1. barrel + HomeScreen.test mock + StationCard.test 영향 분석
2. station/StationCard와 명칭 충돌 해소
3. 안전하면 일괄 삭제 (train/StationCard + 자체 테스트 + barrel export + HomeScreen.test mock)
