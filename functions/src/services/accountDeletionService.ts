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

import { logger } from 'firebase-functions';

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

/**
 * `FieldPath`의 최소 형태. 서비스는 만들어 넘기기만 하고 내부를 보지 않는다.
 *
 * uid를 필드 **이름**으로 쓰는 map(`reactedBy`)은 `reactedBy.${uid}` 같은
 * dotted 문자열로 가리키면 uid 속 문자가 경로 해석을 바꿀 수 있다 —
 * 세그먼트를 그대로 담는 `FieldPath`로만 다룬다.
 */
export interface AdminFieldPathLike {
  isEqual(other: AdminFieldPathLike): boolean;
}

export interface AdminQueryLike {
  where(
    field: string | AdminFieldPathLike,
    op: '==' | '!=' | 'array-contains',
    value: string | null,
  ): AdminQueryLike;
  limit(count: number): AdminQueryLike;
  get(): Promise<AdminQuerySnapshotLike>;
}

export interface AdminCollectionLike extends AdminQueryLike {
  doc(id: string): AdminDocumentRefLike;
}

export interface AdminWriteBatchLike {
  update(ref: AdminDocumentRefLike, data: Record<string, unknown>): unknown;
  update(ref: AdminDocumentRefLike, field: AdminFieldPathLike, value: unknown): unknown;
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
  /**
   * `FieldValue.arrayRemove(value)` 센티널을 만든다.
   *
   * 반응 배열에서 uid만 원자적으로 빼기 위한 것이다. 문서를 읽어 메모리에서
   * 걸러 다시 쓰면 동시에 들어온 다른 사용자의 투표를 덮어쓴다(lost update).
   * 센티널은 Admin SDK 전역이라 순수 서비스에 주입한다(recursiveDelete와 동일한 이유).
   */
  readonly arrayRemoveValue: (value: string) => unknown;
  /** `new FieldPath(...segments)` — 위 두 어댑터와 같은 이유로 주입한다. */
  readonly fieldPath: (...segments: string[]) => AdminFieldPathLike;
  /**
   * `FieldValue.delete()` 센티널. `null`이나 `undefined`로 대체하면 키가
   * 남거나(null) 쓰기가 거부된다(undefined) — 반드시 진짜 센티널이어야 한다.
   */
  readonly deleteFieldValue: () => unknown;
}

export interface AccountDeletionDeps extends AccountPurgeDeps {
  readonly auth: AdminAuthDeleteLike;
}

/** 파기 단계 식별자 — 실패 로깅과 테스트 단언에 쓰인다(응답에는 넣지 않는다). */
export type PurgeStep =
  | 'delayReportUpvotes'
  | 'delayReportReactions'
  | 'delayReportCommentLikes'
  | 'users'
  | 'commuteSettings'
  | 'commuteLogs'
  | 'commutePatterns'
  | 'smartNotificationSettings'
  | 'pushTokens'
  | 'fcmTokens'
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
 * 로깅용 안전한 오류 식별자.
 *
 * Admin SDK(gRPC) 오류 `message`에는 실패한 문서 경로가 그대로 들어가고 그
 * 경로에는 uid가 포함된다. 따라서 message는 절대 로깅하지 않고, 구조화된
 * `code`(없으면 생성자 이름)만 남긴다.
 */
const describeErrorCode = (error: unknown): string => {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' || typeof code === 'number') return String(code);
  return error instanceof Error ? error.name : 'unknown';
};

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

/**
 * uid를 문서 ID로 쓰는 문서와 그 하위 컬렉션 전체를 재귀 삭제한다
 * (`commuteLogs/{uid}/logs/*` 등).
 *
 * 단일 문서 삭제(`doc().delete()`)와 재귀 삭제를 섞지 않고 **전부 재귀로
 * 통일**한다. 오늘은 `pushTokens`·`smartNotificationSettings`·`commuteSettings`·
 * `users`에 하위 컬렉션이 없지만, 나중에 하나 생기면 조용히 파기 누락이
 * 발생하고 이를 감지할 수단이 없다. 경로 형태가 같고 없는 문서·하위
 * 컬렉션은 no-op이라 비용도 사실상 동일하다.
 *
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

/**
 * 반응 배열에서 uid만 제거한다 — **집계 카운트는 건드리지 않는다.**
 *
 * `upvotedBy`/`likedBy`는 "누가 무엇에 반응했는가"라는 개인 식별 데이터이고,
 * **타인의 문서**에 남으므로 작성자 익명화(userId 치환)로는 지워지지 않는다.
 * 반면 `upvotes`/`likes` 카운트는 커뮤니티 집계다. 탈퇴 계정의 재투표 방지는
 * 무의미하므로 배열에서만 빼도 정합성 문제가 되지 않는다(카운트 보존이 요구사항).
 *
 * `arrayRemove` 센티널을 쓰는 이유는 원자성이다 — 읽고-거르고-쓰면 그 사이
 * 다른 사용자의 투표가 유실된다.
 */
const removeUidFromArray =
  (
    step: 'upvotedBy' | 'likedBy',
    buildQuery: (deps: AccountPurgeDeps, uid: string) => AdminQueryLike,
  ) =>
  (deps: AccountPurgeDeps, uid: string): Promise<void> =>
    runPagedWrite(deps.db, buildQuery(deps, uid), (batch, ref) =>
      batch.update(ref, { [step]: deps.arrayRemoveValue(uid) }),
    );

/** 내가 추천을 누른 (남의) 지연 제보. */
const removeUpvoteTraces = removeUidFromArray('upvotedBy', ({ db }, uid) =>
  db.collection('delayReports').where('upvotedBy', 'array-contains', uid),
);

/** 내가 좋아요를 누른 (남의) 제보 댓글 — 하위 컬렉션이라 collection group. */
const removeCommentLikeTraces = removeUidFromArray('likedBy', ({ db }, uid) =>
  db.collectionGroup('comments').where('likedBy', 'array-contains', uid),
);

/**
 * 내가 반응한 (남의) 지연 제보의 `reactedBy` map에서 **내 uid 키**를 지운다.
 * `reactions.*` 카운트는 upvotes와 같은 이유로 보존한다(커뮤니티 집계).
 *
 * `reactedBy`는 배열이 아니라 uid-키 map이라 arrayRemove를 쓸 수 없다 →
 * 키 자체를 `FieldValue.delete()`로 지운다. 지워진 문서는 다음 페이지 쿼리에
 * 다시 잡히지 않으므로 `runPagedWrite` 루프가 종료한다.
 *
 * 쿼리가 2개인 이유: Firestore `!= null`은 값이 null인 키를 반환하지 않는다.
 * 구버전 `clearReaction`이 키를 지우지 않고 null을 써서 남긴 uid 키(#318)는
 * `== null`로만 잡힌다. 수정판을 받지 않은 앱은 계속 null을 쓰므로 이 쿼리는
 * 일회성 정리가 아니라 상시 필요하다.
 *
 * 새 인덱스는 필요 없다 — map 하위 키는 자동 단일 필드 인덱스 대상이라
 * `reactedBy.<uid>` 항목은 반응을 쓸 때 이미 색인된다(인덱스 빌드 창 없음).
 */
const removeReactionTraces = async (deps: AccountPurgeDeps, uid: string): Promise<void> => {
  const reactionKey = deps.fieldPath('reactedBy', uid);
  for (const op of ['!=', '=='] as const) {
    await runPagedWrite(
      deps.db,
      deps.db.collection('delayReports').where(reactionKey, op, null),
      (batch, ref) => batch.update(ref, reactionKey, deps.deleteFieldValue()),
    );
  }
};

/** congestionReports는 표시용 이름 없이 reporterId만 개인 식별자다. */
const anonymizeCongestionReports = ({ db }: AccountPurgeDeps, uid: string): Promise<void> =>
  runPagedWrite(
    db,
    db.collection('congestionReports').where('reporterId', '==', uid),
    (batch, ref) => batch.update(ref, { reporterId: DELETED_USER_ID }),
  );

/**
 * uid를 **필드**로 갖는 컬렉션의 문서를 일괄 삭제한다(문서 ID가 uid가 아닌 경우).
 */
const deleteQueriedDocuments =
  (collectionPath: string, ownerField: string) =>
  ({ db }: AccountPurgeDeps, uid: string): Promise<void> =>
    runPagedWrite(
      db,
      db.collection(collectionPath).where(ownerField, '==', uid),
      (batch, ref) => batch.delete(ref),
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
const deleteLegacyFavorites = deleteQueriedDocuments('favorites', 'userId');

/**
 * FCM 기기 토큰 — `tokenManagementService.ts:41`이 `fcm_tokens` 컬렉션에
 * `{token, userId, deviceId, platform, appVersion}`을 쓴다. `deviceId`는
 * 기기 식별자(PII)다. 문서 ID가 uid가 아니라 `userId` 필드로 소유를 표현한다.
 *
 * 현재 클라이언트 호출처는 0이지만 `registerFcmToken`이 실제로 배포되는
 * 살아 있는 엔드포인트라(인증만 하면 호출 가능) 데이터가 실재할 수 있다 —
 * rules default-deny로 물리적 쓰기가 불가능한 컬렉션들과 다르다.
 */
const deleteFcmTokens = deleteQueriedDocuments('fcm_tokens', 'userId');

interface PurgeStepRunner {
  readonly step: PurgeStep;
  readonly run: (deps: AccountPurgeDeps, uid: string) => Promise<unknown>;
}

/**
 * 실행 순서 고정 — 로그와 테스트 단언이 결정적이어야 하고, **부분 실패 시
 * 사용자가 남는 상태**가 순서로 결정된다.
 *
 * 순서 원칙(파괴력이 낮은 것부터):
 *   1. `delayReportComments`를 **맨 앞**에 둔다. 유일하게 외부 전제조건
 *      (collection group 인덱스)이 있는 단계라, 인덱스 미배포 같은 사고는
 *      아무것도 건드리지 않은 채 즉시 중단되어 깨끗한 재시도가 된다.
 *   2. 익명화(쓰기) → 3. 부수 문서 삭제 → 4. `users`를 **맨 뒤**에 둔다.
 *
 * `users`가 앞에 있으면 뒤 단계 하나가 실패했을 때 프로필과 즐겨찾기
 * (`preferences.favoriteStations`)가 이미 사라진 채 계정은 살아 있는
 * 최악의 상태가 된다. 익명화만 되고 중단되면 본인 게시물이 "탈퇴한
 * 사용자"로 보이는 표시상의 이상에 그친다 — 기능 데이터 파괴보다 낫다.
 */
const PURGE_STEPS: readonly PurgeStepRunner[] = [
  // 인덱스 전제조건이 있는 collection group 단계를 앞에 모아 조기 실패시킨다.
  { step: 'delayReportComments', run: anonymizeReportComments },
  { step: 'delayReportCommentLikes', run: removeCommentLikeTraces },
  { step: 'delayReports', run: anonymizeDelayReports },
  { step: 'delayReportUpvotes', run: removeUpvoteTraces },
  { step: 'delayReportReactions', run: removeReactionTraces },
  { step: 'congestionReports', run: anonymizeCongestionReports },
  { step: 'favorites', run: deleteLegacyFavorites },
  { step: 'fcmTokens', run: deleteFcmTokens },
  { step: 'pushTokens', run: recursiveDeleteOwnedTree('pushTokens') },
  {
    step: 'smartNotificationSettings',
    run: recursiveDeleteOwnedTree('smartNotificationSettings'),
  },
  { step: 'commuteLogs', run: recursiveDeleteOwnedTree('commuteLogs') },
  { step: 'commutePatterns', run: recursiveDeleteOwnedTree('commutePatterns') },
  { step: 'commuteSettings', run: recursiveDeleteOwnedTree('commuteSettings') },
  { step: 'users', run: recursiveDeleteOwnedTree('users') },
];

/**
 * Firestore 개인정보를 전수 파기한다. **첫 실패에서 즉시 중단한다(fail-fast).**
 *
 * 계속 진행하면 PURGE_STEPS의 순서 설계가 통째로 무의미해진다: 인덱스 빌드
 * 창처럼 앞 단계가 영구 실패하는 상황에서 뒤 단계가 전부 실행되면 `users`까지
 * 지워진 채 Auth 레코드는 남는다 → 본인 데이터는 영구 소실됐는데 댓글에는
 * 실제 uid·닉네임이 그대로 남고, 재시도는 매번 같은 지점에서 실패하는
 * **삭제 불가능한 계정**이 된다. 게다가 세션이 살아 있어 다음 앱 실행에서
 * users 문서가 기본값으로 재생성된다.
 *
 * 중단해도 잃는 것이 없다: 계정이 살아 있고 파기가 멱등이므로 재호출하면
 * 완료된 단계는 no-op으로 지나가고 실패 지점부터 다시 진행한다.
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
      // 단계명과 에러 코드만 남긴다. Admin SDK gRPC 오류 메시지에는 실패한
      // 문서 경로(= uid)가 포함되므로 message를 그대로 로깅하면 안 된다.
      logger.error('deleteAccount purge step failed', {
        step: runner.step,
        code: describeErrorCode(error),
      });
      break;
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
