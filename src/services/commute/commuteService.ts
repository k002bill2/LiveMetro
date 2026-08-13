/**
 * Commute Settings Service
 * Handles saving and loading commute settings to/from Firebase
 * Works with both anonymous and authenticated users using UID
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  deleteField,
  FieldPath,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase/config';
import { CommuteRoute, CommuteType } from '@/models/commute';
import { pruneBoardingPreferences } from '@/services/guidance/destinationPreference';

// Firestore collection name
const COMMUTE_COLLECTION = 'commuteSettings';

export interface CommuteSettings {
  morningRoute: CommuteRoute | null;
  eveningRoute: CommuteRoute | null;
  /**
   * Whether the evening commute leg is active. A settings-level flag kept
   * separate from `eveningRoute` so toggling the leg off (and back on)
   * preserves the saved 퇴근 route data. Legacy documents written before
   * this field existed default to `true` — an existing eveningRoute was
   * implicitly enabled.
   */
  eveningEnabled: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SaveCommuteResult {
  success: boolean;
  error?: string;
}

/**
 * Save commute routes to Firebase Firestore
 * Uses user UID as document ID (works for both anonymous and authenticated users)
 */
export const saveCommuteRoutes = async (
  uid: string,
  morningRoute: CommuteRoute,
  eveningRoute: CommuteRoute
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);

    await setDoc(docRef, {
      morningRoute: {
        departureTime: morningRoute.departureTime,
        departureStationId: morningRoute.departureStationId,
        departureStationName: morningRoute.departureStationName,
        departureLineId: morningRoute.departureLineId,
        arrivalStationId: morningRoute.arrivalStationId,
        arrivalStationName: morningRoute.arrivalStationName,
        arrivalLineId: morningRoute.arrivalLineId,
        transferStations: morningRoute.transferStations || [],
        notifications: morningRoute.notifications,
        bufferMinutes: morningRoute.bufferMinutes,
        ...(morningRoute.boardingPreferences !== undefined && {
          boardingPreferences: pruneBoardingPreferences(
            morningRoute.boardingPreferences,
            morningRoute
          ),
        }),
      },
      eveningRoute: {
        departureTime: eveningRoute.departureTime,
        departureStationId: eveningRoute.departureStationId,
        departureStationName: eveningRoute.departureStationName,
        departureLineId: eveningRoute.departureLineId,
        arrivalStationId: eveningRoute.arrivalStationId,
        arrivalStationName: eveningRoute.arrivalStationName,
        arrivalLineId: eveningRoute.arrivalLineId,
        transferStations: eveningRoute.transferStations || [],
        notifications: eveningRoute.notifications,
        bufferMinutes: eveningRoute.bufferMinutes,
        ...(eveningRoute.boardingPreferences !== undefined && {
          boardingPreferences: pruneBoardingPreferences(
            eveningRoute.boardingPreferences,
            eveningRoute
          ),
        }),
      },
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    console.log('Commute routes saved successfully for UID:', uid);
    return { success: true };
  } catch (error) {
    console.error('Error saving commute routes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
    };
  }
};

/**
 * Load commute routes from Firebase Firestore
 * Uses user UID to fetch settings
 */
/**
 * Like {@link loadCommuteRoutes}, but a read FAILURE propagates instead of
 * collapsing into the same `null` as "no settings saved". Callers that make
 * destructive or scoping decisions off the settings (pattern recomputes)
 * need the distinction — a transient outage must not read as "user has no
 * commute". `null` here always means the document genuinely does not exist.
 */
export const loadCommuteRoutesOrThrow = async (
  uid: string
): Promise<CommuteSettings | null> => {
  if (!uid) {
    console.warn('No UID provided for loading commute routes');
    return null;
  }

  const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log('Commute routes loaded successfully for UID:', uid);
    return {
      morningRoute: data.morningRoute || null,
      eveningRoute: data.eveningRoute || null,
      // Legacy docs predate this field — default to enabled.
      eveningEnabled: data.eveningEnabled ?? true,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    };
  }

  console.log('No commute settings found for UID:', uid);
  return null;
};

export const loadCommuteRoutes = async (
  uid: string
): Promise<CommuteSettings | null> => {
  try {
    return await loadCommuteRoutesOrThrow(uid);
  } catch (error) {
    console.error('Error loading commute routes:', error);
    return null;
  }
};

/**
 * Subscribe to a user's commute routes in real time.
 *
 * Fires `onChange` with the current value immediately and again on every
 * subsequent change to the `commuteSettings/<uid>` document. This is what lets
 * a commute saved on CommuteSettings / onboarding propagate to consumers (e.g.
 * HomeScreen's CommuteRouteCard) without a remount or manual refresh.
 *
 * Returns an unsubscribe function — callers MUST invoke it on cleanup to avoid
 * a leaked Firestore listener (see .claude/rules/subscription-cleanup.md).
 * Errors and a missing/empty document both surface as `null` so consumers can
 * treat them uniformly (no throw — see error-handling rule).
 */
export const subscribeCommuteRoutes = (
  uid: string,
  onChange: (settings: CommuteSettings | null) => void
): (() => void) => {
  if (!uid) {
    console.warn('No UID provided for subscribing to commute routes');
    onChange(null);
    return () => {};
  }

  const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onChange(null);
        return;
      }
      const data = docSnap.data();
      onChange({
        morningRoute: data.morningRoute || null,
        eveningRoute: data.eveningRoute || null,
        // Legacy docs predate this field — default to enabled.
        eveningEnabled: data.eveningEnabled ?? true,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      });
    },
    (error) => {
      console.error('Error subscribing to commute routes:', error);
      onChange(null);
    }
  );
};

/**
 * Update only morning route
 */
export const updateMorningRoute = async (
  uid: string,
  morningRoute: CommuteRoute
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    await updateDoc(docRef, {
      morningRoute: {
        departureTime: morningRoute.departureTime,
        departureStationId: morningRoute.departureStationId,
        departureStationName: morningRoute.departureStationName,
        departureLineId: morningRoute.departureLineId,
        arrivalStationId: morningRoute.arrivalStationId,
        arrivalStationName: morningRoute.arrivalStationName,
        arrivalLineId: morningRoute.arrivalLineId,
        transferStations: morningRoute.transferStations || [],
        notifications: morningRoute.notifications,
        bufferMinutes: morningRoute.bufferMinutes,
        ...(morningRoute.boardingPreferences !== undefined && {
          boardingPreferences: pruneBoardingPreferences(
            morningRoute.boardingPreferences,
            morningRoute
          ),
        }),
      },
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating morning route:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
    };
  }
};

/**
 * Update only evening route
 */
export const updateEveningRoute = async (
  uid: string,
  eveningRoute: CommuteRoute
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    await updateDoc(docRef, {
      eveningRoute: {
        departureTime: eveningRoute.departureTime,
        departureStationId: eveningRoute.departureStationId,
        departureStationName: eveningRoute.departureStationName,
        departureLineId: eveningRoute.departureLineId,
        arrivalStationId: eveningRoute.arrivalStationId,
        arrivalStationName: eveningRoute.arrivalStationName,
        arrivalLineId: eveningRoute.arrivalLineId,
        transferStations: eveningRoute.transferStations || [],
        notifications: eveningRoute.notifications,
        bufferMinutes: eveningRoute.bufferMinutes,
        ...(eveningRoute.boardingPreferences !== undefined && {
          boardingPreferences: pruneBoardingPreferences(
            eveningRoute.boardingPreferences,
            eveningRoute
          ),
        }),
      },
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating evening route:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
    };
  }
};

/**
 * 특정 leg의 boardingPreferences 중 **한 탑승 구간 키만** 부분 업데이트한다.
 *
 * 맵 전체가 아니라 키 하나만 쓰는 이유: 호출자(길안내 화면)의 세션 사본은 원격
 * 선호가 늦게 attach되기 전이면 비어 있을 수 있어, 그 상태의 full-map 치환이 같은
 * leg의 다른 구간 키를 원격에서 소멸시킨다. 키 단위 쓰기는 그 레이스를 구조적으로
 * 무의미하게 만든다 — stale 전체-객체 spread 저장이 즐겨찾기를 롤백시킨
 * 전례(updateUserPreferences 사건)와 같은 클래스의 사고 차단.
 *
 * 경로는 문자열 dot-path 조합이 아니라 {@link FieldPath} 세그먼트로 만든다:
 * boardingKey(`stationId|lineId`)에 임의 문자가 들어올 수 있어 문자열 조합은
 * 경로 해석이 깨질 수 있다.
 *
 * `destinations`가 null이거나 빈 배열이면 해당 키를 {@link deleteField}로 제거한다
 * (선호 해제 = 키 삭제).
 *
 * 쓰기 전 leg 존재를 {@link getDoc}으로 확인한다: 대상 leg가 없는 문서(퇴근 토글만
 * 켠 사용자·레거시 문서)에 중첩 FieldPath를 쓰면 Firestore가 실패 대신 중간 맵을
 * 만들어 `morningRoute = { boardingPreferences }`라는 필수 필드 없는 팬텀 route가
 * 남고, loadCommuteRoutes가 이를 truthy로 통과시킨다. 읽기 1회 추가 비용은 토글
 * 빈도상 수용한다.
 *
 * 호출은 **키 단위 직렬화 큐**를 거친다 — 같은 옵션을 빠르게 두 번 탭하면 두 호출의
 * `getDoc`(존재 게이트) → `updateDoc`이 인터리브해 나중 의도가 먼저 착지하는 역전이
 * 가능하다(선택 해제가 선택보다 먼저 커밋되는 등). 키(`uid|leg|boardingKey`)별 큐라
 * 다른 구간·다른 leg의 토글은 서로 대기하지 않는다. 문법은 boardingAlertService·
 * alightAlertService의 직렬화 큐 패턴 그대로.
 */
const boardingPreferenceQueues = new Map<string, Promise<unknown>>();

/** {@link updateBoardingPreferences}의 실제 본문 — 직렬화 큐 안에서만 실행된다. */
const updateBoardingPreferencesInner = async (
  uid: string,
  leg: CommuteType,
  boardingKey: string,
  destinations: readonly string[] | null
): Promise<SaveCommuteResult> => {
  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    const legField = leg === 'morning' ? 'morningRoute' : 'eveningRoute';

    const snapshot = await getDoc(docRef);
    if (!snapshot.data()?.[legField]) {
      return { success: false, error: '해당 출퇴근 경로가 저장되어 있지 않습니다' };
    }

    const value =
      destinations !== null && destinations.length > 0 ? destinations : deleteField();
    await updateDoc(
      docRef,
      new FieldPath(legField, 'boardingPreferences', boardingKey),
      value,
      'updatedAt',
      serverTimestamp()
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating boarding preferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다',
    };
  }
};

export const updateBoardingPreferences = async (
  uid: string,
  leg: CommuteType,
  boardingKey: string,
  destinations: readonly string[] | null
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  const queueKey = `${uid}|${leg}|${boardingKey}`;
  const exec = (): Promise<SaveCommuteResult> =>
    updateBoardingPreferencesInner(uid, leg, boardingKey, destinations);
  const prev = boardingPreferenceQueues.get(queueKey) ?? Promise.resolve();
  // 앞선 실행이 어떻게 끝나든(성공/거부) 다음 주자를 이어 붙인다 — 한 번의 실패가
  // 그 키의 큐를 영구히 멈추지 않게.
  const run = prev.then(exec, exec);
  boardingPreferenceQueues.set(queueKey, run);
  try {
    return await run;
  } finally {
    // 마지막 주자만 정리한다 — 대기 중인 후속이 이미 큐를 이어받았다면 그 소유를
    // 빼앗지 않는다(그랬다간 후속과 그 다음 호출이 병렬로 달린다).
    if (boardingPreferenceQueues.get(queueKey) === run) {
      boardingPreferenceQueues.delete(queueKey);
    }
  }
};

/**
 * Enable or disable the evening commute leg.
 *
 * Persists only the `eveningEnabled` settings flag — the saved
 * `eveningRoute` data is left untouched, so toggling the leg back on
 * restores the route without forcing the user to re-enter it. Uses
 * `setDoc` with `merge` so the call is safe even if the document was
 * somehow not created yet.
 */
export const updateEveningEnabled = async (
  uid: string,
  enabled: boolean
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    await setDoc(
      docRef,
      { eveningEnabled: enabled, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating evening enabled flag:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다',
    };
  }
};

/**
 * 계정 삭제 시 `commuteSettings/<uid>` 문서를 파기한다.
 *
 * 이 문서는 출퇴근 경로(출발·도착·환승역)와 종점행 선호를 담은 개인 데이터라
 * 계정이 사라진 뒤 남으면 어떤 클라이언트로도 도달할 수 없는 고아 문서가 된다.
 *
 * **호출 시점은 Firebase Auth 계정 삭제 *전*이어야 한다** — firestore.rules의
 * `commuteSettings/{userId}`는 `request.auth.uid == userId`를 요구하므로,
 * `deleteUser()` 이후에는 토큰이 사라져 permission-denied로 조용히 실패한다.
 *
 * 실패는 호출자가 계정 삭제를 중단할 사유가 아니다(throw 금지, 결과 객체 반환) —
 * 일시적 Firestore 오류가 계정 삭제 자체를 막는 쪽이 더 나쁜 실패 모드다.
 */
export const deleteCommuteSettings = async (
  uid: string
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    await deleteDoc(doc(firestore, COMMUTE_COLLECTION, uid));
    return { success: true };
  } catch (error) {
    console.error('Error deleting commute settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다',
    };
  }
};

export default {
  saveCommuteRoutes,
  loadCommuteRoutes,
  loadCommuteRoutesOrThrow,
  subscribeCommuteRoutes,
  updateMorningRoute,
  updateEveningRoute,
  updateEveningEnabled,
  updateBoardingPreferences,
  deleteCommuteSettings,
};
