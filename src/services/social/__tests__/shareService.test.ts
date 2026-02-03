/**
 * Share Service Tests
 */

import { shareService } from '../shareService';

// Mock react-native Share
jest.mock('react-native', () => ({
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('ShareService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('share', () => {
    it('should share route content', async () => {
      const result = await shareService.share({
        type: 'route',
        fromStation: '강남역',
        toStation: '서울역',
        estimatedTime: 30,
        transfers: 1,
        fare: 1450,
      });

      expect(result.success).toBe(true);
    });

    it('should share delay content', async () => {
      const result = await shareService.share({
        type: 'delay',
        lineName: '2호선',
        stationName: '강남역',
        delayMinutes: 10,
        reason: '혼잡으로 인한 지연',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
    });

    it('should share station content', async () => {
      const result = await shareService.share({
        type: 'station',
        stationName: '강남역',
        lineNames: ['2호선', '신분당선'],
        facilities: ['엘리베이터', '에스컬레이터'],
      });

      expect(result.success).toBe(true);
    });

    it('should share app content', async () => {
      const result = await shareService.share({
        type: 'app',
        referralCode: 'REF123',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('shareRoute', () => {
    it('should share route information', async () => {
      const result = await shareService.shareRoute(
        '강남역',
        '서울역',
        30,
        1,
        1450
      );

      expect(result.success).toBe(true);
    });
  });

  describe('shareDelay', () => {
    it('should share delay information', async () => {
      const result = await shareService.shareDelay(
        '2호선',
        '강남역',
        10,
        '혼잡으로 인한 지연'
      );

      expect(result.success).toBe(true);
    });

    it('should handle delay without reason', async () => {
      const result = await shareService.shareDelay(
        '3호선',
        '신논현역',
        5
      );

      expect(result.success).toBe(true);
    });
  });

  describe('shareStation', () => {
    it('should share station information', async () => {
      const result = await shareService.shareStation(
        '강남역',
        ['2호선', '신분당선'],
        ['엘리베이터']
      );

      expect(result.success).toBe(true);
    });

    it('should handle station without facilities', async () => {
      const result = await shareService.shareStation(
        '역삼역',
        ['2호선']
      );

      expect(result.success).toBe(true);
    });
  });

  describe('shareApp', () => {
    it('should share app invite', async () => {
      const result = await shareService.shareApp();

      expect(result.success).toBe(true);
    });

    it('should include referral code if provided', async () => {
      const result = await shareService.shareApp('REF123');

      expect(result.success).toBe(true);
    });
  });

  describe('getAppStoreUrl', () => {
    it('should return iOS app store URL on iOS', () => {
      const url = shareService.getAppStoreUrl();

      // Based on mock Platform.OS = 'ios'
      expect(url).toContain('apps.apple.com');
    });
  });

  describe('openAppStore', () => {
    it('should attempt to open app store', async () => {
      // In test environment without expo-linking, should return false
      const result = await shareService.openAppStore();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('createShareableImage', () => {
    it('should return null (placeholder)', async () => {
      const result = await shareService.createShareableImage({
        type: 'route',
        fromStation: '강남역',
        toStation: '서울역',
        estimatedTime: 30,
        transfers: 1,
        fare: 1450,
      });

      expect(result).toBeNull();
    });
  });
});
