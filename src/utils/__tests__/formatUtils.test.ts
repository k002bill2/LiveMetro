/**
 * Format Utility Functions Tests
 */

import {
  formatStationName,
  formatLineName,
  normalizeSeoulLineId,
  toSeoulApiLineName,
  formatPhoneNumber,
  formatNumber,
  truncateText,
  capitalize,
  formatFileSize,
} from '../formatUtils';

describe('formatUtils', () => {
  describe('formatStationName', () => {
    it('should remove "역" suffix from station name', () => {
      expect(formatStationName('강남역')).toBe('강남');
      expect(formatStationName('홍대입구역')).toBe('홍대입구');
    });

    it('should return unchanged if no "역" suffix', () => {
      expect(formatStationName('강남')).toBe('강남');
      expect(formatStationName('서울')).toBe('서울');
    });

    it('should handle empty string', () => {
      expect(formatStationName('')).toBe('');
    });
  });

  describe('formatLineName', () => {
    it('should format numeric line IDs', () => {
      expect(formatLineName('1')).toBe('1호선');
      expect(formatLineName('2')).toBe('2호선');
      expect(formatLineName('9')).toBe('9호선');
    });

    it('should format line IDs with prefix', () => {
      expect(formatLineName('line2')).toBe('2호선');
      expect(formatLineName('1002')).toBe('1002호선');
    });

    it('should format special lines', () => {
      expect(formatLineName('gyeongui')).toBe('경의중앙선');
      expect(formatLineName('bundang')).toBe('분당선');
      expect(formatLineName('sinbundang')).toBe('신분당선');
      expect(formatLineName('airport')).toBe('공항철도');
    });

    it('should handle case insensitivity for special lines', () => {
      expect(formatLineName('GYEONGUI')).toBe('경의중앙선');
      expect(formatLineName('Bundang')).toBe('분당선');
    });

    it('should return original if unknown', () => {
      expect(formatLineName('unknown')).toBe('unknown');
    });
  });

  describe('normalizeSeoulLineId', () => {
    it('normalizes Seoul realtime subwayId values for numeric lines', () => {
      expect(normalizeSeoulLineId('1001')).toBe('1');
      expect(normalizeSeoulLineId('1005')).toBe('5');
      expect(normalizeSeoulLineId('1009')).toBe('9');
    });

    it('normalizes Seoul realtime subwayId values for supported non-numeric lines', () => {
      expect(normalizeSeoulLineId('1063')).toBe('경의선');
      expect(normalizeSeoulLineId('1065')).toBe('공항철도');
      expect(normalizeSeoulLineId('1067')).toBe('경춘선');
      expect(normalizeSeoulLineId('1075')).toBe('수인분당선');
      expect(normalizeSeoulLineId('1077')).toBe('신분당선');
      expect(normalizeSeoulLineId('1081')).toBe('경강선');
      expect(normalizeSeoulLineId('1092')).toBe('우이신설경전철');
      expect(normalizeSeoulLineId('1093')).toBe('서해선');
      expect(normalizeSeoulLineId('1094')).toBe('신림선');
    });

    it('normalizes legacy numeric display forms', () => {
      expect(normalizeSeoulLineId('line-7')).toBe('7');
      expect(normalizeSeoulLineId('09호선')).toBe('9');
      expect(normalizeSeoulLineId(' 5 ')).toBe('5');
    });

    it('normalizes app line slugs to canonical display line ids', () => {
      expect(normalizeSeoulLineId('airport')).toBe('공항철도');
      expect(normalizeSeoulLineId('gyeongui')).toBe('경의선');
      expect(normalizeSeoulLineId('경의중앙')).toBe('경의선');
      expect(normalizeSeoulLineId('bundang')).toBe('수인분당선');
      expect(normalizeSeoulLineId('수인분당')).toBe('수인분당선');
      expect(normalizeSeoulLineId('sinbundang')).toBe('신분당선');
      expect(normalizeSeoulLineId('신분당')).toBe('신분당선');
      expect(normalizeSeoulLineId('seohaeline')).toBe('서해선');
      expect(normalizeSeoulLineId('wooyisinseol')).toBe('우이신설경전철');
      expect(normalizeSeoulLineId('gimpo')).toBe('김포도시철도');
      expect(normalizeSeoulLineId('김포골드')).toBe('김포도시철도');
      expect(normalizeSeoulLineId('김포골드라인')).toBe('김포도시철도');
      expect(normalizeSeoulLineId('에버라인')).toBe('용인경전철');
      expect(normalizeSeoulLineId('incheon1')).toBe('인천선');
      expect(normalizeSeoulLineId('인천1호선')).toBe('인천선');
      expect(normalizeSeoulLineId('gtx_a')).toBe('GTX-A');
      expect(normalizeSeoulLineId('gtx-a')).toBe('GTX-A');
    });

    it('does not extract digits from non-Seoul numeric-line names', () => {
      expect(normalizeSeoulLineId('인천2')).toBe('인천2');
      expect(normalizeSeoulLineId('인천2호선')).toBe('인천2');
      expect(normalizeSeoulLineId('김포도시철도')).toBe('김포도시철도');
    });
  });

  describe('toSeoulApiLineName', () => {
    it('maps numeric line ids 1-9 to N호선', () => {
      expect(toSeoulApiLineName('1')).toBe('1호선');
      expect(toSeoulApiLineName('2')).toBe('2호선');
      expect(toSeoulApiLineName('3')).toBe('3호선');
      expect(toSeoulApiLineName('4')).toBe('4호선');
      expect(toSeoulApiLineName('5')).toBe('5호선');
      expect(toSeoulApiLineName('6')).toBe('6호선');
      expect(toSeoulApiLineName('7')).toBe('7호선');
      expect(toSeoulApiLineName('8')).toBe('8호선');
      expect(toSeoulApiLineName('9')).toBe('9호선');
    });

    it('maps 경의선 to the official API name 경의중앙선 (regression: INFO-200 empty screen)', () => {
      expect(toSeoulApiLineName('경의선')).toBe('경의중앙선');
    });

    it('maps 우이신설경전철 to the official API name 우이신설선', () => {
      expect(toSeoulApiLineName('우이신설경전철')).toBe('우이신설선');
    });

    it('passes through line ids that already match the API name', () => {
      expect(toSeoulApiLineName('공항철도')).toBe('공항철도');
      expect(toSeoulApiLineName('경춘선')).toBe('경춘선');
      expect(toSeoulApiLineName('수인분당선')).toBe('수인분당선');
      expect(toSeoulApiLineName('신분당선')).toBe('신분당선');
      expect(toSeoulApiLineName('경강선')).toBe('경강선');
      expect(toSeoulApiLineName('서해선')).toBe('서해선');
      expect(toSeoulApiLineName('신림선')).toBe('신림선');
      expect(toSeoulApiLineName('GTX-A')).toBe('GTX-A');
    });

    it('returns null for lines the Seoul realtimePosition API does not provide', () => {
      expect(toSeoulApiLineName('김포도시철도')).toBeNull();
      expect(toSeoulApiLineName('용인경전철')).toBeNull();
      expect(toSeoulApiLineName('의정부경전철')).toBeNull();
      expect(toSeoulApiLineName('인천선')).toBeNull();
    });

    it('returns null for 인천2 instead of extracting digits into 2호선 (regression: Seoul Line 2 trains shown as Incheon Line 2)', () => {
      expect(toSeoulApiLineName('인천2')).toBeNull();
      expect(toSeoulApiLineName('인천2')).not.toBe('2호선');
    });

    it('falls back to the legacy slug mapping for english slugs', () => {
      expect(toSeoulApiLineName('gyeongui')).toBe('경의중앙선');
      expect(toSeoulApiLineName('airport')).toBe('공항철도');
    });

    it('trims surrounding whitespace before lookup', () => {
      expect(toSeoulApiLineName(' 경의선 ')).toBe('경의중앙선');
    });

    it('returns unknown ids unchanged (current INFO-200-safe behavior)', () => {
      expect(toSeoulApiLineName('미지의노선')).toBe('미지의노선');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format 11-digit phone numbers', () => {
      expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678');
    });

    it('should format 10-digit phone numbers', () => {
      expect(formatPhoneNumber('0212345678')).toBe('021-234-5678');
    });

    it('should handle phone numbers with existing formatting', () => {
      expect(formatPhoneNumber('010-1234-5678')).toBe('010-1234-5678');
    });

    it('should return original if invalid length', () => {
      expect(formatPhoneNumber('12345')).toBe('12345');
      expect(formatPhoneNumber('123456789012')).toBe('123456789012');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with Korean locale', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1000)).toBe('-1,000');
    });

    it('should handle decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text with ellipsis', () => {
      expect(truncateText('This is a long text', 10)).toBe('This is...');
    });

    it('should return unchanged if text is shorter than maxLength', () => {
      expect(truncateText('Short', 10)).toBe('Short');
    });

    it('should return unchanged if text equals maxLength', () => {
      expect(truncateText('1234567890', 10)).toBe('1234567890');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter and lowercase rest', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
      expect(capitalize('hElLo')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
      expect(capitalize('A')).toBe('A');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });
  });
});
