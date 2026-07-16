/**
 * Shared types for social sign-in (Google · Apple · Kakao).
 *
 * `SocialAuthError` carries a machine-readable `code` for branching plus a
 * Korean `userMessage` ready to surface in an Alert. User cancellation is NOT
 * an error — it is modelled as `SocialSignInResult.status === 'cancelled'` so
 * the UI can no-op silently.
 */

export type SocialAuthErrorCode =
  | 'module-unavailable'
  | 'unsupported-platform'
  | 'play-services-unavailable'
  | 'configuration'
  | 'network'
  | 'account-exists'
  | 'credential-in-use'
  | 'server'
  | 'unknown';

export class SocialAuthError extends Error {
  constructor(
    readonly code: SocialAuthErrorCode,
    readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = 'SocialAuthError';
  }
}

export const isSocialAuthError = (e: unknown): e is SocialAuthError =>
  e instanceof SocialAuthError;

export type SocialSignInResult = { status: 'success' } | { status: 'cancelled' };
