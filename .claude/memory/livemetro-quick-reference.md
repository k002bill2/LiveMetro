# LiveMetro Quick Reference

React Native + Expo + Firebase 기반 서울 지하철 실시간 도착 앱.

## 핵심 아키텍처

```
Seoul API → Firebase → AsyncStorage (Cache)
Navigation: RootNavigator → BottomTabs → Home | Map | Favorites | Alerts | Settings
State: AuthContext + Custom Hooks (no Redux)
```

## 경로 별칭

| 별칭 | 경로 |
|------|------|
| `@` | `src/` |
| `@components` | `src/components` |
| `@screens` | `src/screens` |
| `@services` | `src/services` |

## 커버리지 기준

| 항목 | 임계값 |
|------|--------|
| Statements | 75% |
| Functions | 70% |
| Branches | 60% |

## 주요 규칙

- Seoul API 폴링: 최소 30초 간격
- TypeScript strict mode, no `any`
- useEffect cleanup 필수
- 에러 시 빈 배열/null 반환
- 경로 별칭 사용 (상대경로 금지)
