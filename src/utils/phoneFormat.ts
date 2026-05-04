/**
 * phoneFormat — Korean mobile number ↔ E.164 conversion.
 *
 * Firebase Phone Auth (`signInWithPhoneNumber`) requires E.164 format
 * (e.g. `+821012345678`). This module is the single conversion point so
 * the rest of the app can keep raw 11-digit storage (`01012345678`).
 */

const KR_MOBILE_PREFIX = '010';
const KR_MOBILE_LENGTH = 11;
const KR_COUNTRY_CODE = '+82';

/**
 * Convert an 11-digit Korean mobile number to E.164.
 *
 * @example
 *   toE164KR('01012345678') // '+821012345678'
 *
 * @throws if input is not exactly 11 digits starting with `010`.
 */
export const toE164KR = (digits11: string): string => {
  if (typeof digits11 !== 'string') {
    throw new Error('휴대폰 번호 형식이 올바르지 않습니다');
  }
  if (digits11.length !== KR_MOBILE_LENGTH) {
    throw new Error('휴대폰 번호는 11자리여야 합니다');
  }
  if (!digits11.startsWith(KR_MOBILE_PREFIX)) {
    throw new Error('010으로 시작하는 휴대폰 번호여야 합니다');
  }
  // Drop leading 0 of the national format → +82 + 10... (10 digits)
  return `${KR_COUNTRY_CODE}${digits11.slice(1)}`;
};
