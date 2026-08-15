# React Native Patterns

표준 RN 관행(StyleSheet, FlatList, 메모이제이션, cleanup 등)은 별도 규칙 없음 — 주변 코드의 밀도·이디엄에 맞춰 판단한다. 여기엔 이 코드베이스 특이 사항만 남긴다:

- 접근성: 모든 터치 요소에 `accessibilityLabel` 필수, 터치 영역 최소 44x44pt
- 색상 하드코딩 금지 (`'#007AFF'` 등) → `colors.primary` 같은 테마 토큰 — 다크모드 지원이 깨진다
- `fontWeight` 단독 사용 금지 → `weightToFontFamily('700')` 또는 `typeStyle('label2')` 동반 — Pretendard는 9 face별 PostScript name이라 fontWeight 단독은 system font로 fallback. pre-commit `lint:typography`가 차단 (`src/` 전체 tsx/ts staged 파일 enforce)
