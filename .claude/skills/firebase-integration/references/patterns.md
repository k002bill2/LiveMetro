# Firebase Code Patterns — Auth · Query · Subscription · Error

LiveMetro에서 검증된 Firebase 클라이언트 패턴 모음. SKILL.md에서 진입점만 보고, 실제 구현은 여기 코드 블록을 참고/복사한다.

## 1. Authentication Pattern

```typescript
import { auth } from '@/config/firebase';
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
import { firestore } from '@/config/firebase';
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

```typescript
import { FirebaseError } from 'firebase/app';

const handleFirebaseError = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to access this data';
      case 'unavailable':
        return 'Firebase service is temporarily unavailable';
      case 'unauthenticated':
        return 'Please sign in to continue';
      default:
        return error.message;
    }
  }
  return 'An unexpected error occurred';
};
```
