/**
 * Format Utility Functions Tests
 */

import {
  formatStationName,
  formatLineName,
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
