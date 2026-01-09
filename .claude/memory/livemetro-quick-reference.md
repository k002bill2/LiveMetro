# LiveMetro Quick Reference

빠른 참조를 위한 핵심 정보 모음

## 프로젝트 구조

```
src/
├── components/     # 37개 재사용 컴포넌트
├── screens/        # 26개 화면
├── services/       # 21개 서비스 디렉토리
├── hooks/          # 16개 커스텀 훅
├── models/         # 11개 타입 정의
├── navigation/     # 네비게이션 설정
└── utils/          # 유틸리티 함수
```

## 핵심 명령어

| 명령어 | 설명 |
|--------|------|
| `npm start` | Expo 개발 서버 시작 |
| `npm test` | Jest 테스트 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run type-check` | TypeScript 검사 |
| `npm run build:production` | 프로덕션 빌드 |

## 경로 별칭

| 별칭 | 경로 |
|------|------|
| `@` | `src/` |
| `@components` | `src/components` |
| `@screens` | `src/screens` |
| `@services` | `src/services` |
| `@models` | `src/models` |
| `@utils` | `src/utils` |
| `@hooks` | `src/hooks` |

## Seoul API 핵심 정보

```typescript
// API 호출 예시
const arrivals = await seoulSubwayApi.getRealtimeArrivals(stationName);

// 폴링 간격: 최소 30초
const POLLING_INTERVAL = 30000;

// 에러 처리: 빈 배열 반환
catch (error) {
  console.error('API Error:', error);
  return [];
}
```

## Firebase 컬렉션

| 컬렉션 | 용도 |
|--------|------|
| `users` | 사용자 프로필 |
| `favorites` | 즐겨찾기 역 |
| `alerts` | 알림 설정 |
| `commute_patterns` | 출퇴근 패턴 |

## 커버리지 임계값

| 항목 | 임계값 |
|------|--------|
| Statements | 75% |
| Functions | 70% |
| Branches | 60% |

## 자주 쓰는 패턴

### useEffect Cleanup
```typescript
useEffect(() => {
  const subscription = api.subscribe(handler);
  return () => subscription.unsubscribe();
}, []);
```

### 타입 안전 네비게이션
```typescript
navigation.navigate('StationDetail', { stationId: '0150' });
```

### 에러 처리
```typescript
try {
  const data = await fetchData();
  return data;
} catch (error) {
  Sentry.captureException(error);
  return null;
}
```

## 주요 화면 경로

| 화면 | 경로 |
|------|------|
| 홈 | `HomeScreen` |
| 즐겨찾기 | `FavoritesScreen` |
| 알림 | `AlertsScreen` |
| 설정 | `SettingsScreen` |
| 역 상세 | `StationDetailScreen` |
| 지연 증명서 | `DelayCertificateScreen` |

## Slash Commands

| 명령어 | 용도 |
|--------|------|
| `/verify-app` | 전체 검증 (타입+린트+테스트+빌드) |
| `/check-health` | 프로젝트 상태 점검 |
| `/commit-push-pr` | 자동 커밋/푸시/PR |
| `/simplify-code` | 코드 복잡도 분석 |
| `/test-coverage` | 테스트 커버리지 확인 |
| `/deploy-with-tests` | 검증 후 배포 |
| `/review` | 코드 리뷰 |
