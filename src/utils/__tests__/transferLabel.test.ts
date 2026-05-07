import { LINE_NAMES, formatTransferBadgeLabel } from '../transferLabel';

describe('formatTransferBadgeLabel', () => {
  describe('Happy path: numeric line IDs', () => {
    it('returns "1" for "1" (호선 suffix stripped from 1호선 mapping)', () => {
      expect(formatTransferBadgeLabel('1')).toBe('1');
    });

    it('returns "9" for "9" (last numeric line)', () => {
      expect(formatTransferBadgeLabel('9')).toBe('9');
    });
  });

  describe('Happy path: Korean line IDs map to short labels per Wanted spec', () => {
    it('collapses 공항철도 to 공항 (5 chars → 2 chars)', () => {
      expect(formatTransferBadgeLabel('공항철도')).toBe('공항');
    });

    it('collapses 수인분당선 to 수인분당', () => {
      expect(formatTransferBadgeLabel('수인분당선')).toBe('수인분당');
    });

    it('collapses 우이신설경전철 to 우이신설 (longest input)', () => {
      expect(formatTransferBadgeLabel('우이신설경전철')).toBe('우이신설');
    });

    it('collapses 의정부경전철 to 의정부', () => {
      expect(formatTransferBadgeLabel('의정부경전철')).toBe('의정부');
    });

    it('collapses 김포도시철도 to 김포골드', () => {
      expect(formatTransferBadgeLabel('김포도시철도')).toBe('김포골드');
    });
  });

  describe('Edge cases', () => {
    it('preserves GTX-A as-is (already in short form)', () => {
      expect(formatTransferBadgeLabel('GTX-A')).toBe('GTX-A');
    });

    it('falls back to original lineId when not in LINE_NAMES (defense-in-depth)', () => {
      expect(formatTransferBadgeLabel('unknown-line')).toBe('unknown-line');
    });

    it('returns empty string for empty input (no 호선 to strip)', () => {
      expect(formatTransferBadgeLabel('')).toBe('');
    });

    it('strips trailing 호선 only, not internal occurrences', () => {
      expect(formatTransferBadgeLabel('호선중앙')).toBe('호선중앙');
    });
  });

  describe('LINE_NAMES coverage invariant', () => {
    it('maps all 24 supported line IDs (9 numeric + 15 named)', () => {
      expect(Object.keys(LINE_NAMES)).toHaveLength(24);
    });

    it('maps every numeric line 1-9 to "{n}호선" form', () => {
      for (let n = 1; n <= 9; n++) {
        expect(LINE_NAMES[String(n)]).toBe(`${n}호선`);
      }
    });
  });
});
