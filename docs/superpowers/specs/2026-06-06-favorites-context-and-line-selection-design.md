# 즐겨찾기 전역 상태 승격 + 환승역 노선 선택 — 설계

- 날짜: 2026-06-06
- 토픽: `favorites-context-and-line-selection`
- 상태: 승인됨 (구현 계획 단계로 이동)

## 1. 배경 / 문제

### 문제 A — 즐겨찾기 추가 후 화면 미반영
`useFavorites`는 `createContext` 기반 전역 상태가 **아니라** 각 화면이 독립 호출하는 일반 훅이다.
`useFavorites()`를 호출하는 화면/컴포넌트가 7곳인데 각자 별도의 `state` 인스턴스를 가진다.

- `StationDetailScreen.tsx:182` 또는 `SubwayMapScreen.tsx:114`에서 `toggleFavorite`로 추가 → Firestore엔 저장되지만 `FavoritesScreen.tsx:67`의 *다른 인스턴스*는 그 변화를 모른다.
- `FavoritesScreen`은 포커스 복귀 시 재조회(`useFocusEffect`)가 없다.
- 결과: 다른 화면에서 추가한 즐겨찾기가 목록에 즉시 나타나지 않는다. 앱 재시작 또는 Pull-to-Refresh 전까지 안 보인다.

추가로, 즐겨찾기 **목록**에는 폴링 주기나 실시간 구독(`onSnapshot`)이 없다(이벤트 기반). 각 카드의 *도착정보*만 30초 폴링(`DraggableFavoriteItem.tsx:113`)이며 목록 갱신과 무관하다.

### 문제 B — 환승역 노선 선택 불가
`SubwayMapScreen` 바텀시트의 "환승 노선" 칩(`:335`)은 **표시만** 되고 탭해도 동작이 없다.
`즐겨찾기 추가`는 `toggleFavorite(selectedStation.originalStation)`(`:145`)로 **현재 보고 있는 한 노선의 stationId 하나만** 저장한다.
사용자는 왕십리 같은 환승역을 **노선별로 골라** 즐겨찾기에 담고 싶어 한다(첨부 이미지: 2호선·5호선·경의중앙·수인분당).

## 2. 결정적 데이터 사실 (설계 근거)

**환승역은 노선마다 `station_cd`(stationId)가 다르다.**

| 역 | 노선 | station_cd |
|----|------|-----------|
| 왕십리 | 2호선 | `0208` |
| 왕십리 | 5호선 | `2541` |
| 왕십리 | 경의중앙 | `1013` |
| 왕십리 | 수인분당 | `102C` |
| 강남 | 2호선 | `0222` |
| 강남 | 신분당 | `4307` |

→ **`stationId`만으로 노선이 이미 구분된다.** 복합키(`stationId+lineId`)가 불필요하며, 기존 `isFavorite(stationId)`·중복판정·제거 로직을 변경하지 않는다. (YAGNI)

→ 변환 도구 존재: `findStationCdByNameAndLine(stationName, lineId)` → `station_cd`
(`stationsDataService.ts:353`). 칩의 각 노선을 정확한 station_cd로 해석한다.

## 3. 설계

### Part A — FavoritesContext 승격 (전역 단일 상태)

| 파일 | 변경 |
|------|------|
| `src/contexts/FavoritesContext.tsx` (신규) | 기존 `useFavorites` 훅의 **상태·로직 전체**를 `FavoritesProvider`로 이동. 앱당 단일 인스턴스 |
| `src/hooks/useFavorites.ts` | `useContext(FavoritesContext)`를 반환하는 얇은 consumer로 축소. **반환 시그니처 100% 동일** → 호출하는 7개 화면 코드 무변경. Provider 밖에서 호출 시 명확한 에러 throw |
| `App.tsx` | `<FavoritesProvider>`를 `AuthProvider` **안쪽**, 화면 트리 **바깥**에 배치 (user에 의존) |

설계 원칙:
- 공개 인터페이스(반환 객체)는 그대로 유지하여 consumer 격리.
- Provider 내부 구현은 현재 훅 로직(`runExclusive` in-flight 가드, `loadFavorites`, migration 등)을 그대로 옮긴다.
- 단위 테스트 격리: Provider 단독 렌더로 상태 공유를 검증.

효과: StationDetail·Map에서 추가 → FavoritesScreen 즉시 반영. 문제 A 근본 해결.

### Part B — 환승역 노선 선택 + 일괄 저장 (`SubwayMapScreen` 바텀시트)

**데이터 모델·서비스·중복판정 변경 없음.** UI/상호작용만 변경.

상호작용 흐름(사용자 결정 반영: "노선 칩 직접 토글" + "다중 선택 후 일괄 추가"):

1. 환승역이면 전체 노선 = `[선택노선, ...selectedStation.transferLines]`를 **선택 가능한 칩**으로 렌더.
2. 각 노선 → `findStationCdByNameAndLine(name, lineId)`로 `station_cd` 해석. (null이면 해당 칩 비활성/스킵)
3. 시트가 열릴 때 **초기 선택 상태** = 각 노선의 station_cd가 이미 즐겨찾기에 있으면 체크(`isFavorite(cd)`).
4. **칩 탭 = 로컬 선택 set 토글** (즉시 저장하지 않음).
5. **하단 버튼 = 일괄 저장(diff 적용)**:
   - 새로 켜진 노선 → `addFavorite(노선별 station 객체)`
   - 꺼진 노선(기존 즐겨찾기였으나 해제) → `removeFavoriteByStationId(cd)`
   - 변화 없으면 no-op.
6. **단일노선 역**(환승 아님)은 기존 단일 토글 버튼(`즐겨찾기 추가/제거`)을 그대로 유지.

저장 시 `addFavorite`에 넘기는 station 객체는 노선별로 구성:
`{ id: cd, name, lineId, ... }` — `lineId`가 정확히 그 노선이어야 즐겨찾기 카드의 노선 표시가 올바르다(`useFavorites.ts:106`의 `lineId: favorite.lineId` 경로).

상태 관리:
- 로컬 선택 상태는 `Set<lineId>` 또는 `Set<station_cd>`로 보관. cd 기준이 저장 diff와 직결되므로 **cd 기준** 권장.
- 시트가 다른 역으로 바뀌면 선택 상태 초기화(`selectedStation` 변경 시 재계산).

### 컴포넌트 경계
- `SubwayMapScreen`이 비대해지지 않도록, 노선 선택 칩 그룹 + 일괄 저장 로직을 작은 프레젠테이션 컴포넌트(예: `LineFavoritePicker`)로 추출 검토. 단일 책임: "노선 목록 + 현재 즐겨찾기 상태 → 선택 토글 → onSave(diff)".

## 4. 에러 처리
- `findStationCdByNameAndLine`이 `null` 반환(데이터 누락) → 해당 칩은 선택 불가 처리, 저장 대상에서 제외. 사용자에겐 조용히 스킵(빈 화면 금지 원칙).
- 일괄 저장 중 일부 노선 실패 → 성공분은 반영하고, 실패는 `console.error` + 사용자 친화 메시지(`Alert`). 전체 롤백은 하지 않음(부분 성공 허용).
- Provider 밖에서 `useFavorites()` 호출 → 개발 단계에서 즉시 발견되도록 명확한 에러 throw.

## 5. 테스트 계획
- **Part A 회귀(red-green)**: 두 consumer(예: 추가 트리거 화면 + 목록 화면)가 같은 Provider 아래에서 상태를 공유함을 검증. 승격 전 구조로 되돌리면 fail.
- **Part B diff 저장**: 초기 선택 = 기존 즐겨찾기, 칩 토글 후 저장 → add/remove 호출이 diff대로 일어나는지(mock `addFavorite`/`removeFavoriteByStationId`) 검증.
- **Part B 단일노선 역**: 칩 선택 UI 없이 기존 토글 동작 유지.
- **엣지**: `findStationCdByNameAndLine` null, 변화 없는 저장(no-op), 같은 역 빠른 연타(runExclusive 가드).
- 커버리지 임계값 준수: Stmt 75% / Fn 70% / Branch 60%.

## 6. 검증 게이트
1. `npx tsc --noEmit` (RN 앱)
2. `npm run lint` (0 에러)
3. `npm test -- --coverage` (임계값 통과)
4. 회귀 테스트 red-green 확인

## 7. 영향 파일 요약
- 신규: `src/contexts/FavoritesContext.tsx`
- 수정: `src/hooks/useFavorites.ts`, `App.tsx`, `src/screens/map/SubwayMapScreen.tsx`
- 신규(검토): `src/components/map/LineFavoritePicker.tsx`
- 테스트: `FavoritesContext` 공유 테스트, `SubwayMapScreen`/`LineFavoritePicker` 노선 선택 테스트

## 8. 범위 밖 (YAGNI)
- 복합키 데이터 모델 마이그레이션 (불필요 — station_cd가 노선별 고유)
- 실시간 `onSnapshot` 구독 / 다기기 동기화
- `StationDetailScreen`의 즐겨찾기 토글 UI 변경 (Part A로 반영 문제는 해결됨)
- 즐겨찾기 목록의 폴링 주기 도입
