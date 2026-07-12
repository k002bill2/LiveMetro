# 즐겨찾기 전역 편집 모드 (Favorites Edit Mode) — Design

- **날짜**: 2026-07-13
- **상태**: 승인됨 (사용자 확인: 접근 A — 인플레이스 선택 모드)
- **배경**: `FavoritesScreen` 헤더의 "편집" 버튼은 현재 플레이스홀더 Alert("편집 모드는 곧 제공될 예정입니다")이며, 코드 주석이 "Phase B will wire this to a global edit/reorder mode that exposes drag handles + bulk delete"로 설계를 예약해 두었다. 또한 `FavoriteEditForm`(별칭/방향/출퇴근 편집)은 진입 UI가 없어 도달 불가능한 상태다(`DraggableFavoriteItem.tsx`의 Phase B+ 주석 참조). 이 작업은 그 Phase B를 완성한다.

## 목표

1. 헤더 "편집" 버튼으로 전역 편집 모드 토글 (편집 ↔ 완료)
2. 편집 모드에서 다중선택(체크박스) + 하단 액션바 일괄 삭제
3. 도달 불가능하던 `FavoriteEditForm` 재연결 (행의 ✎ 버튼)
4. 일괄 삭제는 단일 Firestore 쓰기

**비목표**: 홈 화면 즐겨찾기 섹션 편집, Firestore 스키마 변경, `FavoriteRow` 디자인 번들 아톰 수정, 일괄 알림 토글.

## 아키텍처

### 1. FavoritesScreen.tsx — 상태와 진입/종료

```
isEditMode: boolean               // 편집 모드 여부
selectedIds: ReadonlySet<string>  // 선택된 favorite.id — 토글마다 새 Set 생성 (immutability)
```

- 헤더 버튼: 플레이스홀더 Alert 제거. `isEditMode` 토글. 라벨 "편집" ↔ "완료".
  기존 `testID="favorites-edit-button"` 유지.
- **진입 시**: `searchQuery`·`activeFilters` 초기화, `editingFavoriteId` 초기화.
  검색바(`FavoritesSearchBar`)·라인칩(`FavoritesLineChips`) 렌더링 숨김.
  → 필터가 항상 비어 있으므로 기존 `isReorderable`이 자동으로 true = 편집 모드에서 드래그 순서변경 항상 가능.
- **종료 시**: `selectedIds` 비우기, `editingFavoriteId` 초기화.
- 즐겨찾기 0개(`hasNoFavorites`)면 편집 버튼 숨김. 편집 중 마지막 항목이 삭제되면 편집 모드 자동 종료.
- 행 폴링: `arrivalsEnabled={isFocused && !isEditMode}` — 편집 중 Seoul API 도착정보 폴링 중지.

### 2. DraggableFavoriteItem.tsx — 행 UI

새 props:

```ts
isSelectMode?: boolean;       // 편집 모드 여부 (기본 false)
isSelected?: boolean;         // 이 행이 선택됐는지
onSelectToggle?: () => void;  // 체크박스/행 탭 시 선택 토글
onEditPress?: () => void;     // ✎ 버튼 → 개별 편집 폼 열기
```

- 선택 모드일 때 `FavoriteRow` 왼쪽에 체크박스(lucide `CheckCircle2`/`Circle`, semantic 토큰 색상)를 배치. `FavoriteRow` 자체는 수정하지 않고 `cardInner`를 flexDirection row 컨테이너로 감싼다.
- 체크박스·✎ 버튼: 최소 44×44pt 터치영역 + `accessibilityLabel` + `testID`(`favorite-select-checkbox`, `favorite-edit-pencil`).
- 선택 모드에서 행 탭(`FavoriteRow onPress`) = `onSelectToggle` (StationDetail 네비게이션 대신).
- 스와이프 비활성: `<Swipeable enabled={!isActive && !isSelectMode}>` — 체크박스·드래그와 제스처 충돌 방지.
- 드래그 핸들 오버레이(`dragHandleArea`)는 선택 모드에서도 유지 (순서변경 가능). 단 오버레이 `onPress`는 선택 모드에선 `onSelectToggle`로 전달.
- ✎ 버튼 탭 → 부모의 `editingFavoriteId` 설정 → 기존 `FavoriteEditForm` 마운트 (기존 `onSaveEdit`/`onEditToggle` 배선 재사용, 폼 수정 없음).

### 3. 하단 액션바 — FavoritesScreen.tsx

- 편집 모드일 때 리스트 아래 고정 표시: `삭제 (N)` 버튼.
- N = `selectedIds.size`. 0이면 disabled 스타일 + `disabled`.
- 탭 → `Alert.alert('즐겨찾기 삭제', '선택한 N개 역을 즐겨찾기에서 삭제하시겠습니까?', [취소, 삭제(destructive)])`.
- 삭제 확정 → `removeFavorites([...selectedIds])` → 성공 시 `selectedIds` 초기화. 실패 시 `Alert.alert('오류', '즐겨찾기 삭제에 실패했습니다.')`, 선택 상태 유지.
- 스타일: `StyleSheet.create` + `WANTED_TOKENS`/semantic 토큰, `weightToFontFamily`. 하드코딩 색상 금지 (삭제 destructive 색상은 기존 스와이프 삭제(#FF3B30)와 동일 토큰/값 사용).

### 4. 데이터 계층

**favoritesService.ts** — 신규 메서드:

```ts
async removeFavorites(userId: string, favoriteIds: string[]): Promise<void>
```

- `favoriteIds`가 빈 배열이면 no-op (쓰기 없음).
- `getFavorites(userId)`로 현재 배열 조회 → `favoriteIds`에 없는 항목만 filter → `updateDoc(userRef, { 'preferences.favoriteStations': filtered })` **단일 쓰기**. (`reorderFavorites`와 동일 패턴 — `arrayRemove`는 객체 완전 일치가 필요해 부적합.)
- 존재하지 않는 id는 조용히 무시. filter 결과가 원본과 같으면 쓰기 생략 가능.
- 에러 처리·로깅은 기존 메서드들과 동일 패턴 (throw → Context가 rethrow → 화면 Alert).
- **주의**: preferences 전체 스프레드 쓰기 금지 — `preferences.favoriteStations` 필드 경로만 부분 업데이트 (과거 즐겨찾기 전멸 버그의 재발 방지).

**FavoritesContext.tsx** — 신규 컨텍스트 함수:

```ts
removeFavorites: (favoriteIds: string[]) => Promise<void>;
```

- `runExclusive('bulk:remove', () => runMutation('removing favorites', ...))` — 액션바 더블탭 방지 + 기존 mutation 파이프라인(인증 확인 → 서비스 호출 → `loadFavorites()` reload) 재사용.
- 빈 배열이면 `false` 반환으로 reload 생략 (기존 `removeFavoriteByStationId`의 no-op 패턴).
- `FavoritesContextValue` 인터페이스와 `useMemo` value에 추가. `useFavorites` 훅은 컨텍스트 래퍼이므로 자동 노출.

### 5. 에러 처리

- 서비스: 기존 패턴 유지 (Firestore 에러 console.error + throw).
- 화면: try/catch로 감싸 사용자 친화 메시지 Alert. 기술 에러 미노출.
- 부분 실패 없음 — 단일 쓰기이므로 all-or-nothing.

## 테스트 계획 (TDD)

| 파일 | 케이스 |
|------|--------|
| `favoritesService.test.ts` | removeFavorites: 단일 updateDoc 쓰기·대상만 제거, 없는 id 무시, 빈 배열 no-op(쓰기 0회), Firestore 에러 throw |
| `FavoritesContext`/`useFavorites.test.ts` | removeFavorites: 서비스 호출+reload, 빈 배열 reload 생략, 미로그인 throw, 더블탭 락 |
| `FavoritesScreen.test.tsx` | 편집 버튼 토글(편집↔완료), 진입 시 검색바 숨김+필터 초기화, 행 탭=선택 토글, 삭제(N) 카운트·disabled, 확인 Alert 후 removeFavorites 호출, 실패 시 오류 Alert, 마지막 항목 삭제 시 편집 모드 종료 |
| `DraggableFavoriteItem.test.tsx` | 선택 모드 체크박스 렌더·토글, 선택 모드 스와이프 비활성, ✎ 탭 → onEditPress, 일반 모드 회귀(기존 스냅샷 동작 유지) |

- Happy + Error + Edge 전부. `getByTestId` 사용, mock은 factory 내부 inline.
- 커버리지 게이트(`jest.config.js` coverageThreshold) 통과 필수.

## 변경 파일 목록

1. `src/screens/favorites/FavoritesScreen.tsx` — 편집 모드 상태·헤더·액션바
2. `src/components/favorites/DraggableFavoriteItem.tsx` — 선택 모드 행 UI
3. `src/contexts/FavoritesContext.tsx` — removeFavorites
4. `src/services/favorites/favoritesService.ts` — removeFavorites
5. 테스트 4파일 (기존 테스트 파일에 추가)

건드리지 않음: `FavoriteRow`(디자인 번들), `FavoriteEditForm`, 홈 화면, Firestore 스키마/rules.
