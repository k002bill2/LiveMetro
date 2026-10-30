/**
 * fcmTokenInput 순수 validator 테스트 (보안 finding F-10).
 *
 * 경계값(정확히 최대 길이 허용 / +1 거부)과 allowlist 반환 형태를 검증한다.
 * onCall 배선(검증이 try 밖에서 invalid-argument로 나가는지)은
 * fcmTokenTriggers.test.ts가 담당한다.
 */

import {
  FCM_PLATFORMS,
  MAX_APP_VERSION_LENGTH,
  MAX_DEVICE_ID_LENGTH,
  MAX_FCM_TOKEN_LENGTH,
  parseRegisterFcmTokenInput,
  parseUnregisterFcmTokenInput,
} from '../fcmTokenInput';

const VALID = {
  token: 'fcm-token-abc',
  deviceId: 'device-123',
  platform: 'ios',
  appVersion: '1.1.0',
};

describe('parseRegisterFcmTokenInput', () => {
  it('returns only the allowlisted fields', () => {
    const parsed = parseRegisterFcmTokenInput({ ...VALID, isValid: true, userId: 'uid-victim' });
    expect(parsed).toEqual({
      token: 'fcm-token-abc',
      deviceId: 'device-123',
      platform: 'ios',
      appVersion: '1.1.0',
    });
  });

  it('accepts values exactly at the length limits', () => {
    const parsed = parseRegisterFcmTokenInput({
      token: 't'.repeat(MAX_FCM_TOKEN_LENGTH),
      deviceId: 'd'.repeat(MAX_DEVICE_ID_LENGTH),
      platform: 'web',
      appVersion: 'v'.repeat(MAX_APP_VERSION_LENGTH),
    });
    expect(parsed.token).toHaveLength(MAX_FCM_TOKEN_LENGTH);
    expect(parsed.deviceId).toHaveLength(MAX_DEVICE_ID_LENGTH);
    expect(parsed.appVersion).toHaveLength(MAX_APP_VERSION_LENGTH);
  });

  it('exposes exactly the three supported platforms', () => {
    expect([...FCM_PLATFORMS]).toEqual(['ios', 'android', 'web']);
  });

  it.each([
    ['undefined', undefined],
    ['unknown platform', { ...VALID, platform: 'IOS' }],
    ['prototype-ish platform', { ...VALID, platform: 'toString' }],
    ['oversized token', { ...VALID, token: 't'.repeat(MAX_FCM_TOKEN_LENGTH + 1) }],
  ])('throws invalid-argument for %s', (_label, data) => {
    expect(() => parseRegisterFcmTokenInput(data)).toThrow(
      expect.objectContaining({ code: 'invalid-argument' })
    );
  });

  it('uses a user-friendly Korean message without echoing input', () => {
    const secret = 'leak-me-'.repeat(1000);
    try {
      parseRegisterFcmTokenInput({ ...VALID, token: secret });
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid-argument' });
      const message = (error as Error).message;
      expect(message).not.toContain('leak-me-');
      expect(message).toMatch(/[가-힣]/);
    }
  });
});

describe('parseUnregisterFcmTokenInput', () => {
  it('returns the token string', () => {
    expect(parseUnregisterFcmTokenInput({ token: 'fcm-token-abc', extra: 1 })).toBe(
      'fcm-token-abc'
    );
  });

  it('accepts a token exactly at the length limit', () => {
    expect(parseUnregisterFcmTokenInput({ token: 't'.repeat(MAX_FCM_TOKEN_LENGTH) })).toHaveLength(
      MAX_FCM_TOKEN_LENGTH
    );
  });

  it.each([
    ['undefined', undefined],
    ['number token', { token: 1 }],
    ['oversized token', { token: 't'.repeat(MAX_FCM_TOKEN_LENGTH + 1) }],
  ])('throws invalid-argument for %s', (_label, data) => {
    expect(() => parseUnregisterFcmTokenInput(data)).toThrow(
      expect.objectContaining({ code: 'invalid-argument' })
    );
  });
});
