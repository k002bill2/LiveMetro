/**
 * Help Content Tests
 */

import { FAQ_DATA, FAQ_CATEGORIES, SUPPORT_EMAIL, SUPPORT_PHONE, FAQItem } from '../helpContent';

describe('helpContent', () => {
  describe('FAQ_CATEGORIES', () => {
    it('should have all categories', () => {
      expect(FAQ_CATEGORIES).toContain('알림');
      expect(FAQ_CATEGORIES).toContain('즐겨찾기');
      expect(FAQ_CATEGORIES).toContain('위치 서비스');
      expect(FAQ_CATEGORIES).toContain('계정');
      expect(FAQ_CATEGORIES).toContain('기타');
    });

    it('should have 5 categories', () => {
      expect(FAQ_CATEGORIES).toHaveLength(5);
    });
  });

  describe('FAQ_DATA', () => {
    it('should be an array of FAQ items', () => {
      expect(Array.isArray(FAQ_DATA)).toBe(true);
      expect(FAQ_DATA.length).toBeGreaterThan(0);
    });

    it('should have valid FAQ structure', () => {
      FAQ_DATA.forEach((item: FAQItem) => {
        expect(item.id).toBeDefined();
        expect(item.category).toBeDefined();
        expect(item.question).toBeDefined();
        expect(item.answer).toBeDefined();
        expect(typeof item.id).toBe('string');
        expect(typeof item.question).toBe('string');
        expect(typeof item.answer).toBe('string');
      });
    });

    it('should have unique IDs', () => {
      const ids = FAQ_DATA.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have items for each category', () => {
      FAQ_CATEGORIES.forEach(category => {
        const items = FAQ_DATA.filter(item => item.category === category);
        expect(items.length).toBeGreaterThan(0);
      });
    });

    it('should have notification FAQs', () => {
      const notificationFAQs = FAQ_DATA.filter(item => item.category === '알림');
      expect(notificationFAQs.length).toBeGreaterThanOrEqual(3);
    });

    it('should have favorites FAQs', () => {
      const favoritesFAQs = FAQ_DATA.filter(item => item.category === '즐겨찾기');
      expect(favoritesFAQs.length).toBeGreaterThanOrEqual(2);
    });

    it('should have account FAQs', () => {
      const accountFAQs = FAQ_DATA.filter(item => item.category === '계정');
      expect(accountFAQs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Support Info', () => {
    it('should have support email', () => {
      expect(SUPPORT_EMAIL).toBe('support@livemetro.app');
    });

    it('should have support phone', () => {
      expect(SUPPORT_PHONE).toBeDefined();
      expect(typeof SUPPORT_PHONE).toBe('string');
    });
  });
});
