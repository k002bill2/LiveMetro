---
name: react-native-development
description: React Native component development with TypeScript, Expo, and React Navigation. Use when creating UI components, screens, or implementing navigation flows.
---

# React Native Development (LiveMetro)

## When to Use
- 새 RN 컴포넌트 / 화면 생성
- 네비게이션 구성 / 화면 전환
- 커스텀 훅 작성
- Expo SDK 기능 통합
- 반응형 디자인 / StyleSheet 작업

## Checklists
- `.claude/checklists/rn-specific.md` — useEffect, 상태관리, 네비게이션, 리스트/이미지 최적화, Expo 특화

## Core Principles (요약)

| 원칙 | 패턴 |
|------|------|
| 컴포넌트 구조 | `memo` + `displayName` + interface props (JSDoc) |
| 스타일 | `StyleSheet.create()` — 인라인 금지 |
| 타입 | TS strict, `any` 금지, `unknown` + type guard |
| 성능 | `memo` / `useMemo` / `useCallback` — 비싼 경우만 |
| 네비게이션 | `NativeStackScreenProps<...>` 타입드 props |
| 에러 | `setError` state + 사용자 친화 메시지 |
| 반응형 | `useWindowDimensions()` (모듈 레벨 `Dimensions.get` 금지) |

코드 예제 전체: [references/code-patterns.md](references/code-patterns.md)

## File Organization

```
src/
├── components/   # 재사용 UI
│   └── train/   # 도메인별
├── screens/     # 화면 컴포넌트
├── hooks/       # 커스텀 훅
├── navigation/  # 네비게이션 설정
└── utils/       # 유틸
```

## BANNED Patterns (Hard Failures)

### Code
| BANNED | USE INSTEAD | WHY |
|--------|-------------|-----|
| `style={{...}}` 인라인 | `StyleSheet.create()` | 매 렌더마다 새 객체 → 성능 저하 |
| `<ScrollView>{items.map()}` | `<FlatList />` | 전체 렌더링 → 메모리 폭발 |
| 상대 경로 `../../` | `@/` path alias | 리팩토링 시 경로 파손 |
| `any` 타입 | `unknown` + type guard | 타입 안전성 무력화 |
| `console.log()` in prod | 제거 또는 `__DEV__` 가드 | 성능 저하 + 정보 노출 |
| `useEffect` 무 cleanup | return cleanup | 메모리 누수 |
| `setTimeout/Interval` 무 clear | `clearTimeout/Interval` in cleanup | 언마운트 후 크래시 |
| `onPress={() => ...}` 인라인 | `useCallback` | 매 렌더마다 새 함수 |
| 하드코딩 색상 `'#007AFF'` | `colors.primary` (테마) | 다크모드 미지원 |
| `Dimensions.get` 모듈 레벨 | `useWindowDimensions()` | 회전 시 미갱신 |
| `fontWeight: '700'` 단독 | `weightToFontFamily('700')` | Pretendard PostScript name 매칭 — pre-commit `lint:typography` 차단 |

### Architecture
| BANNED | USE INSTEAD |
|--------|-------------|
| 한 파일에 다중 export | 컴포넌트당 1파일 |
| 800줄 초과 파일 | 유틸/서브컴포넌트로 분리 |
| Props drilling 3단계+ | Context 또는 composition |
| 컴포넌트에 비동기 로직 직접 | 커스텀 훅 추출 |

## Pre-Output Checklist

- [ ] 모든 `useEffect`에 cleanup 함수
- [ ] 모든 터치 요소에 `accessibilityLabel`
- [ ] `StyleSheet.create()` 사용
- [ ] path alias (`@/`) 사용
- [ ] `any` 타입 없음
- [ ] 컴포넌트에 `displayName`
- [ ] 색상은 테마 토큰 (다크모드 대응)

## Accessibility

- 터치 요소: `accessibilityLabel` 필수
- 적절한 `accessibilityRole` 사용
- 명도 대비 비율 확보
- VoiceOver / TalkBack 지원

## Testing

- 모든 컴포넌트 단위 테스트
- 사용자 인터랙션 테스트
- 에러 상태 테스트
- API / 네비게이션 모킹

## Important Notes

- path alias (`@/`) 사용 — 상대 경로 금지
- useEffect cleanup 필수 (구독·타이머)
- iOS/Android 키보드 dismiss 처리
- 두 플랫폼 모두 테스트 후 커밋
