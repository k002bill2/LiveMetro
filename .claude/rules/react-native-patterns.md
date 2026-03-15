# React Native Patterns

- 스타일: `StyleSheet.create()` 사용 (인라인 스타일 금지)
- 메모이제이션: `React.memo`로 비용 큰 컴포넌트 래핑
- 리스트: `FlatList` 사용 (`ScrollView` + map 금지)
- 접근성: 모든 터치 요소에 `accessibilityLabel` 필수
- 터치 영역: 최소 44x44pt
- `useMemo`/`useCallback`: 비용 큰 연산/콜백에만 적용
- `console.log`: 프로덕션 코드에서 제거
