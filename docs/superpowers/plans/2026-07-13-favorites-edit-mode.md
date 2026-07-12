# 즐겨찾기 전역 편집 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FavoritesScreen 헤더의 플레이스홀더 "편집" 버튼을 실제 전역 편집 모드(다중선택 + 일괄 삭제 + 개별 편집 폼 재연결)로 배선한다.

**Architecture:** 화면 로컬 상태(`isEditMode`, `selectedIds`)로 선택 모드를 구동하고, 삭제는 기존 mutation 파이프라인(`runExclusive` → `runMutation` → reload)을 통해 신규 `favoritesService.removeFavorites`(단일 Firestore 쓰기)로 수행한다. 행 UI는 `DraggableFavoriteItem`에 선택 모드 props를 추가하며 디자인 번들 `FavoriteRow`는 수정하지 않는다.

**Tech Stack:** React Native 0.72 + Expo 49, TypeScript strict, Firebase Firestore(updateDoc 부분 필드 쓰기), react-native-gesture-handler Swipeable, react-native-draggable-flatlist, Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-07-13-favorites-edit-mode-design.md`

## Global Constraints

- `any` 금지, exported 함수 명시적 반환 타입 (`.claude/rules/typescript-strict.md`)
- 테스트 파일의 import는 `@/` path alias. 기존 구현 파일 내 새 import는 **그 파일의 기존 스타일**을 따른다 (surgical changes — import 스타일 일괄 변경 금지)
- 인라인 스타일 금지 → `StyleSheet.create` + `WANTED_TOKENS`/semantic 토큰. `fontWeight` 단독 금지 → `weightToFontFamily('700')` 동반 (pre-commit `lint:typography`가 차단)
- 터치 요소 최소 44×44pt + `accessibilityLabel`
- Immutability: `selectedIds`는 토글마다 새 `Set` 생성. 기존 객체/배열 mutation 금지
- 테스트 BANNED 패턴 준수: mock은 `jest.mock` factory 내부 inline(모듈 레벨 `const mockFn = jest.fn()` + factory에서 closure 참조 패턴은 이 레포의 기존 관례 — 그대로 따를 것), `getByTestId` 우선, happy+error+edge 전부, `// ... similar tests` 생략 금지
- Jest 실행은 항상 `--watchman=false` (샌드박스에서 watchman fchmod 차단)
- 커밋 메시지: Conventional Commits. 각 Task 종료 시 커밋 (명시된 파일만 `git add` — `git add .` 금지)
- 프로덕션 코드에 `console.log` 금지 (`console.error`는 기존 서비스 에러 패턴에 한해 허용)

---

### Task 1: `favoritesService.removeFavorites` — 단일 쓰기 일괄 삭제

**Files:**
- Modify: `src/services/favorites/favoritesService.ts` (reorderFavorites 메서드 뒤, 클래스 끝 `}` 직전에 추가 — 현재 L217-229가 reorderFavorites)
- Test: `src/services/favorites/__tests__/favoritesService.test.ts` (기존 describe 블록들 뒤에 추가)

**Interfaces:**
- Consumes: `this.getFavorites(userId)`, `doc`/`updateDoc` (기존 mock 인프라 재사용)
- Produces: `favoritesService.removeFavorites(userId: string, favoriteIds: readonly string[]): Promise<void>` — Task 2가 호출

- [x] **Step 1: 실패하는 테스트 작성**

기존 테스트 파일의 mock 구조(모듈 레벨 `mockGetDoc`/`mockUpdateDoc` + factory closure)를 그대로 사용한다. 파일 끝의 `describe('FavoritesService', ...)` 내부에 추가:

```ts
describe('removeFavorites', () => {
  const fav = (id: string, stationId: string): FavoriteStation => ({
    id,
    stationId,
    lineId: '2',
    alias: null,
    direction: 'both',
    isCommuteStation: false,
    addedAt: new Date('2024-01-01'),
  });

  const seedFavorites = (favorites: FavoriteStation[]): void => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ preferences: { favoriteStations: favorites } }),
    });
  };

  it('should remove targeted favorites in a single updateDoc write', async () => {
    seedFavorites([fav('fav_1', 'gangnam'), fav('fav_2', 'seoul'), fav('fav_3', 'hongdae')]);

    await favoritesService.removeFavorites('user-123', ['fav_1', 'fav_3']);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0]?.[1] as {
      'preferences.favoriteStations': FavoriteStation[];
    };
    const remaining = payload['preferences.favoriteStations'];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe('fav_2');
  });

  it('should ignore unknown ids and still remove known ones', async () => {
    seedFavorites([fav('fav_1', 'gangnam'), fav('fav_2', 'seoul')]);

    await favoritesService.removeFavorites('user-123', ['fav_2', 'fav_ghost']);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0]?.[1] as {
      'preferences.favoriteStations': FavoriteStation[];
    };
    expect(payload['preferences.favoriteStations'].map((f) => f.id)).toEqual(['fav_1']);
  });

  it('should be a no-op (no read, no write) for an empty id list', async () => {
    await favoritesService.removeFavorites('user-123', []);

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('should skip the write when nothing matches', async () => {
    seedFavorites([fav('fav_1', 'gangnam')]);

    await favoritesService.removeFavorites('user-123', ['fav_ghost']);

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('should throw a user-friendly error when Firestore write fails', async () => {
    seedFavorites([fav('fav_1', 'gangnam')]);
    mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

    await expect(
      favoritesService.removeFavorites('user-123', ['fav_1'])
    ).rejects.toThrow('즐겨찾기 삭제에 실패했습니다.');
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx jest src/services/favorites/__tests__/favoritesService.test.ts --watchman=false -t "removeFavorites"`
Expected: FAIL — `favoritesService.removeFavorites is not a function`

- [x] **Step 3: 최소 구현**

`favoritesService.ts`의 `reorderFavorites` 메서드(L217-229) 바로 뒤, 클래스 닫는 `}` 앞에 추가. 에러 처리·`lastActiveAt` 패턴은 removeFavorite(L102-121)·reorderFavorites와 동일하게:

```ts
  /**
   * Remove multiple favorites in one Firestore write (edit-mode bulk
   * delete). Unknown ids are ignored; an empty input or zero matches
   * skips the write entirely so no-op taps cost nothing.
   */
  async removeFavorites(userId: string, favoriteIds: readonly string[]): Promise<void> {
    if (favoriteIds.length === 0) {
      return;
    }

    try {
      const userRef = doc(firestore, 'users', userId);
      const favorites = await this.getFavorites(userId);

      const idsToRemove = new Set(favoriteIds);
      const remaining = favorites.filter(fav => !idsToRemove.has(fav.id));

      if (remaining.length === favorites.length) {
        return;
      }

      await updateDoc(userRef, {
        'preferences.favoriteStations': remaining,
        lastActiveAt: new Date(),
      });
    } catch (error) {
      console.error('Error removing favorites:', error);
      throw new Error('즐겨찾기 삭제에 실패했습니다.');
    }
  }
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx jest src/services/favorites/__tests__/favoritesService.test.ts --watchman=false`
Expected: PASS (기존 테스트 포함 0 failures)

- [x] **Step 5: 커밋**

```bash
git add src/services/favorites/favoritesService.ts src/services/favorites/__tests__/favoritesService.test.ts
git commit -m "feat(favorites): removeFavorites 일괄 삭제 서비스 — 단일 Firestore 쓰기"
```

---

### Task 2: `FavoritesContext.removeFavorites` — mutation 파이프라인 배선

**Files:**
- Modify: `src/contexts/FavoritesContext.tsx` — ① `FavoritesContextValue` 인터페이스(L46 `removeFavorite` 아래), ② `reorderFavorites` 콜백(L336-342) 근처에 구현 추가, ③ `useMemo` value 객체·deps(L359-389)에 추가
- Test: `src/hooks/__tests__/useFavorites.test.ts` (기존 케이스들 패턴 재사용)

**Interfaces:**
- Consumes: Task 1의 `favoritesService.removeFavorites(userId, favoriteIds)`, 기존 `runExclusive(key, task)`·`runMutation(label, task)`
- Produces: 컨텍스트 함수 `removeFavorites: (favoriteIds: readonly string[]) => Promise<void>` — `useFavorites()`가 자동 노출(훅은 컨텍스트 값을 그대로 반환하므로 `src/hooks/useFavorites.ts`는 수정하지 않는다). Task 4가 호출

- [x] **Step 1: 실패하는 테스트 작성**

`useFavorites.test.ts`를 먼저 읽고 기존 provider/renderHook 헬퍼와 `favoritesService` mock 방식을 파악한 뒤, **그 파일의 기존 헬퍼를 그대로 사용해** 아래 4개 케이스를 추가한다 (assertion은 아래와 동일해야 함):

```ts
describe('removeFavorites', () => {
  it('서비스를 호출하고 목록을 다시 로드한다', async () => {
    // 기존 헬퍼로 훅 렌더 + favoritesService.removeFavorites resolved mock
    await act(() => result.current.removeFavorites(['fav_1', 'fav_2']));
    expect(favoritesService.removeFavorites).toHaveBeenCalledWith('test-uid', ['fav_1', 'fav_2']);
    // reload 발생: getFavorites가 (초기 로드 이후) 한 번 더 호출됨
    expect(favoritesService.getFavorites).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it('빈 배열이면 서비스 호출·reload를 생략한다', async () => {
    await act(() => result.current.removeFavorites([]));
    expect(favoritesService.removeFavorites).not.toHaveBeenCalled();
    expect(favoritesService.getFavorites).toHaveBeenCalledTimes(initialCalls);
  });

  it('미로그인 상태면 throw한다', async () => {
    // user: null 로 렌더한 뒤
    await expect(result.current.removeFavorites(['fav_1'])).rejects.toThrow('로그인이 필요합니다.');
  });

  it('서비스 에러를 rethrow한다', async () => {
    // favoritesService.removeFavorites mockRejectedValue(new Error('즐겨찾기 삭제에 실패했습니다.'))
    await expect(result.current.removeFavorites(['fav_1'])).rejects.toThrow('즐겨찾기 삭제에 실패했습니다.');
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx jest src/hooks/__tests__/useFavorites.test.ts --watchman=false -t "removeFavorites"`
Expected: FAIL — `result.current.removeFavorites is not a function`

- [x] **Step 3: 최소 구현**

① 인터페이스 (L46 `removeFavorite:` 줄 아래):

```ts
  removeFavorites: (favoriteIds: readonly string[]) => Promise<void>;
```

② 구현 — 기존 `reorderFavorites` 콜백 바로 위에 추가:

```ts
  /**
   * Bulk-remove favorites in one write (edit-mode action bar). A single
   * bulk lock key guards against action-bar double-taps; per-station keys
   * are unnecessary because the whole batch lands in one Firestore write.
   */
  const removeFavorites = useCallback(
    async (favoriteIds: readonly string[]): Promise<void> =>
      runExclusive('bulk:remove', () =>
        runMutation('removing favorites', async (userId) => {
          if (favoriteIds.length === 0) {
            return false; // nothing to do — skip the reload
          }
          await favoritesService.removeFavorites(userId, favoriteIds);
        }),
      ),
    [runExclusive, runMutation],
  );
```

③ `useMemo` value 객체의 `removeFavorite,` 아래에 `removeFavorites,` 추가 + deps 배열에도 `removeFavorites,` 추가.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx jest src/hooks/__tests__/useFavorites.test.ts --watchman=false`
Expected: PASS (0 failures)

- [x] **Step 5: 커밋**

```bash
git add src/contexts/FavoritesContext.tsx src/hooks/__tests__/useFavorites.test.ts
git commit -m "feat(favorites): 컨텍스트 removeFavorites — bulk 락 + mutation 파이프라인"
```

---

### Task 3: `DraggableFavoriteItem` 선택 모드 UI

**Files:**
- Modify: `src/components/favorites/DraggableFavoriteItem.tsx`
- Test: `src/components/favorites/__tests__/DraggableFavoriteItem.test.tsx` (기존 mock 셋업 재사용)

**Interfaces:**
- Consumes: lucide `CheckCircle2`, `Circle`, `Pencil` 아이콘 (기존 import 줄에 추가), 기존 `FavoriteRow`/`Swipeable`
- Produces: 새 props — Task 4가 전달:

```ts
isSelectMode?: boolean;       // 편집 모드 여부 (기본 false)
isSelected?: boolean;         // 선택됨 여부 (기본 false)
onSelectToggle?: () => void;  // 체크박스/행 탭 → 선택 토글
onEditPress?: () => void;     // ✎ 버튼 → 개별 편집 폼 열기
```

- [x] **Step 1: 실패하는 테스트 작성**

기존 테스트 파일의 렌더 헬퍼·mock을 먼저 읽고 재사용한다. 케이스 (assertion 유지, 셋업은 기존 패턴 준수):

```tsx
describe('선택 모드 (isSelectMode)', () => {
  it('체크박스를 렌더하고 accessibilityState.checked를 반영한다', () => {
    const { getByTestId } = renderItem({ isSelectMode: true, isSelected: true });
    expect(getByTestId('favorite-select-checkbox').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true })
    );
  });

  it('체크박스 탭 → onSelectToggle 호출', () => {
    const onSelectToggle = jest.fn();
    const { getByTestId } = renderItem({ isSelectMode: true, onSelectToggle });
    fireEvent.press(getByTestId('favorite-select-checkbox'));
    expect(onSelectToggle).toHaveBeenCalledTimes(1);
  });

  it('선택 모드에서 행(FavoriteRow) 탭 → onPress 대신 onSelectToggle', () => {
    const onPress = jest.fn();
    const onSelectToggle = jest.fn();
    // 기존 FavoriteRow mock의 onPress 트리거 방식 재사용
    expect(onSelectToggle).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('✎ 버튼 탭 → onEditPress 호출', () => {
    const onEditPress = jest.fn();
    const { getByTestId } = renderItem({ isSelectMode: true, onEditPress });
    fireEvent.press(getByTestId('favorite-edit-pencil'));
    expect(onEditPress).toHaveBeenCalledTimes(1);
  });

  it('선택 모드에서 Swipeable이 비활성화된다 (enabled=false)', () => {
    // Swipeable mock의 마지막 호출 props로 enabled=false 검증
  });

  it('일반 모드(기본값)에서는 체크박스·✎가 렌더되지 않는다', () => {
    const { queryByTestId } = renderItem({});
    expect(queryByTestId('favorite-select-checkbox')).toBeNull();
    expect(queryByTestId('favorite-edit-pencil')).toBeNull();
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx jest src/components/favorites/__tests__/DraggableFavoriteItem.test.tsx --watchman=false -t "선택 모드"`
Expected: FAIL — checkbox testID 미존재

- [x] **Step 3: 구현**

핵심 diff (전체 파일 구조는 유지, 변경 지점만):

① props 인터페이스·구조분해에 4개 추가 (`isSelectMode = false`, `isSelected = false`, `onSelectToggle`, `onEditPress`).

② lucide import에 `CheckCircle2, Circle, Pencil` 추가.

③ `Swipeable` enabled 조건 확장:

```tsx
        enabled={!isActive && !isSelectMode}
```

④ `cardInner` 내부 재구성 — FavoriteRow와 드래그 오버레이를 flex:1 래퍼로 감싸고 좌우에 체크박스/✎ 조건부 배치. 스와이프 주석 위 기존 구조를 다음으로 교체:

```tsx
        <View style={styles.cardInner}>
          {isSelectMode && (
            <TouchableOpacity
              style={styles.selectCheckbox}
              onPress={onSelectToggle}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${station.name}역 선택`}
              testID="favorite-select-checkbox"
            >
              {isSelected ? (
                <CheckCircle2 size={24} color={semantic.primaryNormal} />
              ) : (
                <Circle size={24} color={semantic.labelAlt} />
              )}
            </TouchableOpacity>
          )}
          <View style={styles.rowWrapper}>
            <FavoriteRow
              lines={linesForRow}
              stationName={station.name}
              nickname={favorite.alias ?? undefined}
              isCommute={favorite.isCommuteStation}
              destinationLabel={directionToLabel(favorite.direction)}
              nextMinutes={nextMinutes}
              showDragHandle
              onPress={isSelectMode ? onSelectToggle ?? onPress : onPress}
            />
            {drag && (
              <TouchableOpacity
                style={styles.dragHandleArea}
                onLongPress={drag}
                onPress={isSelectMode ? onSelectToggle ?? onPress : onPress}
                delayLongPress={150}
                accessibilityRole="button"
                accessibilityLabel={`${station.name}역 순서 이동 (꾹 누르고 드래그)`}
                testID="favorite-drag-handle"
              />
            )}
          </View>
          {isSelectMode && (
            <TouchableOpacity
              style={styles.editPencil}
              onPress={onEditPress}
              accessibilityRole="button"
              accessibilityLabel={`${station.name}역 편집`}
              testID="favorite-edit-pencil"
            >
              <Pencil size={20} color={semantic.labelNeutral} />
            </TouchableOpacity>
          )}
        </View>
```

주의: 기존 dragHandleArea의 "short tap forwards onPress" 주석은 유지하되, 선택 모드에선 탭이 선택 토글로 가도록 삼항 처리(위 코드). `FavoriteRow` 자체는 수정 금지.

⑤ 스타일 추가/수정 (`createStyles` 내):

```ts
  cardInner: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowWrapper: {
    flex: 1,
    position: 'relative',
  },
  selectCheckbox: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPencil: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

(기존 `cardInner: { position: 'relative' }`를 위 정의로 교체. `dragHandleArea`는 `rowWrapper` 내부로 이동했으므로 absolute 기준이 자동으로 행 래퍼가 됨 — 스타일 값 변경 불필요.)

⑥ 편집 폼 주석(L250-255)의 "isEditing is currently never true" 문구를 현재 사실("전역 편집 모드의 ✎ 버튼으로 진입")로 갱신.

- [x] **Step 4: 테스트 실행 — 통과 확인 (기존 케이스 회귀 포함)**

Run: `npx jest src/components/favorites/__tests__/DraggableFavoriteItem.test.tsx --watchman=false`
Expected: PASS (0 failures)

- [x] **Step 5: 커밋**

```bash
git add src/components/favorites/DraggableFavoriteItem.tsx src/components/favorites/__tests__/DraggableFavoriteItem.test.tsx
git commit -m "feat(favorites): 행 선택 모드 UI — 체크박스·편집 버튼·스와이프 비활성"
```

---

### Task 4: `FavoritesScreen` 편집 모드 상태·헤더·액션바

**Files:**
- Modify: `src/screens/favorites/FavoritesScreen.tsx`
- Test: `src/screens/favorites/__tests__/FavoritesScreen.test.tsx` (기존 useFavorites·DraggableFavoriteItem mock 확장)

**Interfaces:**
- Consumes: Task 2의 `removeFavorites` (useFavorites 구조분해에 추가), Task 3의 새 props, lucide `Trash2`(기존 import 줄에 추가)
- Produces: 최종 사용자 기능 (다른 태스크가 의존하지 않음)

- [x] **Step 1: 실패하는 테스트 작성**

기존 테스트 파일의 `useFavorites` mock에 `removeFavorites: jest.fn()`, `setNotificationEnabled: jest.fn()`, `reorderFavorites: jest.fn()`(없다면)을 추가하고, `DraggableFavoriteItem` mock이 `isSelectMode`/`isSelected`/`onSelectToggle`을 받아 체크박스 대역(testID `favorite-select-checkbox`)을 렌더하도록 확장한다. 케이스:

```tsx
describe('편집 모드', () => {
  it('편집 버튼 탭 → 라벨이 "완료"로 바뀌고 검색바가 숨는다', () => {
    // favoritesWithDetails 2개로 렌더
    fireEvent.press(getByTestId('favorites-edit-button'));
    expect(getByTestId('favorites-edit-button')).toHaveTextContent('완료');
    expect(queryByTestId('search-bar')).toBeNull();
  });

  it('행 선택 토글 → 삭제 버튼 카운트가 갱신된다', () => {
    fireEvent.press(getByTestId('favorites-edit-button'));
    fireEvent.press(getAllByTestId('favorite-select-checkbox')[0]);
    expect(getByTestId('favorites-bulk-delete-button')).toHaveTextContent('삭제 (1)');
  });

  it('선택 0개면 삭제 버튼이 disabled다', () => {
    fireEvent.press(getByTestId('favorites-edit-button'));
    expect(
      getByTestId('favorites-bulk-delete-button').props.accessibilityState
    ).toEqual(expect.objectContaining({ disabled: true }));
  });

  it('삭제 버튼 → 확인 Alert → 확정 시 removeFavorites 호출 + 선택 초기화', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    // 1개 선택 후 삭제 버튼 press
    // Alert 두 번째 버튼(삭제)의 onPress 실행
    await waitFor(() =>
      expect(mockRemoveFavorites).toHaveBeenCalledWith(['fav_1'])
    );
  });

  it('removeFavorites 실패 시 오류 Alert를 띄운다', async () => {
    // mockRemoveFavorites.mockRejectedValueOnce(new Error('...'))
    // 확정 후:
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('오류', '즐겨찾기 삭제에 실패했습니다.')
    );
  });

  it('완료 탭 → 편집 모드 종료, 선택 상태 초기화', () => {
    // 진입 → 선택 → 완료 → 재진입 시 카운트 (0)
  });

  it('즐겨찾기가 0개면 편집 버튼이 렌더되지 않는다', () => {
    // favoritesWithDetails: [] 로 렌더
    expect(queryByTestId('favorites-edit-button')).toBeNull();
  });
});
```

주의: `mockResolvedValueOnce`/`mockRejectedValueOnce` 큐 누출 방지 — 각 케이스에서 소비를 보장하거나 `mockImplementation` 사용.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx jest src/screens/favorites/__tests__/FavoritesScreen.test.tsx --watchman=false -t "편집 모드"`
Expected: FAIL — "완료" 라벨/벌크 버튼 미존재 (기존 편집 버튼은 Alert 플레이스홀더)

- [x] **Step 3: 구현**

① `useFavorites()` 구조분해에 `removeFavorites` 추가. lucide import에 `Trash2` 추가.

② 상태·핸들러 (기존 `editingFavoriteId` 아래):

```tsx
  // Global edit mode (Phase B): multi-select + bulk delete + always-on reorder
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const handleEditModeToggle = useCallback(() => {
    if (!isEditMode) {
      // Entering: clear search/filters so the full list is visible and
      // isReorderable stays true for the whole edit session.
      setSearchQuery('');
      setActiveFilters({});
    }
    setSelectedIds(new Set());
    setEditingFavoriteId(null);
    setIsEditMode(!isEditMode);
  }, [isEditMode]);

  const handleSelectToggle = useCallback((favoriteId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(favoriteId)) {
        next.delete(favoriteId);
      } else {
        next.add(favoriteId);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(
      '즐겨찾기 삭제',
      `선택한 ${count}개 역을 즐겨찾기에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFavorites([...selectedIds]);
              setSelectedIds(new Set());
            } catch {
              Alert.alert('오류', '즐겨찾기 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  }, [selectedIds, removeFavorites]);

  // Leave edit mode automatically when the last favorite disappears
  // (bulk delete of everything, or removal from another screen).
  useEffect(() => {
    if (isEditMode && favoritesWithDetails.length === 0) {
      setIsEditMode(false);
      setSelectedIds(new Set());
    }
  }, [isEditMode, favoritesWithDetails.length]);
```

③ 헤더 편집 버튼 — 플레이스홀더 Alert·주석 제거, `hasNoFavorites` 시 숨김. `hasNoFavorites` 선언(L422)이 JSX보다 위에 있으므로 그대로 사용 가능:

```tsx
          {!hasNoFavorites && (
            <TouchableOpacity
              style={styles.editButton}
              accessibilityLabel={isEditMode ? '편집 완료' : '편집'}
              accessibilityRole="button"
              testID="favorites-edit-button"
              onPress={handleEditModeToggle}
            >
              <Text style={styles.editButtonText}>{isEditMode ? '완료' : '편집'}</Text>
            </TouchableOpacity>
          )}
```

④ 검색바·라인칩 숨김: 조건을 `{!hasNoFavorites && !isEditMode && (`, `{availableLineIds.length > 0 && !isEditMode && (`로 확장.

⑤ `renderFavoriteItem`에 props 전달 + deps 갱신:

```tsx
        isSelectMode={isEditMode}
        isSelected={selectedIds.has(item.id)}
        onSelectToggle={() => handleSelectToggle(item.id)}
        onEditPress={() => handleEditToggle(item.id)}
        arrivalsEnabled={isFocused && !isEditMode}
```

(deps 배열에 `isEditMode`, `selectedIds`, `handleSelectToggle` 추가)

⑥ 하단 액션바 — `</SafeAreaView>` 직전, `StationSearchModal` 위에:

```tsx
      {/* Edit-mode action bar: bulk delete for the current selection */}
      {isEditMode && (
        <View style={styles.editActionBar}>
          <TouchableOpacity
            style={[
              styles.bulkDeleteButton,
              selectedIds.size === 0 && styles.bulkDeleteButtonDisabled,
            ]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: selectedIds.size === 0 }}
            accessibilityLabel={`선택한 ${selectedIds.size}개 즐겨찾기 삭제`}
            testID="favorites-bulk-delete-button"
          >
            <Trash2 size={18} color="#FFFFFF" />
            <Text style={styles.bulkDeleteText}>삭제 ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}
```

⑦ 스타일 추가 (`createStyles` 내부 — destructive 색상은 기존 스와이프 삭제와 동일한 `#FF3B30`):

```ts
    editActionBar: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    bulkDeleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      height: 48,
      borderRadius: WANTED_TOKENS.radius.r5,
      backgroundColor: '#FF3B30',
    },
    bulkDeleteButtonDisabled: {
      opacity: 0.4,
    },
    bulkDeleteText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      color: '#FFFFFF',
      fontFamily: weightToFontFamily('700'),
    },
```

- [x] **Step 4: 테스트 실행 — 통과 확인 (기존 케이스 회귀 포함)**

Run: `npx jest src/screens/favorites/__tests__/FavoritesScreen.test.tsx --watchman=false`
Expected: PASS (0 failures)

- [x] **Step 5: 커밋**

```bash
git add src/screens/favorites/FavoritesScreen.tsx src/screens/favorites/__tests__/FavoritesScreen.test.tsx
git commit -m "feat(favorites): 전역 편집 모드 — 다중선택·일괄 삭제·편집 폼 재연결"
```

---

### Task 5: 전체 검증 게이트

**Files:** 없음 (검증만)

- [x] **Step 1: 타입 체크**

Run: `npm run type-check`
Expected: exit 0, 에러 0 — ✅ exit 0

- [ ] **Step 2: 린트** — ⚠️ 사전 존재 조건으로 미충족(아래 참조)

Run: `npx eslint src/screens/favorites src/components/favorites src/contexts/FavoritesContext.tsx src/services/favorites --max-warnings 0`
Expected: exit 0
Actual: exit 1 — `no-console` 경고 14건(0 errors). 13건은 사전 존재(변경 전 favoritesService 10건 + FavoritesContext 141/157/186), 1건은 계획 지시(Task 1 Step 3)로 추가한 `favoritesService.ts:257` `console.error`. 신규 screen/component 코드는 경고 0. `.eslintrc.js`의 `no-console: 'warn'`는 allow-list가 없어 `console.error`도 경고 → 레포 전역에서 이 게이트는 원래 미통과 상태(pre-commit은 tsc만 실행).

- [x] **Step 3: 전체 테스트 + 커버리지**

Run: `npx jest --coverage --watchman=false`
Expected: 0 failures, `jest.config.js`의 coverageThreshold 통과 — ✅ exit 0, 5245 passed / 0 failed / 25 skipped, coverageThreshold 통과

- [x] **Step 4: 결과 보고**

각 명령의 exit code와 실패/경고 수를 그대로 보고한다 (fresh 실행 출력만 증거로 인정).

## 시도 상한 (worker용)

- 같은 테스트 실패를 같은 방식으로 2회 수정 실패 시 **중단하고 실패 출력 전문과 함께 보고** (2-Strike Rule)
- 계획에 없는 파일 수정 금지. 필요해 보이면 수정하지 말고 사유 보고
- `FavoriteRow`(src/components/design)·`FavoriteEditForm`·홈 화면·Firestore rules 수정 금지
