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
    const matchesField = (
      data: DocData,
      field: string,
      op: '==' | 'array-contains',
      value: string,
    ): boolean => {
      if (op === 'array-contains') {
        const current = data[field];
        return Array.isArray(current) && current.includes(value);
      }
      return data[field] === value;
    };

    const build = (
      predicate: (path: string, data: DocData) => boolean,
      max: number | null,
    ): AdminQueryLike => ({
      where: (
        field: string,
        op: '==' | 'array-contains',
        value: string,
      ): AdminQueryLike =>
        build(
          (path, data) => predicate(path, data) && matchesField(data, field, op, value),
          max,
        ),
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
          const current = this.docs.get(path) ?? {};
          const resolved: DocData = {};
          // arrayRemove 센티널을 실제 배열 연산으로 해석한다(실 SDK 의미론 재현).
          for (const [field, value] of Object.entries(data)) {
            const sentinel = value as { __arrayRemove?: string } | null;
            if (sentinel && typeof sentinel === 'object' && '__arrayRemove' in sentinel) {
              const existing = current[field];
              resolved[field] = Array.isArray(existing)
                ? existing.filter((entry) => entry !== sentinel.__arrayRemove)
                : existing;
            } else {
              resolved[field] = value;
            }
          }
          this.docs.set(path, { ...current, ...resolved });
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
    readonly arrayRemoveValue: (value: string) => unknown;
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
      arrayRemoveValue: (value: string): unknown => ({ __arrayRemove: value }),
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
  // 남의 제보에 내가 추천을 누른 흔적 — 작성자 익명화로는 지워지지 않는다.
  db.seed('delayReports/r2', {
    userId: OTHER_UID,
    userDisplayName: '김철수',
    upvotes: 2,
    upvotedBy: [UID, OTHER_UID],
  });
  db.seed('delayReports/r1/comments/c1', {
    userId: UID,
    userDisplayName: '홍**',
    badge: '교대',
    text: '저도 겪었어요',
    likes: 3,
    likedBy: ['a', 'b', 'c'],
    replyCount: 0,
  });
  // 남의 댓글에 내가 좋아요를 누른 흔적.
  db.seed('delayReports/r2/comments/c2', {
    userId: OTHER_UID,
    text: '남의 댓글',
    likes: 2,
    likedBy: [OTHER_UID, UID],
  });
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
      // 남의 제보/댓글은 작성자 정보와 본문이 그대로다(반응 배열의 내 uid만 빠진다).
      expect(h.db.docs.get('delayReports/r2')).toMatchObject({
        userId: OTHER_UID,
        userDisplayName: '김철수',
      });
      expect(h.db.docs.get('delayReports/r2/comments/c2')).toMatchObject({
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

    // "누가 무엇에 반응했는가"는 개인 식별 데이터이고 **타인의 문서**에 남으므로
    // 작성자 익명화로는 지워지지 않는다. 반면 카운트는 커뮤니티 집계라 보존한다.
    it('남의 제보 upvotedBy에서 내 uid만 빼고 upvotes 카운트는 보존한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      const report = h.db.docs.get('delayReports/r2');
      expect(report!.upvotedBy).toEqual([OTHER_UID]);
      expect(report!.upvotes).toBe(2);
    });

    it('남의 댓글 likedBy에서 내 uid만 빼고 likes 카운트는 보존한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      const comment = h.db.docs.get('delayReports/r2/comments/c2');
      expect(comment!.likedBy).toEqual([OTHER_UID]);
      expect(comment!.likes).toBe(2);
    });

    it('내 제보의 반응 배열에 남은 타인 uid는 보존한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await deleteAccountAndData(h.deps, UID);

      // r1은 내가 쓴 제보 — upvotedBy에 내 uid는 없고 타인 것만 있다.
      expect(h.db.docs.get('delayReports/r1')!.upvotedBy).toEqual(['a', 'b']);
      expect(h.db.docs.get('delayReports/r1/comments/c1')!.likedBy).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('반응 흔적 제거는 멱등이다 (재호출 시 대상 0건)', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await purgeUserFirestoreData(h.deps, UID);
      const opsAfterFirst = h.db.ops.length;
      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps).toEqual([]);
      expect(h.db.ops.slice(opsAfterFirst).filter((op) => op.kind === 'update')).toEqual(
        [],
      );
      expect(h.db.docs.get('delayReports/r2')!.upvotedBy).toEqual([OTHER_UID]);
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

    it('앞선 단계가 실패해도 나머지 단계는 계속 수행한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      // delayReportComments는 첫 단계다(인덱스 전제조건).
      h.db.failingCollectionGroups.add('comments');

      const result = await purgeUserFirestoreData(h.deps, UID);

      // comments collection group 장애는 그 그룹을 쓰는 두 단계를 함께 무너뜨린다
      // (인덱스 미배포 시 실제로 나타나는 모양).
      expect(result.failedSteps).toEqual([
        'delayReportComments',
        'delayReportCommentLikes',
      ]);
      // 뒤따르는 단계는 정상 수행됨
      expect(h.db.docs.has(`pushTokens/${UID}`)).toBe(false);
      expect(h.db.docs.has(`users/${UID}`)).toBe(false);
      expect(h.db.docs.get('delayReports/r1')).toMatchObject({
        userId: DELETED_USER_ID,
      });
    });

    it('여러 단계가 실패하면 실행 순서대로 전부 수집한다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.db.failingPaths.add(`users/${UID}`);
      h.db.failingCollectionGroups.add('comments');

      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps).toEqual([
        'delayReportComments',
        'delayReportCommentLikes',
        'users',
      ]);
    });

    // 순서가 곧 실패 안전성이다: users에는 프로필과 즐겨찾기 배열
    // (preferences.favoriteStations)이 들어 있다. 앞에서 지워버리면 뒤 단계가
    // 실패했을 때 "계정은 살아 있는데 프로필·즐겨찾기는 소멸" 상태가 된다.
    it('users 문서 삭제는 다른 모든 파기 단계 이후에 일어난다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);

      await purgeUserFirestoreData(h.deps, UID);

      const usersIndex = h.db.ops.findIndex((op) => op.path === `users/${UID}`);
      expect(usersIndex).toBe(h.db.ops.length - 1);
    });

    // 인덱스 미배포(FAILED_PRECONDITION)는 유일한 외부 전제조건 실패다.
    // 첫 단계로 배치했으므로 실패 보고의 선두에 온다 — 운영 로그에서
    // 원인을 즉시 식별할 수 있다.
    it('collection group 인덱스 실패는 첫 번째 실패 단계로 보고된다', async () => {
      const h = makeHarness();
      seedFullDataset(h.db);
      h.db.failingCollectionGroups.add('comments');
      h.db.failingPaths.add(`pushTokens/${UID}`);

      const result = await purgeUserFirestoreData(h.deps, UID);

      expect(result.failedSteps[0]).toBe('delayReportComments');
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
