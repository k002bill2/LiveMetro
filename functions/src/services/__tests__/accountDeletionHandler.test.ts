/**
 * accountDeletionHandler seam unit tests.
 *
 * accountDeletionService.test.ts와 같은 스타일(순수 로직 + DI 구조 + 구조적
 * fake, emulator 없이 in-memory 검증)을 따른다. 여기서 검증하는 것은
 * onCall 본문이 아니라 그 안에서 분리된 seam 세 가지다:
 *   1. 인증 게이트(uid 없으면 unauthenticated)
 *   2. 에러 매핑 + 비노출(내부 파기 실패의 단계명·uid·문서 경로가 응답에 안 샌다)
 *   3. 어댑터 계약(recursiveDeleteDocument가 넘기는 경로, arrayRemoveValue가
 *      돌려주는 것이 진짜 FieldValue.arrayRemove 센티널인지)
 *
 * 파기 로직 자체(순서·페이징·부분 실패 등)는 accountDeletionService.test.ts가
 * 이미 전수 커버하므로 여기서는 empty-result 픽스처로 전 단계를 no-op
 * 성공시켜 seam만 분리해 본다.
 */

import { logger } from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  runDeleteAccountRequest,
  createRecursiveDeleteAdapter,
  createArrayRemoveAdapter,
  AdminRecursiveDeleteCapable,
  AdminFieldValueCapable,
} from '../accountDeletionHandler';
import {
  AccountDeletionDeps,
  AdminCollectionLike,
  AdminDocumentRefLike,
  AdminQueryLike,
  AdminQuerySnapshotLike,
  AdminWriteBatchLike,
} from '../accountDeletionService';

const UID = 'uid-under-test';

/** 항상 `self`를 돌려주는 체이너블 쿼리 — `get()` 구현만 시나리오별로 다르다. */
const makeQuery = (getImpl: () => Promise<AdminQuerySnapshotLike>): AdminQueryLike => {
  const self: AdminQueryLike = {
    where: () => self,
    limit: () => self,
    get: getImpl,
  };
  return self;
};

const emptyQuery = (): AdminQueryLike =>
  makeQuery(async () => ({ empty: true, docs: [] }));

interface MakeDepsOptions {
  /** 지정하면 `collectionGroup('comments')` 첫 조회(delayReportComments 단계)가 이 오류로 실패한다. */
  readonly failCommentsCollectionGroup?: Error;
}

interface DepsHarness {
  readonly deps: AccountDeletionDeps;
  readonly deletedUsers: string[];
}

/**
 * 모든 쿼리가 빈 결과를 내는 최소 Firestore 더블.
 *
 * `runPagedWrite`는 `snapshot.empty`면 `batch()`를 건드리지 않고 즉시
 * 반환하므로(accountDeletionService.ts), 이 픽스처로는 batch 구현이
 * 전혀 필요 없다 — 대신 호출되면 즉시 실패시켜 가정이 깨졌음을 드러낸다.
 */
const makeDeps = (options: MakeDepsOptions = {}): DepsHarness => {
  const deletedUsers: string[] = [];

  const collection = (): AdminCollectionLike => ({
    ...emptyQuery(),
    doc: (): AdminDocumentRefLike => ({
      delete: async (): Promise<unknown> => undefined,
    }),
  });

  const collectionGroup = (collectionId: string): AdminQueryLike => {
    if (collectionId === 'comments' && options.failCommentsCollectionGroup) {
      const failure = options.failCommentsCollectionGroup;
      return makeQuery(async () => {
        throw failure;
      });
    }
    return emptyQuery();
  };

  const batch = (): AdminWriteBatchLike => {
    throw new Error('batch() should not be called against an empty-result fixture');
  };

  const deps: AccountDeletionDeps = {
    db: { collection, collectionGroup, batch },
    auth: {
      deleteUser: async (uid: string): Promise<void> => {
        deletedUsers.push(uid);
      },
    },
    recursiveDeleteDocument: async (): Promise<void> => undefined,
    arrayRemoveValue: (value: string): unknown => ({ __arrayRemove: value }),
  };

  return { deps, deletedUsers };
};

describe('accountDeletionHandler', () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // accountDeletionService.test.ts와 동일한 이유: UNPATCHED_CONSOLE이
    // require 시점 console.error 참조를 캡처해 console.error spy로는 안
    // 잡힌다. exports 객체의 error 메서드 자체를 스파이해 stdout 노이즈를 막는다.
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  describe('인증 게이트', () => {
    it('uid가 없으면(request.auth 부재) unauthenticated로 던진다', async () => {
      const { deps } = makeDeps();

      await expect(runDeleteAccountRequest(deps, undefined)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('uid가 없으면 파기 로직을 전혀 실행하지 않는다', async () => {
      const { deps, deletedUsers } = makeDeps();

      await expect(runDeleteAccountRequest(deps, undefined)).rejects.toThrow();

      expect(deletedUsers).toEqual([]);
    });
  });

  describe('에러 매핑 + 비노출', () => {
    it('내부 파기 실패는 internal로 매핑되고 단계명·uid·문서 경로를 응답에 담지 않는다', async () => {
      // 실제 Admin SDK(gRPC) 오류 모양(문서 경로에 uid 포함)을 재현한다.
      const leakyError = Object.assign(
        new Error(
          `5 NOT_FOUND: no entity to update: projects/livemetro/databases/(default)/documents/users/${UID}`,
        ),
        { code: 5 },
      );
      const { deps, deletedUsers } = makeDeps({ failCommentsCollectionGroup: leakyError });

      let caught: unknown;
      try {
        await runDeleteAccountRequest(deps, UID);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpsError);
      const httpsError = caught as HttpsError;
      expect(httpsError.code).toBe('internal');

      const exposed = JSON.stringify({
        message: httpsError.message,
        details: httpsError.details,
      });
      expect(exposed).not.toContain(UID);
      expect(exposed).not.toContain('delayReportComments');
      expect(exposed).not.toContain('NOT_FOUND');
      expect(exposed).not.toContain('projects/livemetro');
      // 파기가 실패했으니 Auth 레코드는 살아 있어야 한다(재시도 가능).
      expect(deletedUsers).toEqual([]);
    });
  });

  describe('정상 경로', () => {
    it('인증된 요청이 성공하면 { success: true }를 반환하고 자신의 Auth 레코드만 지운다', async () => {
      const { deps, deletedUsers } = makeDeps();

      const result = await runDeleteAccountRequest(deps, UID);

      expect(result).toEqual({ success: true });
      expect(deletedUsers).toEqual([UID]);
    });
  });

  describe('createRecursiveDeleteAdapter', () => {
    it('경로 문자열로 doc()을 호출하고 그 결과를 그대로 recursiveDelete()에 넘긴다', async () => {
      const fakeRef = { marker: 'ref-for-users/uid-1' };
      const seen: { docPath?: string; deletedRef?: unknown } = {};
      const fakeDb: AdminRecursiveDeleteCapable = {
        doc: (path: string): unknown => {
          seen.docPath = path;
          return fakeRef;
        },
        recursiveDelete: async (ref: unknown): Promise<void> => {
          seen.deletedRef = ref;
        },
      };

      await createRecursiveDeleteAdapter(fakeDb)('users/uid-1');

      expect(seen.docPath).toBe('users/uid-1');
      // doc()이 반환한 바로 그 참조가 recursiveDelete로 전달돼야 한다 —
      // 경로 문자열을 다시 감싸거나 다른 값으로 바뀌면 실제 SDK에서 잘못된
      // 문서를 지우거나 타입 에러가 난다.
      expect(seen.deletedRef).toBe(fakeRef);
    });
  });

  describe('createArrayRemoveAdapter', () => {
    it('FieldValue.arrayRemove()의 반환값을 그대로 돌려준다(문자열로 대체하지 않는다)', () => {
      // 문자열을 그대로 반환하면 배열 필드가 그 문자열로 덮어써져 타인의
      // 투표가 전멸한다(accountDeletionHandler.ts의 계약 주석 참조) — 그래서
      // 센티널이 진짜 arrayRemove()의 반환 객체인지(참조 동일성) 단언한다.
      const sentinel = Symbol('arrayRemove-sentinel');
      const fakeFieldValue: AdminFieldValueCapable = {
        arrayRemove: (value: string): unknown => {
          expect(value).toBe('uid-1');
          return sentinel;
        },
      };

      const result = createArrayRemoveAdapter(fakeFieldValue)('uid-1');

      expect(result).toBe(sentinel);
      expect(result).not.toBe('uid-1');
    });
  });
});
