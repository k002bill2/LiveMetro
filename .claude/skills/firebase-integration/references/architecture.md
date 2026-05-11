# Firebase Architecture — Service Layer · Caching · Security · Ops

Firebase 통합의 상위 구조 결정 가이드. SKILL.md의 "When to use this skill"에서 캐싱·보안·서비스 계층 결정이 필요할 때 이 파일을 참조한다.

## 1. Service Layer Pattern (Singleton)

LiveMetro의 모든 Firebase 접근은 service 클래스 singleton을 거친다. 직접 firestore 호출 금지.

```typescript
class TrainService {
  private static instance: TrainService;

  static getInstance(): TrainService {
    if (!TrainService.instance) {
      TrainService.instance = new TrainService();
    }
    return TrainService.instance;
  }

  async getTrainsByStation(stationId: string): Promise<Train[]> {
    // Implementation
  }

  subscribeToTrainUpdates(
    stationId: string,
    callback: (trains: Train[]) => void
  ): () => void {
    // Implementation with cleanup
  }
}

export const trainService = TrainService.getInstance();
```

## 2. Multi-tier Fallback (캐싱 전략)

우선순위: **Seoul API → Firebase → AsyncStorage 캐시**. 실시간성을 잃지 않으면서 빈 화면을 막는 표준 패턴.

```typescript
/**
 * Priority: Seoul API → Firebase → Local Cache
 */
const getTrainData = async (stationId: string): Promise<Train[]> => {
  try {
    // 1. Try Seoul API (primary source)
    const apiData = await seoulApi.getArrivals(stationId);
    if (apiData.length > 0) {
      await cacheData(stationId, apiData);
      return apiData;
    }
  } catch (error) {
    console.log('Seoul API failed, trying Firebase');
  }

  try {
    // 2. Fallback to Firebase
    const fbData = await trainService.getTrainsByStation(stationId);
    if (fbData.length > 0) {
      return fbData;
    }
  } catch (error) {
    console.log('Firebase failed, using cache');
  }

  // 3. Last resort: Local cache
  return await getCachedData(stationId);
};
```

## 3. Firestore Security Rules

LiveMetro 규칙의 기본 골격. 공개 read + 사용자 격리 write.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for subway data
    match /stations/{stationId} {
      allow read: if true;
      allow write: if false; // Only through admin
    }

    // User-specific data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

> Rules 변경 시 `firebase emulators:exec --only firestore "npm test:rules"` 통과 필수.

## 4. Batch Operations

여러 문서 동시 쓰기는 반드시 `writeBatch` 사용 — atomic guarantee + 트래픽 절감.

```typescript
import { writeBatch } from 'firebase/firestore';

const batch = writeBatch(firestore);
batch.set(docRef1, data1);
batch.update(docRef2, data2);
await batch.commit();
```

## 5. Offline Persistence

Firestore는 기본적으로 오프라인 캐시를 자동 제공. 네트워크 토글이 필요한 경우만 명시적으로 제어.

```typescript
import { enableNetwork, disableNetwork } from 'firebase/firestore';

// Firestore automatically caches data for offline use
// Monitor connectivity and inform users
```

## Common Pitfalls (PR 차단 사유)

| 패턴 | 결과 | 대체 |
|------|------|------|
| 구독 cleanup 누락 | 메모리 누수 | `useEffect` return + `unsubscribe()` |
| 인덱스 없는 쿼리 | 슬로우 + Firebase 콘솔 경고 | `where + orderBy` 조합 검증 후 `firestore.indexes.json` 등록 |
| 클라이언트에 Firebase config 노출 | 보안 사고 | `.env`로 분리 + Rules로 권한 통제 |
| permission-denied 미처리 | 사용자 혼란 | `handleFirebaseError` 사용 (`references/patterns.md` §4) |
| 페이지네이션 없이 컬렉션 전체 fetch | 비용 폭증 | `limit + startAfter` 강제 |
