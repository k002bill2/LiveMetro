---
name: firebase-integration
description: Firebase Firestore, Auth, and Cloud Functions integration for LiveMetro. Use when working with backend services, authentication, or real-time data sync.
---

# Firebase Integration Guidelines

## Architecture Overview

LiveMetro uses Firebase as the cloud backend layer in the 3-tier architecture:

```
Seoul Subway API → Firebase Firestore → Local AsyncStorage
     (Tier 1)          (Tier 2)           (Tier 3)
```

## Firebase Configuration

### Initialization (src/services/firebase/config.ts)

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
```

## Firestore Data Patterns

### 1. Collection Structure

```
/stations/{stationId}
  - name: string
  - lineNames: string[]
  - location: GeoPoint
  - createdAt: Timestamp

/realtime-trains/{stationId}/arrivals/{trainId}
  - trainNo: string
  - lineNumber: string
  - direction: string
  - arrivalTime: number
  - status: string
  - updatedAt: Timestamp

/users/{userId}
  - email: string
  - preferences: object
  - favoriteStations: string[]
  - createdAt: Timestamp

/notifications/{notificationId}
  - userId: string
  - type: string
  - title: string
  - body: string
  - read: boolean
  - createdAt: Timestamp
```

### 2. Real-time Subscription Pattern

```typescript
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase/config';

/**
 * Subscribe to real-time train arrivals for a station
 */
export const subscribeToTrainArrivals = (
  stationId: string,
  callback: (trains: Train[]) => void
): (() => void) => {
  const arrivalsRef = collection(
    db,
    'realtime-trains',
    stationId,
    'arrivals'
  );

  const q = query(
    arrivalsRef,
    where('arrivalTime', '>', Date.now())
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const trains = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Train[];

      callback(trains);
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      // Fallback to local cache
    }
  );

  return unsubscribe;
};
```

### 3. CRUD Operations with Error Handling

```typescript
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@services/firebase/config';

/**
 * Create or update station data
 */
export const saveStation = async (
  stationId: string,
  data: Partial<Station>
): Promise<void> => {
  try {
    const stationRef = doc(db, 'stations', stationId);

    await setDoc(
      stationRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving station:', error);
    throw new Error('Failed to save station data');
  }
};

/**
 * Get station data with fallback
 */
export const getStation = async (
  stationId: string
): Promise<Station | null> => {
  try {
    const stationRef = doc(db, 'stations', stationId);
    const snapshot = await getDoc(stationRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Station;
  } catch (error) {
    console.error('Error getting station:', error);
    // Fallback to local cache
    return null;
  }
};
```

### 4. Batch Operations

```typescript
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@services/firebase/config';

/**
 * Update multiple stations in a single transaction
 */
export const updateMultipleStations = async (
  updates: Array<{ id: string; data: Partial<Station> }>
): Promise<void> => {
  const batch = writeBatch(db);

  updates.forEach(({ id, data }) => {
    const stationRef = doc(db, 'stations', id);
    batch.update(stationRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Batch update failed:', error);
    throw error;
  }
};
```

## Authentication Patterns

### 1. Email/Password Authentication

```typescript
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@services/firebase/config';

/**
 * Sign in with email and password
 */
export const signIn = async (
  email: string,
  password: string
): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Sign in error:', error);
    throw new Error('인증에 실패했습니다');
  }
};

/**
 * Sign up new user
 */
export const signUp = async (
  email: string,
  password: string
): Promise<void> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Create user profile in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      createdAt: serverTimestamp(),
      favoriteStations: [],
    });
  } catch (error) {
    console.error('Sign up error:', error);
    throw new Error('회원가입에 실패했습니다');
  }
};

/**
 * Sign out current user
 */
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthChange = (
  callback: (user: User | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, callback);
};
```

## Cloud Functions Integration

### 1. Callable Functions

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@services/firebase/config';

/**
 * Call cloud function to get train predictions
 */
export const getTrainPredictions = async (
  stationId: string,
  lineNumber: string
): Promise<TrainPrediction[]> => {
  try {
    const predictTrains = httpsCallable(functions, 'predictTrains');
    const result = await predictTrains({ stationId, lineNumber });

    return result.data as TrainPrediction[];
  } catch (error) {
    console.error('Cloud function error:', error);
    throw new Error('예측 정보를 가져오는데 실패했습니다');
  }
};
```

### 2. Background Functions (Server-side)

```typescript
// functions/src/index.ts (Cloud Functions code)
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Update train arrival data every 30 seconds
 */
export const updateTrainArrivals = functions.pubsub
  .schedule('every 30 seconds')
  .onRun(async (context) => {
    const db = admin.firestore();

    // Fetch from Seoul API
    const trains = await fetchFromSeoulAPI();

    // Update Firestore
    const batch = db.batch();
    trains.forEach((train) => {
      const ref = db
        .collection('realtime-trains')
        .doc(train.stationId)
        .collection('arrivals')
        .doc(train.id);

      batch.set(ref, {
        ...train,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Updated ${trains.length} train arrivals`);
  });
```

## Offline Persistence

```typescript
import { enableIndexedDbPersistence } from 'firebase/firestore';
import { db } from '@services/firebase/config';

/**
 * Enable offline persistence
 */
export const enableOfflineSupport = async (): Promise<void> => {
  try {
    await enableIndexedDbPersistence(db);
    console.log('Offline persistence enabled');
  } catch (error) {
    if (error.code === 'failed-precondition') {
      // Multiple tabs open
      console.warn('Persistence failed: Multiple tabs open');
    } else if (error.code === 'unimplemented') {
      // Browser doesn't support persistence
      console.warn('Persistence not supported');
    }
  }
};
```

## Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Stations - public read, admin write
    match /stations/{stationId} {
      allow read: if true;
      allow write: if request.auth.token.admin == true;
    }

    // Real-time trains - public read, system write
    match /realtime-trains/{stationId}/arrivals/{trainId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Users - authenticated users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Notifications - users can read their own notifications
    match /notifications/{notificationId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

## Error Handling Best Practices

```typescript
import { FirebaseError } from 'firebase/app';

/**
 * Handle Firebase errors with user-friendly messages
 */
export const handleFirebaseError = (error: unknown): string => {
  if (!(error instanceof FirebaseError)) {
    return '알 수 없는 오류가 발생했습니다';
  }

  switch (error.code) {
    case 'auth/user-not-found':
      return '사용자를 찾을 수 없습니다';
    case 'auth/wrong-password':
      return '비밀번호가 올바르지 않습니다';
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다';
    case 'permission-denied':
      return '접근 권한이 없습니다';
    case 'unavailable':
      return '네트워크 연결을 확인해주세요';
    default:
      console.error('Firebase error:', error.code, error.message);
      return '작업을 완료할 수 없습니다';
  }
};
```

## Performance Optimization

### 1. Limit Query Results
```typescript
import { query, limit, orderBy } from 'firebase/firestore';

const q = query(
  collection(db, 'realtime-trains'),
  orderBy('arrivalTime'),
  limit(20)
);
```

### 2. Use Composite Indexes
```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "arrivals",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lineNumber", "order": "ASCENDING" },
        { "fieldPath": "arrivalTime", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 3. Cache Strategy
```typescript
import { getDocFromCache, getDocFromServer } from 'firebase/firestore';

const docRef = doc(db, 'stations', stationId);

try {
  // Try cache first
  const snapshot = await getDocFromCache(docRef);
  return snapshot.data();
} catch {
  // Fallback to server
  const snapshot = await getDocFromServer(docRef);
  return snapshot.data();
}
```

## Testing with Firebase Emulators

```typescript
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';

if (__DEV__) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

## Remember

- ✅ Always use serverTimestamp() for timestamps
- ✅ Implement proper error handling with user-friendly messages
- ✅ Use batch operations for multiple writes
- ✅ Enable offline persistence for better UX
- ✅ Set up security rules properly
- ✅ Use composite indexes for complex queries
- ✅ Unsubscribe from real-time listeners when component unmounts
- ✅ Test with Firebase Emulators in development

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Data Modeling](https://firebase.google.com/docs/firestore/data-model)
- [Security Rules Guide](https://firebase.google.com/docs/rules)
