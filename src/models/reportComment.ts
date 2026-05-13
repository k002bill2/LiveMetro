/**
 * Report Comment Models
 *
 * 시안 #5 제보 피드백 화면의 댓글. `delayReports/{reportId}/comments`
 * subcollection으로 저장 — 무한 확장 가능, parent doc과 분리 read.
 */

export interface ReportComment {
  /** Firestore doc id. */
  id: string;
  /** Parent report id. */
  reportId: string;
  /** Comment author. */
  userId: string;
  /** Display name (anonymized form, e.g. "이**"). */
  userDisplayName: string;
  /** Optional badge — e.g. "교대" (favorite station), "복구 확인" (verified). */
  badge?: string;
  /** Comment text body. */
  text: string;
  /** Created timestamp. */
  createdAt: Date;
  /** Like count (denormalized). */
  likes: number;
  /** Per-user like map. */
  likedBy: string[];
  /** Number of replies (denormalized). */
  replyCount: number;
}

export interface CreateCommentInput {
  reportId: string;
  userId: string;
  userDisplayName: string;
  badge?: string;
  text: string;
}

/**
 * Sort options for the feedback comment list — 시안에 "최신순"/"인기순" 토글.
 */
export type CommentSortMode = 'newest' | 'popular';

export const CommentSortLabels: Record<CommentSortMode, string> = {
  newest: '최신순',
  popular: '인기순',
};

/**
 * Anonymize a display name to design-handoff form ("김**", "이**").
 * Preserves first character + 2 asterisks. Empty → "익**".
 */
export const anonymizeDisplayName = (name: string | undefined | null): string => {
  if (!name || name.length === 0) return '익**';
  return `${name[0]}**`;
};
