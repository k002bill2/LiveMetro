# React Native Patterns

- 스타일: `StyleSheet.create()` 사용 (인라인 스타일 금지)
- 메모이제이션: `React.memo`로 비용 큰 컴포넌트 래핑
- 리스트: `FlatList` 사용 (`ScrollView` + map 금지)
- 접근성: 모든 터치 요소에 `accessibilityLabel` 필수
- 터치 영역: 최소 44x44pt
- `useMemo`/`useCallback`: 비용 큰 연산/콜백에만 적용
- `console.log`: 프로덕션 코드에서 제거

## BANNED (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `style={{ }}` 인라인 스타일 | `StyleSheet.create()` | 매 렌더마다 새 객체 → 성능 저하 |
| `<ScrollView>{items.map()}` | `<FlatList data={} />` | 전체 렌더링 → 메모리 폭발 |
| `import from '../../'` 상대경로 | `import from '@/'` path alias | 리팩토링 시 경로 파손 |
| `useEffect` without cleanup | return cleanup function | 메모리 누수 |
| 하드코딩 색상 `'#007AFF'` | `colors.primary` (테마) | 다크모드 미지원 |
| `Dimensions.get()` 모듈 레벨 | `useWindowDimensions()` 훅 | 화면 회전 시 갱신 안 됨 |
| `onPress={() => fn()}` 인라인 | `useCallback`으로 감싸기 | 매 렌더마다 새 함수 |
| `fontWeight: '700'` 단독 | `weightToFontFamily('700')` 또는 `typeStyle('label2')` 동반 | Pretendard는 9 face별 PostScript name. fontWeight 단독은 system font fallback. pre-commit `lint:typography`가 차단 (enforced: `src/components/{design,station,statistics}/`, `src/screens/{auth,delays,prediction,settings,statistics}/`, `src/services/theme/`, `src/styles/`) |
