/**
 * Account Deletion Service
 *
 * 사용자 요청에 의한 계정 삭제 + 개인정보 전수 파기. Admin SDK는
 * firestore.rules를 우회하므로 `users/{uid}`의 `allow delete: if false`
 * 규칙을 바꾸지 않고도 서버에서 파기할 수 있다(규칙 변경 금지).
 *
 * kakaoAuthService와 같은 방식으로 순수 로직 + 의존성 주입으로 작성한다
 * (구조적 `*Like` 인터페이스) — emulator 없이 jest 유닛 테스트가 가능하다.
 *
 * 설계 불변식 두 가지:
 *   1. **순서**: Firestore 파기가 전부 성공한 뒤에만 Auth 레코드를 지운다.
 *      역순이면 파기 실패 시 계정만 사라져 어떤 클라이언트로도 도달할 수
 *      없는 고아 문서가 남는다. 특히 `kakao:{id}` uid는 결정적이라
 *      재로그인 시 같은 uid로 남은 데이터가 되살아난다.
 *   2. **멱등성**: 없는 문서 삭제는 no-op, 익명화된 문서는 uid 쿼리에
 *      더 이상 매칭되지 않으므로 재호출은 안전하다(부분 실패 후 재시도).
 */

/** 작성자 식별자 치환 상수 — 커뮤니티 제보는 삭제하지 않고 익명화한다. */
export const DELETED_USER_ID = 'deleted-user';
/** 표시용 닉네임 치환 상수. */
export const DELETED_USER_DISPLAY_NAME = '탈퇴한 사용자';

/** Firestore write batch 상한은 500 — 여유를 두고 400으로 청크한다. */
const WRITE_BATCH_LIMIT = 400;
/** 안전 상한: 400 × 50 = 20,000 문서/단계. 초과 시 해당 단계를 실패 처리한다. */
const MAX_PAGES_PER_STEP = 50;

export interface AdminDocumentRefLike {
  delete(): Promise<unknown>;
}

export interface AdminQueryDocumentLike {
  readonly ref: AdminDocumentRefLike;
}

export interface AdminQuerySnapshotLike {
  readonly empty: boolean;
  readonly docs: readonly AdminQueryDocumentLike[];
}

export interface AdminQueryLike {
  where(field: string, op: '==', value: string): AdminQueryLike;
  limit(count: number): AdminQueryLike;
  get(): Promise<AdminQuerySnapshotLike>;
}

export interface AdminCollectionLike extends AdminQueryLike {
  doc(id: string): AdminDocumentRefLike;
}

export interface AdminWriteBatchLike {
  update(ref: AdminDocumentRefLike, data: Record<string, unknown>): unknown;
  delete(ref: AdminDocumentRefLike): unknown;
  commit(): Promise<unknown>;
}

export interface AdminFirestoreLike {
  collection(path: string): AdminCollectionLike;
  collectionGroup(collectionId: string): AdminQueryLike;
  batch(): AdminWriteBatchLike;
}

export interface AdminAuthDeleteLike {
  deleteUser(uid: string): Promise<void>;
}

export interface AccountPurgeDeps {
  readonly db: AdminFirestoreLike;
  /**
   * `<collection>/<uid>` 문서와 그 하위 컬렉션 전체를 재귀 삭제한다.
   *
   * `Firestore.recursiveDelete`는 실제 `DocumentReference`(id·path 등 13개
   * 멤버)를 요구해 구조적 `*Like` 타입으로는 만족시킬 수 없다. 그래서
   * 경로 기반 콜백으로 주입받고 어댑터는 합성 지점(index.ts)에 둔다 —
   * 서비스는 순수하게 유지되고 테스트는 fake 하나로 끝난다.
   */
  readonly recursiveDeleteDocument: (path: string) => Promise<void>;
}

export interface AccountDeletionDeps extends AccountPurgeDeps {
  readonly auth: AdminAuthDeleteLike;
}

/** 파기 단계 식별자 — 실패 로깅과 테스트 단언에 쓰인다(응답에는 넣지 않는다). */
export type PurgeStep =
  | 'users'
  | 'commuteSettings'
  | 'commuteLogs'
  | 'commutePatterns'
  | 'smartNotificationSettings'
  | 'pushTokens'
  | 'favorites'
  | 'delayReports'
  | 'delayReportComments'
  | 'congestionReports';

export interface AccountPurgeResult {
  /** 실패한 단계. 비어 있으면 Firestore 파기가 전부 성공한 것이다. */
  readonly failedSteps: readonly PurgeStep[];
}

/** Firestore 파기가 하나라도 실패해 Auth 레코드를 남긴 경우. */
export class AccountDeletionError extends Error {
  constructor(readonly failedSteps: readonly PurgeStep[]) {
    super(`account purge failed at ${failedSteps.length} step(s)`);
    this.name = 'AccountDeletionError';
  }
}

/**
 * uid로 매칭되는 문서를 페이지 단위로 순회하며 쓰기를 적용한다.
 *
 * 삭제는 문서를 사라지게 하고 익명화는 쿼리 대상 필드 자체를 치환하므로,
 * 처리된 문서는 다음 페이지 쿼리에 다시 잡히지 않는다 → 루프는 종료한다.
 * 그럼에도 비정상 상황(쓰기가 조건을 바꾸지 못함)에서 무한 루프가 되지
 * 않도록 MAX_PAGES_PER_STEP로 상한을 두고 초과 시 throw 한다.
 */
const runPagedWrite = async (
  db: AdminFirestoreLike,
  query: AdminQueryLike,
  apply: (batch: AdminWriteBatchLike, ref: AdminDocumentRefLike) => void,
): Promise<void> => {
  for (let page = 0; page < MAX_PAGES_PER_STEP; page += 1) {
    const snapshot = await query.limit(WRITE_BATCH_LIMIT).get();
    if (snapshot.empty || snapshot.docs.length === 0) return;

    const batch = db.batch();
    for (const document of snapshot.docs) {
      apply(batch, document.ref);
    }
    await batch.commit();

    if (snapshot.docs.length < WRITE_BATCH_LIMIT) return;
  }
  throw new Error('paged write exceeded the maximum page count');
};

/** uid를 문서 ID로 쓰는 단일 문서 파기. 없는 문서 삭제는 Firestore no-op. */
const deleteOwnedDocument =
  (collectionPath: string) =>
  ({ db }: AccountPurgeDeps, uid: string): Promise<unknown> =>
    db.collection(collectionPath).doc(uid).delete();

/**
 * uid 문서와 그 하위 컬렉션 전체를 재귀 삭제한다(commuteLogs/{uid}/logs 등).
 * `recursiveDelete`는 개별 삭제가 하나라도 실패하면 reject 하므로
 * (SDK typedoc: "The promise is rejected if any of the deletes fail")
 * 별도 BulkWriter 오류 콜백 없이 try/catch 게이트로 충분하다.
 */
const recursiveDeleteOwnedTree =
  (collectionPath: string) =>
  ({ recursiveDeleteDocument }: AccountPurgeDeps, uid: string): Promise<void> =>
    recursiveDeleteDocument(`${collectionPath}/${uid}`);

/** 작성자 식별 필드를 치환하고 본문·시각·집계 카운트는 보존한다. */
const anonymizeDelayReports = ({ db }: AccountPurgeDeps, uid: string): Promise<void> =>
  runPagedWrite(
    db,
    db.collection('delayReports').where('userId', '==', uid),
    (batch, ref) =>
      batch.update(ref, {
        userId: DELETED_USER_ID,
        userDisplayName: DELETED_USER_DISPLAY_NAME,
      }),
  );

/**
 * 제보 댓글은 `delayReports/{reportId}/comments` 하위 컬렉션이라 collection
 * group 쿼리로 모은다. `badge`는 사용자의 즐겨찾기 역에서 파생된 약한
 * 개인 신호라 함께 비운다(`null` = 작성 시 badge 없음과 동일한 표현).
 */
const anonymizeReportComments = ({ db }: AccountPurgeDeps, uid: string): Promise<void> =>
  runPagedWrite(
    db,
    db.collectionGroup('comments').where('userId', '==', uid),
    (batch, ref) =>
      batch.update(ref, {
        userId: DELETED_USER_ID,
        userDisplayName: DELETED_USER_DISPLAY_NAME,
        badge: null,
      }),
  );

/** congestionReports는 표시용 이름 없이 reporterId만 개인 식별자다. */
const anonymizeCongestionReports = ({ db }: AccountPurgeDeps, uid: string): Promise<void> =>
  runPagedWrite(
    db,
    db.collection('congestionReports').where('reporterId', '==', uid),
    (batch, ref) => batch.update(ref, { reporterId: DELETED_USER_ID }),
  );

/**
 * 최상위 `favorites` 컬렉션 정리.
 *
 * 현재 클라이언트(favoritesService)는 즐겨찾기를 `users/{uid}` 문서의
 * `preferences.favoriteStations` 배열에 저장하므로 users 삭제로 이미
 * 파기된다. 다만 firestore.rules에 `favorites/{favoriteId}` 블록이 살아
 * 있어 구버전 앱이 쓴 문서가 남아 있을 수 있어 방어적으로 함께 지운다
 * (비어 있으면 no-op).
 */
const deleteLegacyFavorites = ({ db }: AccountPurgeDeps, uid: string): Promise<void> =>
  runPagedWrite(
    db,
    db.collection('favorites').where('userId', '==', uid),
    (batch, ref) => batch.delete(ref),
  );

interface PurgeStepRunner {
  readonly step: PurgeStep;
  readonly run: (deps: AccountPurgeDeps, uid: string) => Promise<unknown>;
}

/** 실행 순서 고정 — 로그와 테스트 단언이 결정적이어야 한다. */
const PURGE_STEPS: readonly PurgeStepRunner[] = [
  { step: 'users', run: deleteOwnedDocument('users') },
  { step: 'commuteSettings', run: deleteOwnedDocument('commuteSettings') },
  { step: 'commuteLogs', run: recursiveDeleteOwnedTree('commuteLogs') },
  { step: 'commutePatterns', run: recursiveDeleteOwnedTree('commutePatterns') },
  {
    step: 'smartNotificationSettings',
    run: deleteOwnedDocument('smartNotificationSettings'),
  },
  { step: 'pushTokens', run: deleteOwnedDocument('pushTokens') },
  { step: 'favorites', run: deleteLegacyFavorites },
  { step: 'delayReports', run: anonymizeDelayReports },
  { step: 'delayReportComments', run: anonymizeReportComments },
  { step: 'congestionReports', run: anonymizeCongestionReports },
];

/**
 * Firestore 개인정보를 전수 파기한다. 한 단계가 실패해도 나머지는 계속
 * 진행한다 — 일시적 오류로 파기 가능한 데이터까지 남기는 것이 더 나쁘고,
 * 멱등성 덕분에 재호출로 남은 단계만 다시 시도할 수 있다.
 *
 * 실패는 throw 하지 않고 결과로 반환한다(호출자가 Auth 삭제 여부를 결정).
 */
export const purgeUserFirestoreData = async (
  deps: AccountPurgeDeps,
  uid: string,
): Promise<AccountPurgeResult> => {
  const failedSteps: PurgeStep[] = [];

  for (const runner of PURGE_STEPS) {
    try {
      await runner.run(deps, uid);
    } catch (error) {
      failedSteps.push(runner.step);
      // 문서 본문·PII는 절대 남기지 않는다 — 단계명과 에러 메시지만.
      console.error(
        `deleteAccount purge step failed: ${runner.step}:`,
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }

  return { failedSteps };
};

const isUserNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'auth/user-not-found';

/**
 * 계정 전수 파기: Firestore 파기 → (전부 성공 시에만) Auth 레코드 삭제.
 *
 * 하나라도 실패하면 `AccountDeletionError`를 던지고 Auth 레코드는 그대로
 * 둔다. 사용자는 로그인 상태를 유지한 채 재시도할 수 있다.
 *
 * 이미 삭제된 계정에 대한 재호출은 `auth/user-not-found`를 성공으로
 * 간주한다(멱등).
 */
export const deleteAccountAndData = async (
  deps: AccountDeletionDeps,
  uid: string,
): Promise<void> => {
  const { failedSteps } = await purgeUserFirestoreData(deps, uid);
  if (failedSteps.length > 0) {
    throw new AccountDeletionError(failedSteps);
  }

  try {
    await deps.auth.deleteUser(uid);
  } catch (error) {
    if (isUserNotFound(error)) return;
    throw error;
  }
};
