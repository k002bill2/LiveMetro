/**
 * accountDeletionService unit tests.
 *
 * 순수 로직 + DI 구조라 emulator 없이 in-memory fake로 검증한다
 * (functions/jest.config.js의 전제와 동일).
 *
 * 커버 대상: 파기 순서(Firestore 전부 → Auth), 부분 실패 시 Auth 미삭제,
 * 익명화가 본문·집계를 보존하는지, 멱등성, 타 사용자 문서 불변, 페이징.
 */

import {
  deleteAccountAndData,
  purgeUserFirestoreData,
  AccountDeletionError,
  DELETED_USER_ID,
  DELETED_USER_DISPLAY_NAME,
  AdminCollectionLike,
  AdminDocumentRefLike,
  AdminFirestoreLike,
  AdminQueryLike,
  AdminQuerySnapshotLike,
  AdminWriteBatchLike,
} from '../accountDeletionService';

const UID = 'uid-target';
const OTHER_UID = 'uid-bystander';

type DocData = Record<string, unknown>;

interface Op {
  readonly kind: 'delete' | 'update' | 'recursiveDelete' | 'deleteUser';
  readonly path: string;
}

/**
 * In-memory Firestore double.
 *
 * 문서는 전체 경로('delayReports/r1', 'delayReports/r1/comments/c1')를 키로
 * 저장한다. 컬렉션 쿼리는 경로의 세그먼트 수로, collection group 쿼리는
 * 마지막 컬렉션 세그먼트로 매칭한다 — 실제 Firestore 의미론과 같다.
 */
class FakeFirestore implements AdminFirestoreLike {
  readonly docs = new Map<string, DocData>();
  readonly ops: Op[] = [];
  /** 이 경로들에 대한 쓰기는 실패시킨다(부분 실패 시나리오). */
  failingPaths = new Set<string>();
  /** 실패시킬 collection group id. */
  failingCollectionGroups = new Set<string>();

  seed(path: string, data: DocData): void {
    this.docs.set(path, data);
  }

  /** ref → path 역참조 (batch가 받은 ref의 경로를 알아내기 위함). */
  private readonly refPath = new WeakMap<AdminDocumentRefLike, string>();

  private makeRef(path: string): AdminDocumentRefLike {
    const ref: AdminDocumentRefLike = {
      delete: async (): Promise<unknown> => {
        if (this.failingPaths.has(path)) {
          throw new Error('simulated delete failure');
        }
        this.ops.push({ kind: 'delete', path });
        this.docs.delete(path);
        return undefined;
      },
    };
    this.refPath.set(ref, path);
    return ref;
  }

  pathOf(ref: AdminDocumentRefLike): string {
    return this.refPath.get(ref) ?? '<unknown>';
  }

  private query(
    matches: (path: string, data: DocData) => boolean,
    groupId: string | null,
  ): AdminQueryLike {
    const build = (
      predicate: (path: string, data: DocData) => boolean,
      max: number | null,
    ): AdminQueryLike => ({
      where: (field: string, _op: '==', value: string): AdminQueryLike =>
        build((path, data) => predicate(path, data) && data[field] === value, max),
      limit: (count: number): AdminQueryLike => build(predicate, count),
      get: async (): Promise<AdminQuerySnapshotLike> => {
        if (groupId !== null && this.failingCollectionGroups.has(groupId)) {
          throw new Error('simulated collection group query failure');
        }
        const hits = [...this.docs.entries()].filter(([path, data]) =>
          predicate(path, data),
        );
        const page = max === null ? hits : hits.slice(0, max);
        return {
          empty: page.length === 0,
          docs: page.map(([path]) => ({ ref: this.makeRef(path) })),
        };
      },
    });
    return build(matches, null);
  }

  collection(collectionPath: string): AdminCollectionLike {
    const base = this.query(
      (path) =>
        path.startsWith(`${collectionPath}/`) &&
        path.split('/').length === collectionPath.split('/').length + 1,
      null,
    );
    return {
      ...base,
      doc: (id: string): AdminDocumentRefLike =>
        this.makeRef(`${collectionPath}/${id}`),
    };
  }

  collectionGroup(collectionId: string): AdminQueryLike {
    return this.query((path) => {
      const segments = path.split('/');
      return segments.length >= 2 && segments[segments.length - 2] === collectionId;
    }, collectionId);
  }

  batch(): AdminWriteBatchLike {
    const staged: (() => void)[] = [];
    let failed: string | null = null;
    return {
      update: (ref: AdminDocumentRefLike, data: DocData): unknown => {
        const path = this.pathOf(ref);
        if (this.failingPaths.has(path)) failed = path;
        staged.push(() => {
          this.ops.push({ kind: 'update', path });
          this.docs.set(path, { ...(this.docs.get(path) ?? {}), ...data });
        });
        return undefined;
      },
      delete: (ref: AdminDocumentRefLike): unknown => {
        const path = this.pathOf(ref);
        if (this.failingPaths.has(path)) failed = path;
        staged.push(() => {
          this.ops.push({ kind: 'delete', path });
          this.docs.delete(path);
        });
        return undefined;
      },
      commit: async (): Promise<unknown> => {
        if (failed !== null) throw new Error('simulated batch commit failure');
        staged.forEach((apply) => apply());
        return undefined;
      },
    };
  }
}

interface Harness {
  readonly db: FakeFirestore;
  readonly deletedUsers: string[];
  readonly deps: {
    readonly db: FakeFirestore;
    readonly auth: { deleteUser(uid: string): Promise<void> };
    readonly recursiveDeleteDocument: (path: string) => Promise<void>;
  };
  recursiveFailures: Set<string>;
  authError: unknown;
}

const makeHarness = (): Harness => {
  const db = new FakeFirestore();
  const deletedUsers: string[] = [];
  const harness: Harness = {
    db,
    deletedUsers,
    recursiveFailures: new Set<string>(),
    authError: null,
    deps: {
      db,
      auth: {
        deleteUser: async (uid: string): Promise<void> => {
          db.ops.push({ kind: 'deleteUser', path: uid });
          if (harness.authError !== null) throw harness.authError;
          deletedUsers.push(uid);
        },
      },
      recursiveDeleteDocument: async (path: string): Promise<void> => {
        if (harness.recursiveFailures.has(path)) {
          throw new Error('simulated recursiveDelete failure');
        }
        db.ops.push({ kind: 'recursiveDelete', path });
        // 하위 문서까지 실제로 지운다(재귀 삭제 의미론 재현).
        for (const key of [...db.docs.keys()]) {
          if (key === path || key.startsWith(`${path}/`)) db.docs.delete(key);
        }
      },
    },
  };
  return harness;
};

/** 대상 사용자의 전형적인 데이터 세트를 심는다. */
const seedFullDataset = (db: FakeFirestore): void => {
  db.seed(`users/${UID}`, { email: 'target@example.com' });
  db.seed(`users/${OTHER_UID}`, { email: 'bystander@example.com' });
  db.seed(`commuteSettings/${UID}`, { departureTime: '08:00' });
  db.seed(`commuteLogs/${UID}/logs/log1`, { startedAt: 1 });
  db.seed(`commutePatterns/${UID}/patterns/mon`, { confidence: 0.8 });
  db.seed(`smartNotificationSettings/${UID}`, { enabled: true });
  db.seed(`pushTokens/${UID}`, { token: 'ExponentPushToken[x]' });
  db.seed('favorites/f1', { userId: UID, stationId: '0222' });
  db.seed('favorites/f2', { userId: OTHER_UID, stationId: '0223' });
  db.seed('delayReports/r1', {
    userId: UID,
    userDisplayName: '홍길동',
    description: '2호선 지연 심함',
    upvotes: 7,
    upvotedBy: ['a', 'b'],
    commentCount: 1,
    timestamp: 1700000000,
  });
  db.seed('delayReports/r2', { userId: OTHER_UID, userDisplayName: '김철수' });
  db.seed('delayReports/r1/comments/c1', {
    userId: UID,
    userDisplayName: '홍**',
    badge: '교대',
    text: '저도 겪었어요',
    likes: 3,
    likedBy: ['a', 'b', 'c'],
    replyCount: 0,
  });
  db.seed('delayReports/r2/comments/c2', { userId: OTHER_UID, text: '남의 댓글' });
  db.seed('congestionReports/cr1', {
    reporterId: UID,
    congestionLevel: 'CROWDED',
    carNumber: 3,
    trainId: 't-1',
  });
  db.seed('congestionReports/cr2', { reporterId: OTHER_UID, congestionLevel: 'NORMAL' });
};

describe('accountDeletionService', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('파기 순서 (Firestore 전부 → Auth)', () => {
    it('Auth 삭제는 모든 Firestore 파기 작업 이후에 일어난다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      const authIndex = h.db.ops.findIndex((op) => op.kind === 'deleteUser');
      expect(authIndex).toBeGreaterThan(-1);
      // deleteUser 뒤에 남은 Firestore 작업이 하나도 없어야 한다.
      expect(h.db.ops.slice(authIndex + 1)).toEqual([]);
      expect(h.db.ops.slice(0, authIndex).length).toBeGreaterThan(0);
      expect(h.deletedUsers).toEqual([UID]);
    });

    it('uid 소유 문서와 하위 트리를 전부 파기한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      expect(h.db.docs.has(`users/${UID}`)).toBe(false);
      expect(h.db.docs.has(`commuteSettings/${UID}`)).toBe(false);
      expect(h.db.docs.has(`commuteLogs/${UID}/logs/log1`)).toBe(false);
      expect(h.db.docs.has(`commutePatterns/${UID}/patterns/mon`)).toBe(false);
      expect(h.db.docs.has(`smartNotificationSettings/${UID}`)).toBe(false);
      expect(h.db.docs.has(`pushTokens/${UID}`)).toBe(false);
      expect(h.db.docs.has('favorites/f1')).toBe(false);
    });

    it('서브컬렉션은 경로 기반 재귀 삭제로 처리한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      const recursivePaths = h.db.ops
        .filter((op) => op.kind === 'recursiveDelete')
        .map((op) => op.path);
      expect(recursivePaths).toEqual([`commuteLogs/${UID}`, `commutePatterns/${UID}`]);
    });

    it('다른 사용자의 문서는 건드리지 않는다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      expect(h.db.docs.get(`users/${OTHER_UID}`)).toEqual({
        email: 'bystander@example.com',
      });
      expect(h.db.docs.get('favorites/f2')).toEqual({
        userId: OTHER_UID,
        stationId: '0223',
      });
      expect(h.db.docs.get('delayReports/r2')).toEqual({
        userId: OTHER_UID,
        userDisplayName: '김철수',
      });
      expect(h.db.docs.get('delayReports/r2/comments/c2')).toEqual({
        userId: OTHER_UID,
        text: '남의 댓글',
      });
      expect(h.db.docs.get('congestionReports/cr2')).toEqual({
        reporterId: OTHER_UID,
        congestionLevel: 'NORMAL',
      });
    });
  });

  describe('익명화 (커뮤니티 제보는 보존)', () => {
    it('delayReports는 작성자 식별자만 치환하고 본문·집계를 보존한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      expect(h.db.docs.get('delayReports/r1')).toEqual({
        userId: DELETED_USER_ID,
        userDisplayName: DELETED_USER_DISPLAY_NAME,
        description: '2호선 지연 심함',
        upvotes: 7,
        upvotedBy: ['a', 'b'],
        commentCount: 1,
        timestamp: 1700000000,
      });
    });

    it('제보 댓글은 userId·닉네임·badge를 지우고 본문·좋아요를 보존한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      expect(h.db.docs.get('delayReports/r1/comments/c1')).toEqual({
        userId: DELETED_USER_ID,
        userDisplayName: DELETED_USER_DISPLAY_NAME,
        badge: null,
        text: '저도 겪었어요',
        likes: 3,
        likedBy: ['a', 'b', 'c'],
        replyCount: 0,
      });
    });

    it('congestionReports는 reporterId만 치환한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      expect(h.db.docs.get('congestionReports/cr1')).toEqual({
        reporterId: DELETED_USER_ID,
        congestionLevel: 'CROWDED',
        carNumber: 3,
        trainId: 't-1',
      });
    });
  });

  describe('부분 실패 → Auth 레코드 보존', () => {
    it('문서 삭제가 실패하면 Auth를 삭제하지 않고 실패 단계를 담아 throw 한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.db.failingPaths.add(`pushTokens/${UID}`);

      await expect(deleteAccountAndData(h.deps, UID)).rejects.toBeInstanceOf(
        AccountDeletionError,
      );
      expect(h.deletedUsers).toEqual([]);
      expect(h.db.ops.some((op) => op.kind === 'deleteUser')).toBe(false);
    });

    it('재귀 삭제 실패도 Auth 삭제를 막는다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.recursiveFailures.add(`commuteLogs/${UID}`);

      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps).toEqual(['commuteLogs']);
      await expect(deleteAccountAndData(h.deps, UID)).rejects.toBeInstanceOf(
        AccountDeletionError,
      );
      expect(h.deletedUsers).toEqual([]);
    });

    it('한 단계가 실패해도 나머지 단계는 계속 수행한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.db.failingPaths.add(`users/${UID}`);

      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps).toEqual(['users']);
      expect(h.db.docs.has(`users/${UID}`)).toBe(true);
      // 뒤따르는 단계는 정상 수행됨
      expect(h.db.docs.has(`pushTokens/${UID}`)).toBe(false);
      expect(h.db.docs.get('delayReports/r1')).toMatchObject({
        userId: DELETED_USER_ID,
      });
    });

    it('여러 단계가 실패하면 전부 수집한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.db.failingPaths.add(`users/${UID}`);
      h.db.failingCollectionGroups.add('comments');

      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps).toEqual(['users', 'delayReportComments']);
    });

    it('실패 로그에 문서 본문을 남기지 않는다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.db.failingPaths.add(`users/${UID}`);

      await purgeUserFirestoreData(h.deps, UID);

      const logged = errorSpy.mock.calls.flat().join(' ');
      expect(logged).toContain('users');
      expect(logged).not.toContain('target@example.com');
    });
  });

  describe('멱등성', () => {
    it('두 번 호출해도 안전하며 두 번째는 파기 대상이 없다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);
      const opsAfterFirst = h.db.ops.length;
      h.authError = Object.assign(new Error('no user'), {
        code: 'auth/user-not-found',
      });

      await expect(deleteAccountAndData(h.deps, UID)).resolves.toBeUndefined();

      // 2회차엔 익명화/삭제 대상이 없어 batch 쓰기가 발생하지 않는다.
      const secondRunOps = h.db.ops.slice(opsAfterFirst);
      expect(secondRunOps.filter((op) => op.kind === 'update')).toEqual([]);
      expect(h.db.docs.get('delayReports/r1')).toMatchObject({
        userId: DELETED_USER_ID,
      });
    });

    it('이미 삭제된 Auth 계정(auth/user-not-found)은 성공으로 간주한다', async () => {
      const h = makeHarness();
      h.authError = Object.assign(new Error('no user'), {
        code: 'auth/user-not-found',
      });

      await expect(deleteAccountAndData(h.deps, UID)).resolves.toBeUndefined();
    });

    it('그 외 Auth 오류는 그대로 전파한다', async () => {
      const h = makeHarness();
      h.authError = Object.assign(new Error('boom'), { code: 'auth/internal-error' });

      await expect(deleteAccountAndData(h.deps, UID)).rejects.toThrow('boom');
    });
  });

  describe('페이지네이션', () => {
    it('배치 상한(400)을 넘는 문서는 여러 배치로 나눠 처리한다', async () => {
      const h = makeHarness();
      for (let i = 0; i < 450; i += 1) {
        h.db.seed(`favorites/f${i}`, { userId: UID, stationId: `${i}` });
      }

      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps).toEqual([]);
      const favoriteDeletes = h.db.ops.filter(
        (op) => op.kind === 'delete' && op.path.startsWith('favorites/'),
      );
      expect(favoriteDeletes).toHaveLength(450);
      expect(
        [...h.db.docs.keys()].filter((key) => key.startsWith('favorites/')),
      ).toEqual([]);
    });
  });
});
