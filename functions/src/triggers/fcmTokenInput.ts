/**
 * FCM token callable input validation (security finding F-10).
 *
 * `registerFcmToken` / `unregisterFcmToken` are client-invoked callables, so
 * `data` is untrusted. These pure parsers run before any Firestore access and
 * return only allowlisted fields — extra keys (e.g. `isValid`, a forged
 * `userId`) never reach the service layer. Owner identity always comes from
 * `context.auth.uid`, never from `data`.
 *
 * Failures throw `HttpsError('invalid-argument')` with a fixed Korean message
 * that never echoes the input.
 */

import * as functions from 'firebase-functions/v1';

// ============================================================================
// Limits
// ============================================================================

/** FCM registration tokens are ~150-300 chars today; 4096 leaves ample headroom. */
export const MAX_FCM_TOKEN_LENGTH = 4096;
/** Device identifiers (installation/vendor ids) are short opaque strings. */
export const MAX_DEVICE_ID_LENGTH = 256;
/** Semver-ish app version strings (e.g. "1.1.0", "1.1.0-rc.1+build.42"). */
export const MAX_APP_VERSION_LENGTH = 64;
/** Platforms accepted by `TokenRegistrationRequest.platform`. */
export const FCM_PLATFORMS = ['ios', 'android', 'web'] as const;

export type FcmPlatform = (typeof FCM_PLATFORMS)[number];

/** Validated `registerFcmToken` payload — userId is added by the handler from auth. */
export interface FcmTokenRegistrationInput {
  readonly token: string;
  readonly deviceId: string;
  readonly platform: FcmPlatform;
  readonly appVersion: string;
}

const INVALID_INPUT_MESSAGE = '요청 정보가 올바르지 않습니다.';

// ============================================================================
// Guards
// ============================================================================

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;

const isFcmPlatform = (value: unknown): value is FcmPlatform =>
  typeof value === 'string' && (FCM_PLATFORMS as readonly string[]).includes(value);

const invalidArgument = (): functions.https.HttpsError =>
  new functions.https.HttpsError('invalid-argument', INVALID_INPUT_MESSAGE);

// ============================================================================
// Parsers
// ============================================================================

/**
 * Validate `registerFcmToken` data and return only the allowlisted fields.
 * @throws HttpsError('invalid-argument') on any missing/ill-typed/oversized field.
 */
export const parseRegisterFcmTokenInput = (data: unknown): FcmTokenRegistrationInput => {
  if (!isPlainRecord(data)) throw invalidArgument();

  const { token, deviceId, platform, appVersion } = data;
  if (
    !isBoundedString(token, MAX_FCM_TOKEN_LENGTH) ||
    !isBoundedString(deviceId, MAX_DEVICE_ID_LENGTH) ||
    !isFcmPlatform(platform) ||
    !isBoundedString(appVersion, MAX_APP_VERSION_LENGTH)
  ) {
    throw invalidArgument();
  }

  return { token, deviceId, platform, appVersion };
};

/**
 * Validate `unregisterFcmToken` data and return the token.
 * @throws HttpsError('invalid-argument') if `token` is not a bounded non-empty string.
 */
export const parseUnregisterFcmTokenInput = (data: unknown): string => {
  if (!isPlainRecord(data)) throw invalidArgument();

  const { token } = data;
  if (!isBoundedString(token, MAX_FCM_TOKEN_LENGTH)) throw invalidArgument();

  return token;
};
