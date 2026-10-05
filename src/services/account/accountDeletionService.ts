/**
 * Account Deletion Service (client)
 *
 * `deleteAccount` Cloud Function을 호출해 서버 개인정보를 전수 파기한 뒤,
 * 기기에 남은 로컬 개인 데이터를 파기한다.
 *
 * 서버가 Admin SDK로 Auth 레코드까지 지우므로 클라이언트는
 * `deleteUser()`를 호출하지 않는다 — 호출 시점엔 토큰이 이미 무효다.
 * 부수 효과로 `auth/requires-recent-login` 실패 모드가 사라진다.
 *
 * error-handling 규칙대로 throw 하지 않고 결과 객체를 반환한다.
 */

import { httpsCallable, FunctionsError } from 'firebase/functions';
import { auth, functions } from '@/services/firebase/config';
import { purgeLocalUserData } from '@/services/account/localDataPurge';

interface DeleteAccountResponse {
  success: true;
}

export interface AccountDeletionResult {
  readonly success: boolean;
  /** 실패 시 사용자에게 그대로 보여줄 수 있는 친화 메시지. */
  readonly error?: string;
}

const GENERIC_ERROR = '계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 서버 `deleteAccount` 함수의 `timeoutSeconds: 300`(functions/src/index.ts)과
 * 반드시 일치시킨다. firebase/functions의 callable 기본 timeout은 70초라
 * 클라이언트가 서버보다 먼저 끊기면, 서버는 끝까지 완주해 계정을 삭제하는데
 * 클라이언트는 실패로 보고해 로컬 개인정보(purgeLocalUserData)를 건너뛰는
 * 되돌릴 수 없는 불일치가 생긴다.
 */
const CALLABLE_TIMEOUT_MS = 300000;

/** 진단 로그는 개발 빌드에서만 (error-handling: console.error는 개발 중만). */
const logFailure = (message: string, error?: unknown): void => {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.error(message, error);
};

/**
 * callable 오류 → 사용자 친화 메시지. 기술 상세·서버 내부 단계명은
 * 노출하지 않는다.
 */
const mapCallableError = (error: unknown): string => {
  const code = (error as Partial<FunctionsError>)?.code;
  switch (code) {
    case 'functions/unauthenticated':
      return '로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.';
    case 'functions/deadline-exceeded':
    case 'functions/unavailable':
      return '네트워크가 불안정합니다. 잠시 후 다시 시도해 주세요.';
    default:
      return GENERIC_ERROR;
  }
};

/**
 * 서버 계정 삭제 → 성공 시 로컬 파기.
 *
 * 서버 파기가 실패하면 로컬은 건드리지 않는다(계정이 살아 있으므로
 * 로그인 상태와 기기 데이터를 유지한 채 재시도할 수 있다).
 * 로컬 파기 실패는 이미 계정이 사라진 뒤라 치명적이지 않으므로
 * 성공으로 보고하고 로그만 남긴다.
 */
export const deleteAccountAndPurgeLocalData =
  async (): Promise<AccountDeletionResult> => {
    // 호출 **전에** 잡는다 — 서버가 계정을 지운 뒤에는 클라 auth 상태가
    // 비워질 수 있고, 그러면 다른 계정의 로컬 키까지 지우는 폴백으로 떨어진다.
    const deletedUid = auth.currentUser?.uid ?? null;
    try {
      const callable = httpsCallable<void, DeleteAccountResponse>(
        functions,
        'deleteAccount',
        { timeout: CALLABLE_TIMEOUT_MS },
      );
      await callable();
    } catch (error) {
      logFailure('deleteAccount callable failed:', error);
      return { success: false, error: mapCallableError(error) };
    }

    const purge = await purgeLocalUserData(deletedUid);
    if (purge.hadFailure) {
      logFailure('Local purge incomplete after account deletion');
    }
    return { success: true };
  };
