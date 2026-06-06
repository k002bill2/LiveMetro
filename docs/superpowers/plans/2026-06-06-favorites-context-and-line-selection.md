# 즐겨찾기 전역 상태 승격 + 환승역 노선 선택 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 즐겨찾기를 전역 단일 상태(Context)로 승격해 화면 간 즉시 반영되게 하고, 지하철 지도 바텀시트에서 환승역을 노선별로 골라(칩 토글 + 일괄 저장) 즐겨찾기에 담을 수 있게 한다.

**Architecture:** Part A는 기존 `useFavorites` 훅 로직을 `FavoritesProvider`로 이동하고 훅은 `useContext` consumer로 축소한다(반환 시그니처 동일 → 7개 화면 무변경). Part B는 데이터 모델 변경 없이(환승역은 노선마다 `station_cd`가 고유) `SubwayMapScreen` 바텀시트에서 노선 칩을 선택 토글로 만들고, 저장 버튼이 선택 diff를 `addFavorite`/`removeFavoriteByStationId`로 일괄 반영한다.

**Tech Stack:** React Native 0.72, TypeScript strict, React Context, Firebase Firestore, Jest + React Native Testing Library

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/contexts/FavoritesContext.tsx` | 즐겨찾기 상태/뮤테이션을 보유하는 단일 Provider + Context | 신규 |
| `src/hooks/useFavorites.ts` | Context 값을 반환하는 얇은 consumer | 수정(로직 이전) |
| `src/hooks/__tests__/useFavorites.test.ts` | Provider wrapper 주입으로 마이그레이션 | 수정 |
| `App.tsx` | `<FavoritesProvider>` 트리 배선 | 수정 |
| `src/screens/map/lineFavoriteResolver.ts` | 노선 목록 → station_cd 해석 + diff 계산 순수 함수 | 신규 |
| `src/screens/map/lineFavoriteResolver.test.ts` | 해석/diff 단위 테스트 | 신규 |
| `src/components/map/LineFavoritePicker.tsx` | 노선 칩 선택 토글 + 일괄 저장 UI | 신규 |
| `src/components/map/__tests__/LineFavoritePicker.test.tsx` | 칩 선택/저장 동작 테스트 | 신규 |
| `src/screens/map/SubwayMapScreen.tsx` | 환승역=Picker, 단일노선=기존 버튼 분기 | 수정 |

**규칙 준수:** path alias(`@/`), `StyleSheet.create`, 모든 터치요소 `accessibilityLabel`, 서비스 에러는 throw 대신 친화 메시지(`Alert`), 구독/타이머 cleanup, 커버리지 75/70/60.

---

## Part A — FavoritesContext 승격

### Task 1: FavoritesContext Provider 생성 + useFavorites consumer 전환

**Files:**
- Create: `src/contexts/FavoritesContext.tsx`
- Modify: `src/hooks/useFavorites.ts` (전체 교체)

- [ ] **Step 1: Context value 타입 + Provider 작성**

Create `src/contexts/FavoritesContext.tsx`. 기존 `useFavorites.ts`의 **상태·로직 전체**를 그대로 옮긴다(아래는 핵심 골격 — 내부 함수 본문은 현재 `src/hooks/useFavorites.ts`의 동일 함수를 1:1로 이동, 동작 변경 없음).

```tsx
/**
 * Favorites Context
 * App-wide single source of truth for the user's favorite stations.
 * Logic moved verbatim from the former useFavorites hook so every screen
 * shares one state instance (add in one screen -> visible everywhere).
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  favoritesService,
  AddFavoriteParams,
  migrateFavoritesToNewFormat,
} from '@services/favorites/favoritesService';
import { FavoriteStation } from '@models/user';
import { Station } from '@models/train';
import { trainService } from '@services/train/trainService';
import { useAuth } from '@services/auth/AuthContext';

export interface FavoriteWithDetails extends FavoriteStation {
  station: Station | null;
}

interface FavoritesState {
  favorites: FavoriteStation[];
  loading: boolean;
  error: string | null;
  favoritesWithDetails: FavoriteWithDetails[];
}

export interface FavoritesContextValue {
  favorites: FavoriteStation[];
  favoritesWithDetails: FavoriteWithDetails[];
  loading: boolean;
  error: string | null;
  addFavorite: (
    station: Station,
    options?: { alias?: string; direction?: 'up' | 'down' | 'both'; isCommuteStation?: boolean }
  ) => Promise<void>;
  removeFavorite: (favoriteId: string) => Promise<void>;
  removeFavoriteByStationId: (stationId: string) => Promise<void>;
  updateFavorite: (
    favoriteId: string,
    updates: { alias?: string; direction?: 'up' | 'down' | 'both'; isCommuteStation?: boolean }
  ) => Promise<void>;
  setNotificationEnabled: (favoriteId: string, enabled: boolean) => Promise<void>;
  isFavorite: (stationId: string) => boolean;
  toggleFavorite: (station: Station) => Promise<void>;
  reorderFavorites: (reordered: FavoriteStation[]) => Promise<void>;
  getCommuteStations: () => FavoriteWithDetails[];
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<FavoritesState>({
    favorites: [],
    loading: true,
    error: null,
    favoritesWithDetails: [],
  });

  const migrationPerformedRef = useRef<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  const runExclusive = useCallback(
    async (key: string, task: () => Promise<void>): Promise<void> => {
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      try {
        await task();
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [],
  );

  // ↓↓↓ loadFavorites, addFavorite, removeFavorite, removeFavoriteByStationId,
  //     updateFavorite, setNotificationEnabled, isFavorite, toggleFavorite,
  //     reorderFavorites, getCommuteStations 를 현재 src/hooks/useFavorites.ts 에서
  //     본문 그대로 복사 (동작 동일). useEffect(() => { loadFavorites(); }, [loadFavorites]) 포함.

  const value: FavoritesContextValue = {
    favorites: state.favorites,
    favoritesWithDetails: state.favoritesWithDetails,
    loading: state.loading,
    error: state.error,
    addFavorite,
    removeFavorite,
    removeFavoriteByStationId,
    updateFavorite,
    setNotificationEnabled,
    isFavorite,
    toggleFavorite,
    reorderFavorites,
    getCommuteStations,
    refresh: loadFavorites,
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavoritesContext = (): FavoritesContextValue => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within <FavoritesProvider>');
  }
  return ctx;
};
```

> 주의: 위 import는 path alias(`@services`, `@models`)를 사용한다. 옮기는 함수 본문 안의 상대경로(`../services/...`)도 alias로 교체할 것.

- [ ] **Step 2: useFavorites.ts를 consumer로 축소**

Replace entire `src/hooks/useFavorites.ts`:

```ts
/**
 * Favorites Hook
 * Thin consumer of FavoritesContext. Kept for import-path stability —
 * all existing call sites (`useFavorites()`) keep working unchanged.
 */
import {
  useFavoritesContext,
  FavoritesContextValue,
  FavoriteWithDetails,
} from '@contexts/FavoritesContext';

export type { FavoriteWithDetails };

export const useFavorites = (): FavoritesContextValue => useFavoritesContext();
```

> `@contexts` alias가 없으면 상대경로 `../contexts/FavoritesContext`로 한다(아래 Step 3에서 확인).

- [ ] **Step 3: tsconfig에 `@contexts` alias 존재 확인 (없으면 상대경로 사용)**

Run: `grep -n "@contexts" tsconfig.json babel.config.js`
- 매칭 있음 → alias 사용 유지.
- 매칭 없음 → `FavoritesContext.tsx`/`useFavorites.ts`의 `@contexts/FavoritesContext`를 `../contexts/FavoritesContext`(상대경로 깊이에 맞게)로 교체. (alias 신규 추가는 범위 밖 — 두 파일 import 경로만 맞춘다.)

- [ ] **Step 4: 타입체크로 consumer 격리 확인**

Run: `npx tsc --noEmit`
Expected: PASS. (7개 호출처가 동일 시그니처를 받으므로 에러 0. 만약 `FavoriteWithDetails` import 에러가 나면 해당 파일이 `@/hooks/useFavorites`에서 re-export된 타입을 쓰는지 확인 — Step 2의 `export type` 라인이 처리.)

- [ ] **Step 5: 커밋**

```bash
git add src/contexts/FavoritesContext.tsx src/hooks/useFavorites.ts
git commit -m "refactor(favorites): useFavorites 로직을 FavoritesContext Provider로 승격"
```

---

### Task 2: App.tsx에 FavoritesProvider 배선

**Files:**
- Modify: `App.tsx:73-79`

- [ ] **Step 1: Provider import 추가**

`App.tsx` 상단 import 그룹(`AuthProvider` 옆):

```tsx
import { FavoritesProvider } from './src/contexts/FavoritesContext';
```

- [ ] **Step 2: AuthProvider 안쪽에 FavoritesProvider 삽입**

`App.tsx:73-79` 를 다음으로 교체 (FavoritesProvider는 user에 의존하므로 AuthProvider **안쪽**, AppContent **바깥**):

```tsx
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <FavoritesProvider>
                <AppContent />
              </FavoritesProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add App.tsx
git commit -m "feat(favorites): FavoritesProvider를 앱 트리에 배선 (AuthProvider 하위)"
```

---

### Task 3: 기존 useFavorites 테스트를 Provider wrapper로 마이그레이션 + 상태 공유 회귀 테스트

**Files:**
- Modify: `src/hooks/__tests__/useFavorites.test.ts`

- [ ] **Step 1: wrapper 추가 + 모든 renderHook 호출에 주입**

`src/hooks/__tests__/useFavorites.test.ts` 상단 import에 추가:

```ts
import React from 'react';
import { FavoritesProvider } from '../../contexts/FavoritesContext';
```

`mockUser` 정의 아래에 wrapper 추가:

```ts
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(FavoritesProvider, null, children);
```

파일 내 **모든** `renderHook(() => useFavorites())` 를 `renderHook(() => useFavorites(), { wrapper })` 로 교체.

Run(일괄 치환): `sed -i '' 's/renderHook(() => useFavorites())/renderHook(() => useFavorites(), { wrapper })/g' src/hooks/__tests__/useFavorites.test.ts`

- [ ] **Step 2: 마이그레이션 후 기존 테스트 통과 확인**

Run: `npm test -- src/hooks/__tests__/useFavorites.test.ts`
Expected: PASS (기존 32개 케이스 — Provider가 동일 로직을 보유하므로 동작 동일).

- [ ] **Step 3: 상태 공유 회귀 테스트(red) 작성**

같은 파일 끝 `describe('useFavorites', ...)` 내부에 추가. 두 consumer가 같은 Provider 아래에서 상태를 공유하는지 검증:

```ts
  describe('Context state sharing', () => {
    it('shares favorites between two consumers under one provider', async () => {
      const station = createMockStation('0208', '왕십리');
      mockFavoritesService.getFavorites.mockResolvedValue([]);
      mockFavoritesService.addFavorite.mockImplementation(async () => {
        mockFavoritesService.getFavorites.mockResolvedValue([
          createMockFavorite('fav-1', '0208'),
        ]);
        return createMockFavorite('fav-1', '0208');
      });

      const { result } = renderHook(
        () => ({ a: useFavorites(), b: useFavorites() }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.a.loading).toBe(false));

      await act(async () => {
        await result.current.a.addFavorite(station);
      });

      // consumer B sees the favorite added via consumer A (shared provider state)
      await waitFor(() => {
        expect(result.current.b.isFavorite('0208')).toBe(true);
      });
    });
  });
```

- [ ] **Step 4: 회귀 테스트 통과 확인**

Run: `npm test -- src/hooks/__tests__/useFavorites.test.ts -t "shares favorites"`
Expected: PASS.

- [ ] **Step 5: green→red 검증 (공유 구조가 진짜 원인인지)**

`FavoritesContext.tsx`의 `FavoritesContext.Provider value={value}` 를 임시로 두 번 중첩하거나, 검증을 위해 Provider를 consumer마다 새로 만드는 구조로 잠시 되돌려 이 테스트만 FAIL 하는지 확인 → 다시 복원.
Expected: 임시 변경 시 "shares favorites" FAIL, 복원 후 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/hooks/__tests__/useFavorites.test.ts
git commit -m "test(favorites): Provider wrapper 마이그레이션 + 상태 공유 회귀 테스트"
```

---

## Part B — 환승역 노선 선택 + 일괄 저장

### Task 4: 노선→station_cd 해석 + diff 계산 순수 함수

**Files:**
- Create: `src/screens/map/lineFavoriteResolver.ts`
- Test: `src/screens/map/lineFavoriteResolver.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/screens/map/lineFavoriteResolver.test.ts`:

```ts
import {
  resolveLineFavorites,
  computeFavoriteDiff,
  LineFavoriteOption,
} from './lineFavoriteResolver';

jest.mock('../../services/data/stationsDataService', () => ({
  findStationCdByNameAndLine: (name: string, lineId: string) => {
    const table: Record<string, string> = {
      '왕십리|2': '0208',
      '왕십리|5': '2541',
      '왕십리|경의선': '1013',
      '왕십리|수인분당선': '102C',
    };
    return table[`${name}|${lineId}`] ?? null;
  },
}));

describe('lineFavoriteResolver', () => {
  describe('resolveLineFavorites', () => {
    it('maps each line to its station_cd and favorited flag', () => {
      const options = resolveLineFavorites('왕십리', ['2', '5', '경의선'], (cd) => cd === '0208');
      expect(options).toEqual<LineFavoriteOption[]>([
        { lineId: '2', stationCd: '0208', isFavorite: true },
        { lineId: '5', stationCd: '2541', isFavorite: false },
        { lineId: '경의선', stationCd: '1013', isFavorite: false },
      ]);
    });

    it('drops lines whose station_cd cannot be resolved', () => {
      const options = resolveLineFavorites('왕십리', ['2', '없는노선'], () => false);
      expect(options.map((o) => o.lineId)).toEqual(['2']);
    });
  });

  describe('computeFavoriteDiff', () => {
    const options: LineFavoriteOption[] = [
      { lineId: '2', stationCd: '0208', isFavorite: true },
      { lineId: '5', stationCd: '2541', isFavorite: false },
      { lineId: '경의선', stationCd: '1013', isFavorite: false },
    ];

    it('returns adds for newly selected and removes for deselected', () => {
      // initial favorited: {2}. selected: {5, 경의선} -> add 5,경의선; remove 2
      const diff = computeFavoriteDiff(options, new Set(['5', '경의선']));
      expect(diff.toAdd).toEqual(['5', '경의선']);
      expect(diff.toRemove).toEqual(['0208']);
    });

    it('returns empty diff when selection equals initial state', () => {
      const diff = computeFavoriteDiff(options, new Set(['2']));
      expect(diff.toAdd).toEqual([]);
      expect(diff.toRemove).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/screens/map/lineFavoriteResolver.test.ts`
Expected: FAIL ("Cannot find module './lineFavoriteResolver'").

- [ ] **Step 3: 구현**

Create `src/screens/map/lineFavoriteResolver.ts`:

```ts
/**
 * Pure helpers for line-by-line favorite selection on the subway map.
 * A transfer station has a distinct station_cd per line, so the favorite
 * identity is the station_cd — no composite key needed.
 */
import { findStationCdByNameAndLine } from '@services/data/stationsDataService';

export interface LineFavoriteOption {
  readonly lineId: string;
  readonly stationCd: string;
  readonly isFavorite: boolean;
}

export interface FavoriteDiff {
  readonly toAdd: string[]; // lineIds to add
  readonly toRemove: string[]; // station_cds to remove
}

/**
 * Resolve each lineId to its station_cd at the given station name,
 * dropping lines that cannot be resolved. `isFavoriteCd` marks current state.
 */
export const resolveLineFavorites = (
  stationName: string,
  lineIds: readonly string[],
  isFavoriteCd: (stationCd: string) => boolean,
): LineFavoriteOption[] => {
  const options: LineFavoriteOption[] = [];
  for (const lineId of lineIds) {
    const stationCd = findStationCdByNameAndLine(stationName, lineId);
    if (!stationCd) continue;
    options.push({ lineId, stationCd, isFavorite: isFavoriteCd(stationCd) });
  }
  return options;
};

/**
 * Diff the user's current selection (set of selected lineIds) against the
 * initial favorited state captured in `options`.
 */
export const computeFavoriteDiff = (
  options: readonly LineFavoriteOption[],
  selectedLineIds: ReadonlySet<string>,
): FavoriteDiff => {
  const toAdd: string[] = [];
  const toRemove: string[] = [];
  for (const opt of options) {
    const nowSelected = selectedLineIds.has(opt.lineId);
    if (nowSelected && !opt.isFavorite) toAdd.push(opt.lineId);
    if (!nowSelected && opt.isFavorite) toRemove.push(opt.stationCd);
  }
  return { toAdd, toRemove };
};
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/screens/map/lineFavoriteResolver.test.ts`
Expected: PASS (4 케이스).

- [ ] **Step 5: 커밋**

```bash
git add src/screens/map/lineFavoriteResolver.ts src/screens/map/lineFavoriteResolver.test.ts
git commit -m "feat(map): 노선별 station_cd 해석 + 즐겨찾기 diff 순수 함수"
```

---

### Task 5: LineFavoritePicker 컴포넌트

**Files:**
- Create: `src/components/map/LineFavoritePicker.tsx`
- Test: `src/components/map/__tests__/LineFavoritePicker.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/components/map/__tests__/LineFavoritePicker.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LineFavoritePicker } from '../LineFavoritePicker';
import { LineFavoriteOption } from '../../../screens/map/lineFavoriteResolver';

const options: LineFavoriteOption[] = [
  { lineId: '2', stationCd: '0208', isFavorite: true },
  { lineId: '5', stationCd: '2541', isFavorite: false },
];

const lineLabel = (lineId: string) => `${lineId}호선`;
const lineColor = () => '#000000';

describe('LineFavoritePicker', () => {
  it('initializes selection from already-favorited options', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker
        options={options}
        lineLabel={lineLabel}
        lineColor={lineColor}
        onSave={onSave}
      />
    );
    // line 2 starts selected (favorited), line 5 starts unselected
    expect(getByTestId('line-chip-2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('line-chip-5').props.accessibilityState.selected).toBe(false);
  });

  it('toggles a chip locally without calling onSave', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker options={options} lineLabel={lineLabel} lineColor={lineColor} onSave={onSave} />
    );
    fireEvent.press(getByTestId('line-chip-5'));
    expect(getByTestId('line-chip-5').props.accessibilityState.selected).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('on save passes diff: toggling 5 on and 2 off', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker options={options} lineLabel={lineLabel} lineColor={lineColor} onSave={onSave} />
    );
    fireEvent.press(getByTestId('line-chip-5')); // select 5
    fireEvent.press(getByTestId('line-chip-2')); // deselect 2
    fireEvent.press(getByTestId('line-favorite-save'));
    expect(onSave).toHaveBeenCalledWith({ toAdd: ['5'], toRemove: ['0208'] });
  });

  it('disables save when selection matches initial state', () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <LineFavoritePicker options={options} lineLabel={lineLabel} lineColor={lineColor} onSave={onSave} />
    );
    expect(getByTestId('line-favorite-save').props.accessibilityState.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/components/map/__tests__/LineFavoritePicker.test.tsx`
Expected: FAIL ("Cannot find module '../LineFavoritePicker'").

- [ ] **Step 3: 구현**

Create `src/components/map/LineFavoritePicker.tsx`:

```tsx
/**
 * Line favorite picker: shows one chip per resolvable line at a transfer
 * station. Tapping a chip toggles local selection (no immediate write); the
 * save button applies the add/remove diff in one batch.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  LineFavoriteOption,
  FavoriteDiff,
  computeFavoriteDiff,
} from '@screens/map/lineFavoriteResolver';

interface LineFavoritePickerProps {
  readonly options: readonly LineFavoriteOption[];
  readonly lineLabel: (lineId: string) => string;
  readonly lineColor: (lineId: string) => string;
  readonly onSave: (diff: FavoriteDiff) => void;
}

const initialSelected = (options: readonly LineFavoriteOption[]): Set<string> =>
  new Set(options.filter((o) => o.isFavorite).map((o) => o.lineId));

export const LineFavoritePicker: React.FC<LineFavoritePickerProps> = ({
  options,
  lineLabel,
  lineColor,
  onSave,
}) => {
  const [selected, setSelected] = useState<Set<string>>(() => initialSelected(options));

  const toggle = useCallback((lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const diff = useMemo(() => computeFavoriteDiff(options, selected), [options, selected]);
  const dirty = diff.toAdd.length > 0 || diff.toRemove.length > 0;

  const handleSave = useCallback(() => {
    if (!dirty) return;
    onSave(diff);
  }, [dirty, diff, onSave]);

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {options.map((opt) => {
          const isSelected = selected.has(opt.lineId);
          return (
            <TouchableOpacity
              key={opt.lineId}
              testID={`line-chip-${opt.lineId}`}
              onPress={() => toggle(opt.lineId)}
              accessible
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${lineLabel(opt.lineId)} ${isSelected ? '선택됨' : '선택 안 됨'}`}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? lineColor(opt.lineId) : 'transparent',
                  borderColor: lineColor(opt.lineId),
                },
              ]}
            >
              <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : lineColor(opt.lineId) }]}>
                {lineLabel(opt.lineId)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        testID="line-favorite-save"
        onPress={handleSave}
        disabled={!dirty}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: !dirty }}
        accessibilityLabel="선택한 노선 즐겨찾기 저장"
        style={[styles.saveButton, !dirty && styles.saveButtonDisabled]}
      >
        <Text style={styles.saveButtonText}>즐겨찾기 저장</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 15, fontWeight: '600' },
  saveButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
```

> 타이포그래피 규칙: `fontWeight: '600'` 단독은 pre-commit `lint:typography`가 차단할 수 있다. Step 4 실패 시 프로젝트의 `weightToFontFamily('600')`/`typeStyle(...)` 헬퍼를 적용해 fontFamily를 동반시킨다(`src/utils/typography` 확인). 색상도 하드코딩 대신 가능한 한 테마 토큰 사용 — 단 이 컴포넌트는 호출부에서 `lineColor`/semantic을 주입받는 방향으로 맞춘다(Task 6에서 배선).

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/components/map/__tests__/LineFavoritePicker.test.tsx`
Expected: PASS (4 케이스).

- [ ] **Step 5: 커밋**

```bash
git add src/components/map/LineFavoritePicker.tsx src/components/map/__tests__/LineFavoritePicker.test.tsx
git commit -m "feat(map): LineFavoritePicker — 노선 칩 선택 토글 + 일괄 저장 UI"
```

---

### Task 6: SubwayMapScreen 통합 (환승역=Picker, 단일노선=기존 버튼)

**Files:**
- Modify: `src/screens/map/SubwayMapScreen.tsx`

- [ ] **Step 1: import + 저장 핸들러 추가**

`SubwayMapScreen.tsx` 상단 import에 추가:

```tsx
import { LineFavoritePicker } from '@components/map/LineFavoritePicker';
import { resolveLineFavorites, FavoriteDiff } from './lineFavoriteResolver';
import { findStationCdByNameAndLine } from '@services/data/stationsDataService';
```

`useFavorites()` 구조분해에 `addFavorite`, `removeFavoriteByStationId` 추가:

```tsx
  const { toggleFavorite, isFavorite, addFavorite, removeFavoriteByStationId } = useFavorites();
```

`handleToggleFavorite` 아래에 노선 옵션 계산 + 일괄 저장 핸들러 추가:

```tsx
  const lineOptions = useMemo(() => {
    if (!selectedStation || !selectedStation.isTransfer || !selectedLine) return [];
    const allLines = [selectedLine, ...selectedStation.transferLines];
    return resolveLineFavorites(selectedStation.name, allLines, isFavorite);
  }, [selectedStation, selectedLine, isFavorite]);

  const handleSaveLineFavorites = useCallback(
    async (diff: FavoriteDiff): Promise<void> => {
      if (!selectedStation) return;
      try {
        for (const lineId of diff.toAdd) {
          const cd = findStationCdByNameAndLine(selectedStation.name, lineId);
          if (!cd) continue;
          await addFavorite({
            ...selectedStation.originalStation,
            id: cd,
            lineId,
          });
        }
        for (const cd of diff.toRemove) {
          await removeFavoriteByStationId(cd);
        }
        setShowStationModal(false);
      } catch (error) {
        Alert.alert(
          '알림',
          error instanceof Error ? error.message : '즐겨찾기 처리에 실패했습니다.'
        );
      }
    },
    [selectedStation, addFavorite, removeFavoriteByStationId]
  );
```

- [ ] **Step 2: 바텀시트 렌더 분기 — 환승역이면 Picker, 아니면 기존 버튼**

`SubwayMapScreen.tsx:331-362`의 "환승 노선" 표시 블록과 `:381-400`의 단일 토글 버튼을 다음 구조로 교체. 환승역이고 해석된 노선이 있으면 Picker를, 아니면 기존 단일 토글 버튼을 렌더:

```tsx
                {selectedStation.isTransfer && lineOptions.length > 0 ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>환승 노선</Text>
                    <LineFavoritePicker
                      options={lineOptions}
                      lineLabel={(lineId) => subwayLines.find((l) => l.id === lineId)?.name || lineId}
                      lineColor={(lineId) => getSubwayLineColor(lineId)}
                      onSave={handleSaveLineFavorites}
                    />
                  </View>
                ) : null}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>실시간 정보</Text>
                  <TouchableOpacity
                    style={styles.viewArrivalButton}
                    onPress={handleViewArrival}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="도착 정보 보기"
                  >
                    <Train size={20} color={semantic.primaryNormal} />
                    <Text style={styles.viewArrivalButtonText}>도착 정보 보기</Text>
                    <ChevronRight size={18} color={semantic.primaryNormal} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {!selectedStation.isTransfer || lineOptions.length === 0 ? (
                  <TouchableOpacity
                    style={[styles.addFavoriteButton, isStationFavorite && styles.removeFavoriteButton]}
                    onPress={handleToggleFavorite}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={isStationFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                  >
                    <Heart
                      size={20}
                      color="#ffffff"
                      fill={isStationFavorite ? '#ffffff' : 'transparent'}
                      strokeWidth={2}
                    />
                    <Text style={styles.addFavoriteButtonText}>
                      {isStationFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
```

> 즉: 환승역(해석 노선 있음) → Picker가 즐겨찾기 담당, 하단 단일 버튼 숨김. 단일노선 역 → 기존 단일 토글 버튼 유지. 기존 정적 "환승 노선" 배지 블록(`:331-362`)은 Picker로 대체되어 제거된다.

- [ ] **Step 3: 타입체크 + 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (0 에러). `getSubwayLineColor`/`subwayLines`/`Alert`가 이미 import돼 있는지 확인 — 누락 시 추가.

- [ ] **Step 4: 통합 동작 수동 확인 노트**

Run: `npm test -- src/screens/map`
Expected: 기존 SubwayMapScreen 테스트가 있으면 PASS. (없으면 본 태스크의 컴포넌트/리졸버 단위 테스트가 핵심 로직을 커버.)

- [ ] **Step 5: 커밋**

```bash
git add src/screens/map/SubwayMapScreen.tsx
git commit -m "feat(map): 환승역 바텀시트에 노선별 즐겨찾기 선택 통합"
```

---

## 최종 검증 (Deployment Gate)

- [ ] **Step 1: 타입체크**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 0 에러

- [ ] **Step 3: 전체 테스트 + 커버리지**

Run: `npm test -- --coverage`
Expected: 전체 PASS, 커버리지 Stmt ≥75% / Fn ≥70% / Branch ≥60%

- [ ] **Step 4: Part A 수동 회귀 확인 노트**

지도(또는 역 상세)에서 즐겨찾기 추가 → 즐겨찾기 탭으로 이동 → **재시작/Pull-to-Refresh 없이** 새 항목이 보이는지 확인. (Context 공유로 즉시 반영)

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지:** Part A(Context 승격) → Task 1-3. Part B(노선 선택/일괄저장) → Task 4-6. 데이터 모델 무변경(§2) → Task 4 리졸버가 station_cd 기준. 에러 처리(§4) → Task 4 null 스킵, Task 6 부분성공+Alert. 테스트(§5) → Task 3 공유 회귀, Task 4/5 단위. 검증(§6) → 최종 검증. 범위 밖(§8) 항목 미포함 확인. ✅
- **Placeholder 스캔:** 모든 코드 step에 실제 코드 포함. Task 1 Step 1의 "함수 본문 1:1 이동"은 출처 파일/라인을 명시했고 동작 동일이 보장되는 기계적 이동이므로 placeholder 아님. ✅
- **타입 일관성:** `LineFavoriteOption{lineId,stationCd,isFavorite}`, `FavoriteDiff{toAdd:lineId[],toRemove:stationCd[]}`, `resolveLineFavorites`/`computeFavoriteDiff`/`LineFavoritePicker` props가 Task 4-6 전반에서 일치. `useFavorites` 반환 = `FavoritesContextValue`로 통일. ✅
