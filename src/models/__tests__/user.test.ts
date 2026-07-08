import {
  DEFAULT_ALIGHT_ALERT,
  resolveAlightAlertPreferences,
} from '@models/user';

describe('resolveAlightAlertPreferences', () => {
  it('returns defaults (enabled, 2분 전) when settings is null/undefined', () => {
    expect(resolveAlightAlertPreferences(null)).toEqual({ enabled: true, leadMinutes: 2 });
    expect(resolveAlightAlertPreferences(undefined)).toEqual({ enabled: true, leadMinutes: 2 });
  });

  it('returns defaults when alightAlert field is absent (기존 사용자 문서)', () => {
    expect(resolveAlightAlertPreferences({})).toEqual(DEFAULT_ALIGHT_ALERT);
    expect(resolveAlightAlertPreferences({ alightAlert: undefined })).toEqual(DEFAULT_ALIGHT_ALERT);
  });

  it('passes through a stored preference unchanged', () => {
    const stored = { enabled: false, leadMinutes: 3 as const };
    expect(resolveAlightAlertPreferences({ alightAlert: stored })).toBe(stored);
  });

  it('DEFAULT_ALIGHT_ALERT is frozen (immutability rule)', () => {
    expect(Object.isFrozen(DEFAULT_ALIGHT_ALERT)).toBe(true);
  });
});
