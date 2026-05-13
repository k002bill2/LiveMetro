import { reportCommentService } from '../reportCommentService';

const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockIncrement = jest.fn((n: number) => ({ __inc: n }));
const mockArrayUnion = jest.fn((v: unknown) => ({ __union: v }));
const mockArrayRemove = jest.fn((v: unknown) => ({ __remove: v }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((parent, name) => ({ parent, name })),
  doc: jest.fn((...args: unknown[]) => ({ __doc: args })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => ({ __query: args }),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  limit: jest.fn((n: number) => ({ limit: n })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
  },
  writeBatch: jest.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
  increment: (n: number) => mockIncrement(n),
  arrayUnion: (v: unknown) => mockArrayUnion(v),
  arrayRemove: (v: unknown) => mockArrayRemove(v),
}));

jest.mock('@/services/firebase/config', () => ({
  firestore: { __mock: true },
}));

describe('reportCommentService', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
    mockBatchUpdate.mockReset();
    mockBatchCommit.mockReset();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe('addComment', () => {
    it('writes comment with trimmed text and increments parent commentCount', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'c-1' });

      const id = await reportCommentService.addComment({
        reportId: 'r-1',
        userId: 'u-1',
        userDisplayName: '이**',
        text: '  hello  ',
      });

      expect(id).toBe('c-1');
      const [, payload] = mockAddDoc.mock.calls[0]!;
      expect(payload).toMatchObject({
        reportId: 'r-1',
        userId: 'u-1',
        userDisplayName: '이**',
        text: 'hello',
        likes: 0,
        likedBy: [],
        replyCount: 0,
        badge: null,
      });
      expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), { commentCount: { __inc: 1 } });
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('persists badge when provided', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'c-2' });
      await reportCommentService.addComment({
        reportId: 'r-1',
        userId: 'u-2',
        userDisplayName: '최**',
        text: '복구 됐어요',
        badge: '복구 확인',
      });
      const [, payload] = mockAddDoc.mock.calls[0]!;
      expect(payload.badge).toBe('복구 확인');
    });
  });

  describe('toggleCommentLike', () => {
    it('increments likes and unions user when not currently liked', async () => {
      await reportCommentService.toggleCommentLike('r-1', 'c-1', 'u-1', false);
      expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), {
        likes: { __inc: 1 },
        likedBy: { __union: 'u-1' },
      });
    });

    it('decrements likes and removes user when currently liked', async () => {
      await reportCommentService.toggleCommentLike('r-1', 'c-1', 'u-1', true);
      expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), {
        likes: { __inc: -1 },
        likedBy: { __remove: 'u-1' },
      });
    });

    it('returns toggled state', async () => {
      expect(await reportCommentService.toggleCommentLike('r-1', 'c-1', 'u-1', false)).toBe(true);
      expect(await reportCommentService.toggleCommentLike('r-1', 'c-1', 'u-1', true)).toBe(false);
    });
  });

  describe('listComments', () => {
    it('returns sorted by createdAt desc by default', async () => {
      const now = new Date('2026-05-14T00:00:00Z');
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'c-1',
            data: () => ({
              reportId: 'r-1',
              userId: 'u-1',
              userDisplayName: '김**',
              text: 'hi',
              createdAt: { toDate: () => now },
              likes: 0,
              likedBy: [],
              replyCount: 0,
            }),
          },
        ],
      });

      const list = await reportCommentService.listComments('r-1');
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: 'c-1', text: 'hi', createdAt: now });
    });
  });
});
