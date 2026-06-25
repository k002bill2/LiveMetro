# Firebase Code Patterns — Auth · Query · Subscription · Error

LiveMetro에서 검증된 Firebase 클라이언트 패턴 모음. SKILL.md에서 진입점만 보고, 실제 구현은 여기 코드 블록을 참고/복사한다.

## 1. Authentication Pattern

```typescript
import { auth } from '@/services/firebase/config';
import {
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';

// Anonymous authentication for basic features
const signIn = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Auth error:', error);
    throw error;
  }
};

// Listen to auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
  } else {
    // User is signed out
  }
});
```

## 2. Firestore Query Pattern

```typescript
import { firestore } from '@/services/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

// Basic query
const getStations = async (lineId: string) => {
  try {
    const stationsRef = collection(firestore, 'stations');
    const q = query(
      stationsRef,
      where('lineId', '==', lineId),
      orderBy('sequence')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Firestore query error:', error);
    return [];
  }
};
```

## 3. Real-time Subscription Pattern

```typescript
import { onSnapshot } from 'firebase/firestore';

// Subscribe to real-time updates
const subscribeToTrains = (
  stationId: string,
  callback: (trains: Train[]) => void
): (() => void) => {
  const trainsRef = collection(firestore, 'trains');
  const q = query(
    trainsRef,
    where('currentStationId', '==', stationId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const trains = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Train));
      callback(trains);
    },
    (error) => {
      console.error('Snapshot error:', error);
    }
  );

  return unsubscribe; // Return cleanup function
};

// Usage in component
useEffect(() => {
  const unsubscribe = subscribeToTrains(stationId, setTrains);
  return () => unsubscribe(); // Cleanup on unmount
}, [stationId]);
```

> **반드시 cleanup 함수 반환**: `subscription-cleanup` 규칙 위반 시 메모리 누수 → PR 차단.

## 4. Error Handling

서비스 함수는 throw 대신 **catch 후 `console.error` + 빈 배열(`[]`)/`null` 반환**한다 (`error-handling.md` 규칙). `FirebaseError` 코드는 사용자 친화 메시지 매핑에만 사용한다 — `handleFirebaseError` 같은 헬퍼는 코드베이스에 없으므로 catch 블록 안에서 직접 분기한다.

```typescript
import { FirebaseError } from 'firebase/app';

const getStations = async (lineId: string): Promise<Station[]> => {
  try {
    // ...query...
    return stations;
  } catch (error) {
    // FirebaseError 코드 → 사용자 메시지 (로깅/UI용)
    const message =
      error instanceof FirebaseError
        ? error.code === 'permission-denied'
          ? '데이터 접근 권한이 없습니다'
          : error.code === 'unavailable'
            ? 'Firebase 서비스가 일시적으로 불안정합니다'
            : error.message
        : '예기치 못한 오류가 발생했습니다';
    console.error('Firestore query error:', message, error);
    return []; // 빈 배열 반환 (throw 금지)
  }
};
```
