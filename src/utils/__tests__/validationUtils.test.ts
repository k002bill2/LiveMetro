/**
 * Validation Utils Tests
 */

import { isValidEmail, isValidPhoneNumber, isValidStationName } from '../validationUtils';

describe('validationUtils', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.kr')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
      expect(isValidEmail('missing@.com')).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should return true for valid Korean phone numbers', () => {
      expect(isValidPhoneNumber('01012345678')).toBe(true);
      expect(isValidPhoneNumber('0101234567')).toBe(true);
      expect(isValidPhoneNumber('010-1234-5678')).toBe(true);
      expect(isValidPhoneNumber('010 1234 5678')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('12345678901234')).toBe(false);
      expect(isValidPhoneNumber('abcdefghij')).toBe(false);
    });
  });

  describe('isValidStationName', () => {
    it('should return true for valid station names', () => {
      expect(isValidStationName('강남')).toBe(true);
      expect(isValidStationName('서울역')).toBe(true);
      expect(isValidStationName('신도림')).toBe(true);
      expect(isValidStationName('디지털미디어시티')).toBe(true);
    });

    it('should return false for invalid station names', () => {
      expect(isValidStationName('')).toBe(false);
      expect(isValidStationName('역')).toBe(false); // Too short (1 char)
      expect(isValidStationName('   ')).toBe(false); // Only whitespace
      // 21 characters - exceeds 20 char limit
      expect(isValidStationName('이것은정말정말정말아주아주긴역이름역역역역')).toBe(false);
    });

    it('should trim whitespace when validating', () => {
      expect(isValidStationName('  강남  ')).toBe(true);
      expect(isValidStationName('  역  ')).toBe(false); // Still too short after trim
    });
  });
});
