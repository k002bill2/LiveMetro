/**
 * registerFcmToken / unregisterFcmToken onCall 배선 테스트 (보안 finding F-10).
 *
 * 실제 export된 v1 onCall을 `.run(data, context)`로 호출해 검증한다 — 검증이
 * `try` 안으로 미끄러져 'internal'로 재매핑되는 회귀까지 잡기 위함.
 *
 * 커버 대상:
 *   - unregister: 소유자 uid(context.auth.uid)를 서비스에 넘긴다, 잘못된 token은
 *     'invalid-argument', 매치 0건이어도 success(존재 여부 오라클 금지)
 *   - register: 누락/타입 오류/과대 길이/미지원 platform → 'invalid-argument',
 *     allowlist 밖 필드(isValid, userId 위조)가 서비스에 도달하지 않음
 */

const mockRegisterToken = jest.fn<Promise<void>, [unknown]>();
const mockInvalidateToken = jest.fn<Promise<void>, [unknown, unknown]>();

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({}),
  FieldValue: {},
  Timestamp: {},
}));

jest.mock('../../services/tokenManagementService', () => ({
  tokenManagementService: {
    registerToken: (request: unknown) => mockRegisterToken(request),
    invalidateToken: (token: unknown, userId: unknown) =>
      mockInvalidateToken(token, userId),
  },
}));

jest.mock('../../services/pushNotificationService', () => ({
  pushNotificationService: {},
}));

jest.mock('../../services/expoPushService', () => ({
  expoPushService: {},
}));

import { registerFcmToken, unregisterFcmToken } from '../notificationTriggers';
import {
  MAX_APP_VERSION_LENGTH,
  MAX_DEVICE_ID_LENGTH,
  MAX_FCM_TOKEN_LENGTH,
} from '../fcmTokenInput';

const CALLER_UID = 'uid-caller';

const authedContext = {
  auth: { uid: CALLER_UID, token: {} },
  rawRequest: {},
} as unknown as Parameters<typeof registerFcmToken.run>[1];

const anonContext = {
  rawRequest: {},
} as unknown as Parameters<typeof registerFcmToken.run>[1];

const VALID_REGISTRATION = {
  token: 'fcm-token-abc',
  deviceId: 'device-123',
  platform: 'android',
  appVersion: '1.1.0',
} as const;

beforeEach(() => {
  mockRegisterToken.mockReset().mockResolvedValue(undefined);
  mockInvalidateToken.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('unregisterFcmToken', () => {
  it('passes the caller uid as the owner to invalidateToken', async () => {
    const result = await unregisterFcmToken.run({ token: 'fcm-token-abc' }, authedContext);

    expect(result).toEqual({ success: true });
    expect(mockInvalidateToken).toHaveBeenCalledTimes(1);
    expect(mockInvalidateToken).toHaveBeenCalledWith('fcm-token-abc', CALLER_UID);
  });

  it('returns success even when the token matched no caller-owned doc (no existence oracle)', async () => {
    // 서비스는 매치 0건이어도 조용히 resolve한다 — 핸들러도 그대로 success.
    const result = await unregisterFcmToken.run({ token: 'someone-elses-token' }, authedContext);
    expect(result).toEqual({ success: true });
  });

  it('rejects unauthenticated callers before validating input', async () => {
    await expect(unregisterFcmToken.run(null, anonContext)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockInvalidateToken).not.toHaveBeenCalled();
  });

  it.each([
    ['null data', null],
    ['array data', ['fcm-token-abc']],
    ['missing token', {}],
    ['non-string token', { token: 123 }],
    ['empty token', { token: '' }],
    ['whitespace token', { token: '   ' }],
    ['oversized token', { token: 'x'.repeat(MAX_FCM_TOKEN_LENGTH + 1) }],
  ])('rejects %s with invalid-argument', async (_label, data) => {
    await expect(unregisterFcmToken.run(data, authedContext)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(mockInvalidateToken).not.toHaveBeenCalled();
  });

  it('maps service failure to internal', async () => {
    mockInvalidateToken.mockRejectedValueOnce(new Error('boom'));
    await expect(
      unregisterFcmToken.run({ token: 'fcm-token-abc' }, authedContext)
    ).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('registerFcmToken', () => {
  it('passes exactly the allowlisted fields plus the caller uid', async () => {
    const result = await registerFcmToken.run({ ...VALID_REGISTRATION }, authedContext);

    expect(result).toEqual({ success: true });
    expect(mockRegisterToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterToken).toHaveBeenCalledWith({
      token: 'fcm-token-abc',
      deviceId: 'device-123',
      platform: 'android',
      appVersion: '1.1.0',
      userId: CALLER_UID,
    });
  });

  it.each(['ios', 'android', 'web'])('accepts platform %s', async (platform) => {
    await registerFcmToken.run({ ...VALID_REGISTRATION, platform }, authedContext);
    expect(mockRegisterToken).toHaveBeenCalledWith(
      expect.objectContaining({ platform })
    );
  });

  it('strips extra fields — isValid / forged userId never reach the service', async () => {
    await registerFcmToken.run(
      { ...VALID_REGISTRATION, isValid: true, userId: 'uid-victim', createdAt: 0 },
      authedContext
    );

    expect(mockRegisterToken).toHaveBeenCalledWith({
      token: 'fcm-token-abc',
      deviceId: 'device-123',
      platform: 'android',
      appVersion: '1.1.0',
      userId: CALLER_UID,
    });
  });

  it('rejects unauthenticated callers before validating input', async () => {
    await expect(registerFcmToken.run('garbage', anonContext)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it.each([
    ['null data', null],
    ['string data', 'fcm-token-abc'],
    ['array data', [VALID_REGISTRATION]],
    ['missing token', { ...VALID_REGISTRATION, token: undefined }],
    ['non-string token', { ...VALID_REGISTRATION, token: 42 }],
    ['empty token', { ...VALID_REGISTRATION, token: '' }],
    ['oversized token', { ...VALID_REGISTRATION, token: 'x'.repeat(MAX_FCM_TOKEN_LENGTH + 1) }],
    ['missing deviceId', { ...VALID_REGISTRATION, deviceId: undefined }],
    ['non-string deviceId', { ...VALID_REGISTRATION, deviceId: { id: 1 } }],
    ['empty deviceId', { ...VALID_REGISTRATION, deviceId: '' }],
    ['oversized deviceId', { ...VALID_REGISTRATION, deviceId: 'd'.repeat(MAX_DEVICE_ID_LENGTH + 1) }],
    ['unknown platform', { ...VALID_REGISTRATION, platform: 'windows' }],
    ['non-string platform', { ...VALID_REGISTRATION, platform: 1 }],
    ['missing platform', { ...VALID_REGISTRATION, platform: undefined }],
    ['missing appVersion', { ...VALID_REGISTRATION, appVersion: undefined }],
    ['empty appVersion', { ...VALID_REGISTRATION, appVersion: '' }],
    ['oversized appVersion', { ...VALID_REGISTRATION, appVersion: '1'.repeat(MAX_APP_VERSION_LENGTH + 1) }],
  ])('rejects %s with invalid-argument', async (_label, data) => {
    await expect(registerFcmToken.run(data, authedContext)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it('maps service failure to internal', async () => {
    mockRegisterToken.mockRejectedValueOnce(new Error('boom'));
    await expect(
      registerFcmToken.run({ ...VALID_REGISTRATION }, authedContext)
    ).rejects.toMatchObject({ code: 'internal' });
  });
});
