/**
 * Feedback Service
 *
 * 앱 레벨 사용자 의견 Firestore 영속화. 별점·카테고리·태그·상세를
 * `feedback` collection에 저장하고 admin 대시보드에서 검토.
 */

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import { FeedbackInput, FeedbackDoc } from '@/models/feedback';

const COLLECTION_NAME = 'feedback';

interface SubmitFeedbackContext {
  userId: string | null;
  userEmail: string | null;
}

class FeedbackService {
  /**
   * Persist user feedback. Returns the new document ID on success.
   * Throws on Firestore failure — callers should catch and surface
   * a friendly message per `error-handling.md`.
   */
  async submitFeedback(input: FeedbackInput, ctx: SubmitFeedbackContext): Promise<string> {
    const now = new Date();

    const docData: Omit<FeedbackDoc, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      rating: input.rating,
      category: input.category,
      tags: input.tags,
      description: input.description.trim(),
      includeDiagnostics: input.includeDiagnostics,
      diagnostics: input.includeDiagnostics ? input.diagnostics : undefined,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      status: 'pending',
      createdAt: Timestamp.fromDate(now),
    };

    const ref = await addDoc(collection(db, COLLECTION_NAME), docData);
    return ref.id;
  }
}

export const feedbackService = new FeedbackService();
