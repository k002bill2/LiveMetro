/**
 * htmlEscape Tests
 *
 * Pure unit tests for the HTML escaping and control-char stripping helpers used
 * by email templates (F-02: HTML injection via callable payload).
 */
import { escapeHtml, stripControlChars } from '../htmlEscape';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('escapes & first so existing entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('neutralizes script and attribute-breakout payloads', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('"><img src=x onerror=1>')).toBe(
      '&quot;&gt;&lt;img src=x onerror=1&gt;',
    );
  });

  it('leaves plain Korean text untouched', () => {
    expect(escapeHtml('2호선 강남역')).toBe('2호선 강남역');
  });

  it('returns an empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('stripControlChars', () => {
  it('removes CR/LF so header injection is impossible', () => {
    expect(stripControlChars('2호선\r\nBcc: victim@example.com')).toBe(
      '2호선Bcc: victim@example.com',
    );
  });

  it('removes tab, NUL, DEL and C1 control characters', () => {
    const input = `a${String.fromCharCode(0)}b\tc${String.fromCharCode(0x7f)}d${String.fromCharCode(0x85)}e`;
    expect(stripControlChars(input)).toBe('abcde');
  });

  it('keeps ordinary text', () => {
    expect(stripControlChars('신분당선')).toBe('신분당선');
  });
});
