import {
  FeedbackCategory,
  FeedbackCategoryLabels,
  FEEDBACK_TAGS,
  isFeedbackSubmittable,
  FeedbackInput,
} from '../feedback';

describe('feedback model', () => {
  const base: FeedbackInput = {
    rating: 4,
    category: FeedbackCategory.FEATURE,
    tags: [],
    description: '',
    includeDiagnostics: false,
  };

  describe('FeedbackCategoryLabels', () => {
    it('maps every category to a Korean label', () => {
      expect(FeedbackCategoryLabels[FeedbackCategory.BUG]).toBe('버그 신고');
      expect(FeedbackCategoryLabels[FeedbackCategory.FEATURE]).toBe('기능 제안');
      expect(FeedbackCategoryLabels[FeedbackCategory.INFO_ERROR]).toBe('정보 오류');
      expect(FeedbackCategoryLabels[FeedbackCategory.OTHER]).toBe('기타 의견');
    });

    it('has a label for every enum value', () => {
      Object.values(FeedbackCategory).forEach(cat => {
        expect(FeedbackCategoryLabels[cat]).toBeTruthy();
      });
    });
  });

  describe('FEEDBACK_TAGS', () => {
    it('includes design-handoff tags in expected order', () => {
      expect(FEEDBACK_TAGS).toContain('예측이 정확해요');
      expect(FEEDBACK_TAGS).toContain('디자인이 좋아요');
      expect(FEEDBACK_TAGS).toContain('알림이 부정확');
      expect(FEEDBACK_TAGS).toContain('느려요');
      expect(FEEDBACK_TAGS).toContain('광고 많아요');
      expect(FEEDBACK_TAGS).toContain('다크모드');
    });
  });

  describe('isFeedbackSubmittable', () => {
    it('returns false when rating is 0', () => {
      expect(isFeedbackSubmittable({ ...base, rating: 0 })).toBe(false);
    });

    it('returns false when rating is negative', () => {
      expect(isFeedbackSubmittable({ ...base, rating: -1 })).toBe(false);
    });

    it('returns true when rating > 0 and category is valid', () => {
      expect(isFeedbackSubmittable({ ...base, rating: 1 })).toBe(true);
      expect(isFeedbackSubmittable({ ...base, rating: 5 })).toBe(true);
    });

    it('returns false when category is not a valid enum value', () => {
      expect(isFeedbackSubmittable({ ...base, category: 'unknown' as FeedbackCategory })).toBe(false);
    });
  });
});
