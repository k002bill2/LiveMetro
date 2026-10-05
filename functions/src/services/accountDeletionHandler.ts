/**
 * deleteAccount callable — 핸들러 로직과 Admin SDK 어댑터.
 *
 * `index.ts`의 `onCall` 본문을 여기로 분리한 이유는 **이음매를 테스트하기
 * 위해서**다. 인증 게이트·에러 매핑·어댑터가 전부 onCall 안에 있으면 서비스
 * 테스트가 mock 뒤에서만 돌아, 어댑터가 잘못된 경로를 넘기거나
 * `arrayRemoveValue`가 센티널이 아닌 값을 반환해 **타인의 투표 배열이 통째로
 * 덮이는** 계약 파손도 전부 통과한다(이 레포에서 반복된 실패 클래스).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  deleteAccountAndData,
  AccountDeletionError,
  AccountDeletionDeps,
  AdminFieldPathLike,
} from './accountDeletionService';
import { DeleteAccountResponse } from '../types';

/** `recursiveDelete` 어댑터가 필요로 하는 최소 형태. */
export interface AdminRecursiveDeleteCapable {
  doc(path: string): unknown;
  recursiveDelete(ref: unknown): Promise<void>;
}

/** `FieldValue.arrayRemove` 센티널 팩토리의 최소 형태. */
export interface AdminFieldValueCapable {
  arrayRemove(value: string): unknown;
}

/** `FieldValue.delete` 센티널 팩토리의 최소 형태. */
export interface AdminFieldValueDeleteCapable {
  delete(): unknown;
}

/** `FieldPath` 생성자의 최소 형태. */
export type AdminFieldPathConstructor = new (...segments: string[]) => AdminFieldPathLike;

/**
 * 경로 문자열 → 실제 `DocumentReference` 재귀 삭제.
 *
 * 서비스가 구조적 DI 타입만 다루므로(실 `DocumentReference`는 13개 멤버를
 * 요구해 표현 불가) 경로를 받아 여기서 ref로 바꾼다.
 */
export const createRecursiveDeleteAdapter =
  (db: AdminRecursiveDeleteCapable) =>
  (path: string): Promise<void> =>
    db.recursiveDelete(db.doc(path));

/**
 * uid를 배열에서 원자적으로 빼는 센티널을 만든다.
 *
 * 반드시 `FieldValue.arrayRemove(value)`의 반환값이어야 한다 — 문자열을 그대로
 * 반환하면 배열 필드가 그 문자열로 **덮어써져** 타인의 투표가 전멸한다.
 */
export const createArrayRemoveAdapter =
  (fieldValue: AdminFieldValueCapable) =>
  (value: string): unknown =>
    fieldValue.arrayRemove(value);

/**
 * 호출자 **자신의** 계정만 삭제한다.
 *
 * uid는 `request.auth.uid`에서만 받는다(인자 미수용 → 권한 상승 차단).
 * 실패 응답에는 단계명·문서 본문·uid를 절대 담지 않는다 — 상세는 로그로만.
 */
export const runDeleteAccountRequest = async (
  deps: AccountDeletionDeps,
  uid: string | undefined,
): Promise<DeleteAccountResponse> => {
  if (!uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  try {
    await deleteAccountAndData(deps, uid);
    return { success: true };
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      // 단계명은 로그로만. 응답에 넣으면 내부 구조가 클라이언트에 새어나간다.
      logger.error('deleteAccount purge incomplete, auth record kept', {
        failedSteps: error.failedSteps,
      });
      throw new HttpsError(
        'internal',
        '계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
    logger.error('deleteAccount unexpected error', {
      code: (error as { code?: string })?.code ?? 'unknown',
    });
    throw new HttpsError('internal', '계정 삭제 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 세그먼트 배열 → 실제 `FieldPath`.
 *
 * uid를 키로 쓰는 map 경로는 dotted 문자열로 만들면 uid 속 문자가 경로
 * 해석을 바꿀 수 있어, 세그먼트를 그대로 생성자에 넘긴다.
 */
export const createFieldPathAdapter =
  (FieldPathCtor: AdminFieldPathConstructor) =>
  (...segments: string[]): AdminFieldPathLike =>
    new FieldPathCtor(...segments);

/**
 * 필드 키 자체를 지우는 센티널을 만든다.
 *
 * 반드시 `FieldValue.delete()`의 반환값이어야 한다 — `null`을 쓰면 키가 그대로
 * 남아 uid가 잔존한다(#318).
 */
export const createDeleteFieldAdapter =
  (fieldValue: AdminFieldValueDeleteCapable) =>
  (): unknown =>
    fieldValue.delete();
