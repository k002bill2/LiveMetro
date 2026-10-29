# React Native Patterns

표준 RN 관행(StyleSheet, FlatList, 메모이제이션, cleanup 등)은 별도 규칙 없음 — 주변 코드의 밀도·이디엄에 맞춰 판단한다. 여기엔 이 코드베이스 특이 사항만 남긴다:

- 접근성: 모든 터치 요소에 `accessibilityLabel` 필수, 터치 영역 최소 44x44pt
  - 아이콘 단독 버튼·칩·토글은 `accessibilityRole` + 선택/비활성 상태를 `accessibilityState`로 노출 — 라벨만으로는 스크린리더가 "버튼"·"선택됨"을 읽지 못한다
  - 상태를 색으로만 구분 금지(호선색·지연=빨강 등) → 텍스트·아이콘 동반 + 라벨에 상태 포함 — WCAG 1.4.1
  - 실시간 도착·지연 갱신은 `accessibilityLiveRegion="polite"`(Toast·AlertBanner 선례) 또는 `accessibilityService.announceForAccessibility()` — `AccessibilityInfo` 직접 호출 금지(사용자 `announceNotifications` 설정 우회)
  - 텍스트 대비 4.5:1(큰 글자·UI 요소 3:1). 라이트·다크 두 테마 토큰 모두 확인
  - `allowFontScaling={false}` 금지 → 레이아웃이 깨지면 `maxFontSizeMultiplier`로 상한만 둔다
  - 모달·시트는 열릴 때 첫 요소로 포커스 이동, 닫히면 트리거로 복귀
  - 출처: ECC `skills/accessibility`(MIT, affaan-m/ECC@25278e7) 발췌·RN 적용
- 색상 하드코딩 금지 (`'#007AFF'` 등) → `colors.primary` 같은 테마 토큰 — 다크모드 지원이 깨진다
- `fontWeight` 단독 사용 금지 → `weightToFontFamily('700')` 또는 `typeStyle('label2')` 동반 — Pretendard는 9 face별 PostScript name이라 fontWeight 단독은 system font로 fallback. pre-commit `lint:typography`가 차단 (`src/` 전체 tsx/ts staged 파일 enforce)
