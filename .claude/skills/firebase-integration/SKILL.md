---
name: firebase-integration
description: Firebase integration for authentication, Firestore database, and real-time data synchronization. Use when working with Firebase services in the LiveMetro app.
---

# Firebase Integration

## When to Use This Skill

- Firebase 인증 설정 / 익명 로그인 / Phone Auth
- Firestore 컬렉션 쿼리 (one-shot or paginated)
- 실시간 데이터 구독 (`onSnapshot`)
- 사용자별 데이터 관리 (favorites, settings)
- Firebase 에러 처리 / FirebaseError 매핑

## Firestore Collection Map

| 컬렉션 | 용도 | 권한 |
|--------|------|------|
| `subwayLines/` | 노선 메타데이터 (색상, 이름) | public read |
| `stations/` | 역 정보 + 좌표 | public read |
| `trains/` | 실시간 열차 위치 | public read |
| `trainDelays/` | 지연/장애 알림 | public read |
| `congestionData/` | 차량별 혼잡도 | public read |
| `users/` | 사용자 설정 / 즐겨찾기 | uid-scoped write |

## 작업별 진입점

| 하고 싶은 일 | 참고 |
|--------------|------|
| 인증 / 익명 로그인 / Phone Auth 코드 | [references/patterns.md](references/patterns.md) §1 |
| Firestore 쿼리 (where/orderBy/limit) | [references/patterns.md](references/patterns.md) §2 |
| 실시간 구독 + cleanup | [references/patterns.md](references/patterns.md) §3 |
| FirebaseError 매핑 / 사용자 메시지 | [references/patterns.md](references/patterns.md) §4 |
| Service 클래스 / Singleton 구조 | [references/architecture.md](references/architecture.md) §1 |
| Seoul API → Firebase → 캐시 fallback | [references/architecture.md](references/architecture.md) §2 |
| Firestore Security Rules 작성 | [references/architecture.md](references/architecture.md) §3 |
| Batch / Offline 처리 | [references/architecture.md](references/architecture.md) §4-5 |

## BANNED (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `useEffect` 안 `onSnapshot` 무 cleanup | return `() => unsubscribe()` | 메모리 누수, PR 차단 |
| `firestore` 직접 import | `trainService` 등 singleton 경유 | 캐싱·에러 처리 우회 |
| `where + orderBy` 조합에 인덱스 미등록 | `firestore.indexes.json` 갱신 | 콘솔 경고 + 느린 쿼리 |
| Firebase config 클라이언트에 하드코딩 | `EXPO_PUBLIC_FIREBASE_*` env | 보안 사고 |
| `permission-denied` 무처리 | `handleFirebaseError(err)` | 빈 화면 / 사용자 혼란 |
| collection 전체 fetch | `limit + startAfter` 페이지네이션 | 비용 폭증 |

## Testing Quick Checklist

- [ ] 모든 `onSnapshot` 호출에 cleanup 등록됨
- [ ] permission-denied 분기에서 사용자 메시지 노출 검증
- [ ] Firestore Rules 변경 시 emulator 테스트 통과
- [ ] 새 쿼리 패턴은 `firestore.indexes.json`에 등록
- [ ] 오프라인 시나리오 (캐시 hit) 1 테스트 케이스 포함

## Related Skills

- `subscription-cleanup` 규칙 (cleanup 미준수 차단)
- `api-integration` (Seoul API + Firebase 멀티 티어 통합)
- `subway-data-processor` (Firestore 응답 정규화)
