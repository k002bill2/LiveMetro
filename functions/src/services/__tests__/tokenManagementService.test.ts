/**
 * tokenManagementService 토큰 무효화 테스트 (보안 finding F-10, IDOR).
 *
 * 서비스 싱글턴이 import 시점에 `admin.firestore()`를 잡으므로 firebase-admin을
 * in-memory fake로 대체한다. fake는 `where()` 절을 기록하고(필터 제거 회귀
 * 검출용), 옵션으로 userId 필터를 무시해 방어적 skip 경로도 독립 검증한다.
 *
 * 커버 대상:
 *   - invalidateToken(token, userId): 쿼리에 userId 필터, 타 사용자 문서·
 *     users/{other}.fcmTokens 불변
 *   - 쿼리가 타인 문서를 돌려줘도(방어 심층) 건드리지 않음
 *   - handleFailedTokens: 서버 정리 경로는 소유자 무관하게 무효화
 */

type DocData = Record<string, unknown>;
type WhereClause = readonly [string, string, unknown];

interface ArrayRemoveSentinel {
  readonly __arrayRemove: readonly unknown[];
}

interface FakeDocRef {
  readonly path: string;
}

interface FakeState {
  docs: Map<string, DocData>;
  whereLog: WhereClause[][];
  ignoreUserIdFilter: boolean;
}

const mockState: FakeState = {
  docs: new Map(),
  whereLog: [],
  ignoreUserIdFilter: false,
};

const isArrayRemove = (value: unknown): value is ArrayRemoveSentinel =>
  typeof value === 'object' && value !== null && '__arrayRemove' in value;

const applyUpdate = (current: DocData, patch: DocData): DocData =>
  Object.entries(patch).reduce<DocData>((acc, [key, value]) => {
    if (isArrayRemove(value)) {
      const existing = Array.isArray(acc[key]) ? (acc[key] as unknown[]) : [];
      return { ...acc, [key]: existing.filter((item) => !value.__arrayRemove.includes(item)) };
    }
    return { ...acc, [key]: value };
  }, current);

const mockMakeFirestore = (): unknown => {
  const makeQuery = (collection: string, clauses: WhereClause[]): unknown => ({
    where: (field: string, op: string, value: unknown) =>
      makeQuery(collection, [...clauses, [field, op, value]]),
    limit: () => makeQuery(collection, clauses),
    get: async () => {
      mockState.whereLog.push(clauses);
      const docs = [...mockState.docs.entries()]
        .filter(([path]) => path.startsWith(`${collection}/`))
        .filter(([, data]) =>
          clauses.every(([field, op, value]) => {
            if (op !== '==') throw new Error(`unsupported op ${op}`);
            if (field === 'userId' && mockState.ignoreUserIdFilter) return true;
            return data[field] === value;
          })
        )
        .map(([path, data]) => ({
          ref: { path } as FakeDocRef,
          data: () => data,
        }));
      return { empty: docs.length === 0, docs, size: docs.length };
    },
  });

  return {
    collection: (name: string) => ({
      ...(makeQuery(name, []) as object),
      doc: (id: string): FakeDocRef => ({ path: `${name}/${id}` }),
    }),
    batch: () => {
      const ops: { ref: FakeDocRef; patch: DocData }[] = [];
      return {
        update: (ref: FakeDocRef, patch: DocData) => {
          ops.push({ ref, patch });
        },
        commit: async () => {
          for (const { ref, patch } of ops) {
            const current = mockState.docs.get(ref.path);
            if (!current) throw new Error(`NOT_FOUND ${ref.path}`);
            mockState.docs.set(ref.path, applyUpdate(current, patch));
          }
        },
      };
    },
  };
};

jest.mock('firebase-admin', () => {
  const firestore = Object.assign(() => mockMakeFirestore(), {
    FieldValue: {
      arrayRemove: (...values: unknown[]) => ({ __arrayRemove: values }),
      arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
      serverTimestamp: () => ({ __serverTimestamp: true }),
    },
    Timestamp: { fromDate: (date: Date) => ({ __ts: date.getTime() }) },
  });
  return { firestore };
});

import { tokenManagementService } from '../tokenManagementService';

const CALLER = 'uid-caller';
const VICTIM = 'uid-victim';
const SHARED_TOKEN = 'fcm-token-shared';

const seed = (): void => {
  mockState.docs = new Map<string, DocData>([
    ['fcm_tokens/caller-doc', { token: SHARED_TOKEN, userId: CALLER, deviceId: 'd1', isValid: true }],
    ['fcm_tokens/victim-doc', { token: SHARED_TOKEN, userId: VICTIM, deviceId: 'd2', isValid: true }],
    ['fcm_tokens/victim-other', { token: 'victim-only', userId: VICTIM, deviceId: 'd3', isValid: true }],
    ['users/uid-caller', { fcmTokens: [SHARED_TOKEN] }],
    ['users/uid-victim', { fcmTokens: [SHARED_TOKEN, 'victim-only'] }],
  ]);
  mockState.whereLog = [];
  mockState.ignoreUserIdFilter = false;
};

beforeEach(seed);

describe('invalidateToken (owner-scoped)', () => {
  it('queries fcm_tokens with both the token and the owner userId filter', async () => {
    await tokenManagementService.invalidateToken(SHARED_TOKEN, CALLER);

    expect(mockState.whereLog).toHaveLength(1);
    expect(mockState.whereLog[0]).toEqual(
      expect.arrayContaining([
        ['token', '==', SHARED_TOKEN],
        ['userId', '==', CALLER],
      ])
    );
  });

  it("invalidates the caller's doc and leaves another user's doc untouched", async () => {
    await tokenManagementService.invalidateToken(SHARED_TOKEN, CALLER);

    expect(mockState.docs.get('fcm_tokens/caller-doc')).toMatchObject({ isValid: false });
    expect(mockState.docs.get('users/uid-caller')).toEqual({ fcmTokens: [] });

    expect(mockState.docs.get('fcm_tokens/victim-doc')).toMatchObject({ isValid: true });
    expect(mockState.docs.get('users/uid-victim')).toEqual({
      fcmTokens: [SHARED_TOKEN, 'victim-only'],
    });
  });

  it("cannot invalidate a token owned only by another user (IDOR)", async () => {
    await tokenManagementService.invalidateToken('victim-only', CALLER);

    expect(mockState.docs.get('fcm_tokens/victim-other')).toMatchObject({ isValid: true });
    expect(mockState.docs.get('users/uid-victim')).toEqual({
      fcmTokens: [SHARED_TOKEN, 'victim-only'],
    });
  });

  it('defensively skips docs owned by someone else even if the query returns them', async () => {
    mockState.ignoreUserIdFilter = true;

    await tokenManagementService.invalidateToken(SHARED_TOKEN, CALLER);

    expect(mockState.docs.get('fcm_tokens/caller-doc')).toMatchObject({ isValid: false });
    expect(mockState.docs.get('fcm_tokens/victim-doc')).toMatchObject({ isValid: true });
    expect(mockState.docs.get('users/uid-victim')).toEqual({
      fcmTokens: [SHARED_TOKEN, 'victim-only'],
    });
  });

  it('resolves quietly when nothing matches', async () => {
    await expect(
      tokenManagementService.invalidateToken('no-such-token', CALLER)
    ).resolves.toBeUndefined();
    expect(mockState.docs.get('fcm_tokens/victim-other')).toMatchObject({ isValid: true });
  });
});

describe('handleFailedTokens (server-side FCM cleanup)', () => {
  it('invalidates every doc for a dead token regardless of owner', async () => {
    await tokenManagementService.handleFailedTokens([SHARED_TOKEN]);

    expect(mockState.whereLog).toHaveLength(1);
    expect(mockState.whereLog[0]).toEqual([['token', '==', SHARED_TOKEN]]);

    expect(mockState.docs.get('fcm_tokens/caller-doc')).toMatchObject({ isValid: false });
    expect(mockState.docs.get('fcm_tokens/victim-doc')).toMatchObject({ isValid: false });
    expect(mockState.docs.get('users/uid-caller')).toEqual({ fcmTokens: [] });
    expect(mockState.docs.get('users/uid-victim')).toEqual({ fcmTokens: ['victim-only'] });
    expect(mockState.docs.get('fcm_tokens/victim-other')).toMatchObject({ isValid: true });
  });
});
