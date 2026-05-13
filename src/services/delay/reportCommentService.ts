/**
 * Report Comment Service
 *
 * `delayReports/{reportId}/comments` subcollection CRUD. Adding a comment
 * also bumps `commentCount` on the parent report in the same write batch.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import { CreateCommentInput, ReportComment, CommentSortMode } from '@/models/reportComment';

const COLLECTION_REPORTS = 'delayReports';
const SUBCOLLECTION_COMMENTS = 'comments';

class ReportCommentService {
  /**
   * Add a new comment. Increments `commentCount` on the parent report.
   * Returns the created comment id.
   */
  async addComment(input: CreateCommentInput): Promise<string> {
    const now = new Date();
    const reportRef = doc(db, COLLECTION_REPORTS, input.reportId);
    const commentsCol = collection(reportRef, SUBCOLLECTION_COMMENTS);

    const commentRef = await addDoc(commentsCol, {
      reportId: input.reportId,
      userId: input.userId,
      userDisplayName: input.userDisplayName,
      badge: input.badge ?? null,
      text: input.text.trim(),
      createdAt: Timestamp.fromDate(now),
      likes: 0,
      likedBy: [],
      replyCount: 0,
    });

    const batch = writeBatch(db);
    batch.update(reportRef, { commentCount: increment(1) });
    await batch.commit();

    return commentRef.id;
  }

  /**
   * Fetch comments for a report — supports newest-first or popular-first.
   */
  async listComments(reportId: string, mode: CommentSortMode = 'newest', max = 50): Promise<ReportComment[]> {
    const reportRef = doc(db, COLLECTION_REPORTS, reportId);
    const commentsCol = collection(reportRef, SUBCOLLECTION_COMMENTS);

    const sortField = mode === 'popular' ? 'likes' : 'createdAt';
    const q = query(commentsCol, orderBy(sortField, 'desc'), limit(max));

    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Omit<ReportComment, 'id' | 'createdAt'> & { createdAt: Timestamp };
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt.toDate(),
      };
    });
  }

  /**
   * Toggle like on a comment. Returns the resulting liked state.
   */
  async toggleCommentLike(reportId: string, commentId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
    const reportRef = doc(db, COLLECTION_REPORTS, reportId);
    const commentRef = doc(reportRef, SUBCOLLECTION_COMMENTS, commentId);

    const batch = writeBatch(db);
    if (currentlyLiked) {
      batch.update(commentRef, { likes: increment(-1), likedBy: arrayRemove(userId) });
    } else {
      batch.update(commentRef, { likes: increment(1), likedBy: arrayUnion(userId) });
    }
    await batch.commit();
    return !currentlyLiked;
  }
}

export const reportCommentService = new ReportCommentService();
