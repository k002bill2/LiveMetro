/**
 * expoPushService Tests
 */
// expoPushService loads the (ESM-only) Expo class through expoSdkLoader via a
// `new Function`-created native import() that bypasses jest's module registry —
// so mock the loader boundary, not the `expo-server-sdk` package itself.
jest.mock('../expoSdkLoader', () => {
  const chunkPushNotifications = jest.fn((msgs: unknown[]) => [msgs]);
  const sendPushNotificationsAsync = jest.fn(async () => [{ status: 'ok', id: 't1' }]);
  class Expo {
    static isExpoPushToken(t: string): boolean {
      return typeof t === 'string' && t.startsWith('ExponentPushToken');
    }
    chunkPushNotifications = chunkPushNotifications;
    sendPushNotificationsAsync = sendPushNotificationsAsync;
  }
  return { loadExpo: jest.fn(async () => Expo) };
});

import { expoPushService } from '../expoPushService';

describe('expoPushService.sendToTokens', () => {
  it('filters invalid tokens and sends only valid ones', async () => {
    const result = await expoPushService.sendToTokens(
      ['ExponentPushToken[ok]', 'garbage'],
      { title: 't', body: 'b' },
    );
    expect(result.invalidTokens).toEqual(['garbage']);
    expect(result.tickets.length).toBeGreaterThan(0);
  });

  it('returns empty tickets for no tokens', async () => {
    const result = await expoPushService.sendToTokens([], { title: 't', body: 'b' });
    expect(result.tickets).toEqual([]);
    expect(result.invalidTokens).toEqual([]);
  });

  it('classifies all-invalid tokens without sending', async () => {
    const result = await expoPushService.sendToTokens(['nope'], { title: 't', body: 'b' });
    expect(result.invalidTokens).toEqual(['nope']);
    expect(result.tickets).toEqual([]);
  });
});
