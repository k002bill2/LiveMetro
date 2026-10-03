import { buildRecaptchaSource, parseRecaptchaMessage } from '@/components/auth/recaptcha/recaptchaHtml';
import { TEST_FIREBASE_CONFIG } from '@/components/auth/recaptcha/__tests__/fixtures';

const INJECTION = '</script><script>alert(1)</script>';

describe('buildRecaptchaSource', () => {
  it('uses the auth domain as baseUrl so reCAPTCHA accepts the origin', () => {
    expect(buildRecaptchaSource(TEST_FIREBASE_CONFIG, { invisible: true }).baseUrl).toBe(
      'https://livemetro-dev.firebaseapp.com',
    );
  });

  it('renders an invisible button target when invisible', () => {
    const { html } = buildRecaptchaSource(TEST_FIREBASE_CONFIG, { invisible: true });
    expect(html).toContain('id="recaptcha-btn"');
    expect(html).toContain('size: "invisible"');
  });

  it('renders a visible container when not invisible', () => {
    const { html } = buildRecaptchaSource(TEST_FIREBASE_CONFIG, { invisible: false });
    expect(html).toContain('id="recaptcha-cont"');
    expect(html).toContain('size: "normal"');
  });

  it('loads the pinned firebase script version', () => {
    const { html } = buildRecaptchaSource(TEST_FIREBASE_CONFIG, { invisible: true });
    expect(html).toContain('https://www.gstatic.com/firebasejs/8.0.0/firebase-auth.js');
  });

  it('escapes < in config so a value cannot close the script tag', () => {
    const { html } = buildRecaptchaSource(
      { ...TEST_FIREBASE_CONFIG, projectId: INJECTION },
      { invisible: true },
    );
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });

  it('applies a well-formed language code and drops a malformed one', () => {
    expect(buildRecaptchaSource(TEST_FIREBASE_CONFIG, { invisible: true, languageCode: 'ko' }).html).toContain(
      "firebase.auth().languageCode = 'ko';",
    );
    expect(
      buildRecaptchaSource(TEST_FIREBASE_CONFIG, { invisible: true, languageCode: "ko';alert(1)//" }).html,
    ).not.toContain('alert(1)');
  });
});

describe('parseRecaptchaMessage', () => {
  it('parses each known message type', () => {
    expect(parseRecaptchaMessage('{"type":"load"}')).toEqual({ type: 'load' });
    expect(parseRecaptchaMessage('{"type":"error"}')).toEqual({ type: 'error' });
    expect(parseRecaptchaMessage('{"type":"fullChallenge"}')).toEqual({ type: 'fullChallenge' });
    expect(parseRecaptchaMessage('{"type":"verify","token":"t1"}')).toEqual({
      type: 'verify',
      token: 't1',
    });
  });

  it('returns null for invalid JSON, unknown types, or a verify without a token', () => {
    expect(parseRecaptchaMessage('not json')).toBeNull();
    expect(parseRecaptchaMessage('{"type":"other"}')).toBeNull();
    expect(parseRecaptchaMessage('{"type":"verify"}')).toBeNull();
    expect(parseRecaptchaMessage('null')).toBeNull();
  });
});
