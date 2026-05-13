/**
 * Feedback Models
 *
 * 앱 레벨 사용자 의견(별점·카테고리·상세). 지연 제보(`delayReport.ts`)와는
 * 별개 도메인 — 앱 자체에 대한 피드백.
 */

/**
 * Feedback category — 시안 #3의 4개 grid.
 */
export enum FeedbackCategory {
  BUG = 'bug',
  FEATURE = 'feature',
  INFO_ERROR = 'info_error',
  OTHER = 'other',
}

export const FeedbackCategoryLabels: Record<FeedbackCategory, string> = {
  [FeedbackCategory.BUG]: '버그 신고',
  [FeedbackCategory.FEATURE]: '기능 제안',
  [FeedbackCategory.INFO_ERROR]: '정보 오류',
  [FeedbackCategory.OTHER]: '기타 의견',
};

export const FeedbackCategoryDescriptions: Record<FeedbackCategory, string> = {
  [FeedbackCategory.BUG]: '오작동·오류',
  [FeedbackCategory.FEATURE]: '있었으면 하는 기능',
  [FeedbackCategory.INFO_ERROR]: '잘못된 시간·역 정보',
  [FeedbackCategory.OTHER]: '문의·칭찬',
};

/**
 * Positive tags ("어떤 점이 좋았/아쉬웠나요?") — 시안의 multi-select chip 행.
 */
export const FEEDBACK_TAGS = [
  '예측이 정확해요',
  '디자인이 좋아요',
  '알림이 부정확',
  '느려요',
  '광고 많아요',
  '다크모드',
] as const;

export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

/**
 * Diagnostic context attached when user opts in.
 */
export interface FeedbackDiagnostics {
  appVersion: string;
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
}

/**
 * Input from the form.
 */
export interface FeedbackInput {
  /** Star rating 1-5 (0 = unset). */
  rating: number;
  /** Required category selection. */
  category: FeedbackCategory;
  /** Optional positive/negative tags. */
  tags: FeedbackTag[];
  /** Free-form detail (max 500 chars per spec). */
  description: string;
  /** When true, diagnostics field is set. */
  includeDiagnostics: boolean;
  /** Diagnostics snapshot (present only when includeDiagnostics=true). */
  diagnostics?: FeedbackDiagnostics;
}

/**
 * Persisted feedback document shape.
 */
export interface FeedbackDoc extends FeedbackInput {
  id: string;
  userId: string | null;
  userEmail: string | null;
  createdAt: Date;
  status: 'pending' | 'reviewing' | 'resolved' | 'archived';
}

/**
 * Validation: required fields are rating > 0 AND a category.
 */
export const isFeedbackSubmittable = (input: FeedbackInput): boolean => {
  return input.rating > 0 && Object.values(FeedbackCategory).includes(input.category);
};
