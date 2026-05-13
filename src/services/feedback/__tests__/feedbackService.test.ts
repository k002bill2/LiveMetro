import { feedbackService } from '../feedbackService';
import { FeedbackCategory, FeedbackInput } from '@/models/feedback';

const mockAddDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ name })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date, __ts: true })),
  },
}));

jest.mock('@/services/firebase/config', () => ({
  firestore: { __mock: true },
}));

describe('feedbackService', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockAddDoc.mockResolvedValue({ id: 'feedback-123' });
  });

  const baseInput: FeedbackInput = {
    rating: 4,
    category: FeedbackCategory.FEATURE,
    tags: ['디자인이 좋아요'],
    description: '  좋은 앱이에요  ',
    includeDiagnostics: false,
  };

  const baseCtx = { userId: 'u-1', userEmail: 'u@example.com' };

  it('persists feedback to the feedback collection and returns id', async () => {
    const id = await feedbackService.submitFeedback(baseInput, baseCtx);

    expect(id).toBe('feedback-123');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [collectionRef, payload] = mockAddDoc.mock.calls[0]!;
    expect(collectionRef).toEqual({ name: 'feedback' });
    expect(payload).toMatchObject({
      rating: 4,
      category: FeedbackCategory.FEATURE,
      tags: ['디자인이 좋아요'],
      userId: 'u-1',
      userEmail: 'u@example.com',
      status: 'pending',
    });
  });

  it('trims description whitespace', async () => {
    await feedbackService.submitFeedback(baseInput, baseCtx);
    const payload = mockAddDoc.mock.calls[0]![1];
    expect(payload.description).toBe('좋은 앱이에요');
  });

  it('omits diagnostics when includeDiagnostics is false', async () => {
    await feedbackService.submitFeedback(
      { ...baseInput, includeDiagnostics: false, diagnostics: { appVersion: '1', platform: 'ios', osVersion: '18' } },
      baseCtx,
    );
    const payload = mockAddDoc.mock.calls[0]![1];
    expect(payload.diagnostics).toBeUndefined();
  });

  it('includes diagnostics when includeDiagnostics is true', async () => {
    const diagnostics = { appVersion: '1.0.0', platform: 'ios' as const, osVersion: '18.2' };
    await feedbackService.submitFeedback(
      { ...baseInput, includeDiagnostics: true, diagnostics },
      baseCtx,
    );
    const payload = mockAddDoc.mock.calls[0]![1];
    expect(payload.diagnostics).toEqual(diagnostics);
  });

  it('persists null user fields for anonymous users', async () => {
    await feedbackService.submitFeedback(baseInput, { userId: null, userEmail: null });
    const payload = mockAddDoc.mock.calls[0]![1];
    expect(payload.userId).toBeNull();
    expect(payload.userEmail).toBeNull();
  });

  it('propagates Firestore errors to the caller', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('network down'));
    await expect(feedbackService.submitFeedback(baseInput, baseCtx)).rejects.toThrow('network down');
  });
});
