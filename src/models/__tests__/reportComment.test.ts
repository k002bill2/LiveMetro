import {
  anonymizeDisplayName,
  CommentSortLabels,
} from '../reportComment';

describe('reportComment model helpers', () => {
  describe('anonymizeDisplayName', () => {
    it('returns first char + ** for normal name', () => {
      expect(anonymizeDisplayName('김철수')).toBe('김**');
      expect(anonymizeDisplayName('이영희')).toBe('이**');
    });

    it('handles single-char name', () => {
      expect(anonymizeDisplayName('Z')).toBe('Z**');
    });

    it('falls back to 익** for empty / null / undefined', () => {
      expect(anonymizeDisplayName('')).toBe('익**');
      expect(anonymizeDisplayName(null)).toBe('익**');
      expect(anonymizeDisplayName(undefined)).toBe('익**');
    });
  });

  describe('CommentSortLabels', () => {
    it('exposes Korean labels for both modes', () => {
      expect(CommentSortLabels.newest).toBe('최신순');
      expect(CommentSortLabels.popular).toBe('인기순');
    });
  });
});
